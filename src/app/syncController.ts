import { clearSyncJob, loadSyncJob, saveSyncJob, wipeAll } from '../lib/db';
import {
  consumeRedirectAuth,
  deleteCurrentUser,
  isGoogleAuthUser,
  isRecentSignIn,
  reauthenticateGoogle,
  reloadCurrentUser,
  resendVerificationEmail,
  resetPasswordEmail,
  signInEmail,
  signInGoogle,
  signOutGoogle,
  signUpEmail,
  subscribeAuth,
} from '../lib/firebase';
import {
  clearSyncMeta,
  deleteCloudUserData,
  hasUnsyncedChanges,
  loadSyncMeta,
  markWipePending,
  syncWithCloud,
} from '../lib/sync';
import { maybeOpenInitialWizard, type AppContext } from './context';
import { humanizeError } from '../store/types';
import type { SyncJob } from '../types';

const SYNC_JOB_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SYNC_RETRY_BASE_MS = 2_000;
const SYNC_RETRY_MAX_MS = 5 * 60 * 1000;

const isOnline = (): boolean => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);
const isVerifiedUser = (u: AppContext['state']['user']): boolean => Boolean(u && u.emailVerified);

export interface SyncControllerHooks {
  onUserReady?: () => void;
  onSessionReset?: () => void;
}

export interface SyncController {
  cloudLogin: () => Promise<void>;
  cloudEmailLogin: (email: string, password: string) => Promise<boolean>;
  cloudEmailSignUp: (email: string, password: string, displayName: string) => Promise<boolean>;
  cloudResetPassword: (email: string) => Promise<boolean>;
  cloudResendVerification: () => Promise<void>;
  cloudCheckEmailVerified: () => Promise<void>;
  cloudSync: () => Promise<void>;
  cloudLogout: () => Promise<void>;
  cloudDeleteAccount: () => Promise<void>;
  wipe: () => Promise<void>;
  runSync: (showToast?: boolean) => Promise<void>;
  queueSync: () => void;
  initAuth: () => Promise<() => void>;
  getLastSyncAt: () => number | undefined;
}

export function createSyncController(ctx: AppContext, hooks?: SyncControllerHooks): SyncController {
  let syncTimer: ReturnType<typeof setTimeout> | undefined;
  let syncRetryTimer: ReturnType<typeof setTimeout> | undefined;
  let syncInFlight = false;
  let syncPending = false;
  let syncPromise: Promise<void> | null = null;
  let syncResumeAttempted = false;
  let syncJobWrite: Promise<void> | undefined;

  function clearSyncTimers(): void {
    clearTimeout(syncTimer);
    syncTimer = undefined;
    if (syncRetryTimer) {
      clearTimeout(syncRetryTimer);
      syncRetryTimer = undefined;
    }
  }

  function resetSessionUiState(S: AppContext['state']): void {
    S.measureDraft = undefined;
    S.calcDraft = undefined;
    S.measureDate = undefined;
    S.measurePerimOpen = undefined;
    S.sel = {};
    S.dayExtra = undefined;
    S.ranges = undefined;
    S.customRanges = undefined;
    S.activeModal = null;
    S.aiJob = undefined;
    S.aiQuota = undefined;
    S.syncJob = undefined;
    S.planRoutine = undefined;
    S.planTab = undefined;
    S.exerciseMapSearch = undefined;
    S.exerciseMapMuscle = undefined;
    S.showAllExerciseMap = undefined;
    S.mergeFrom = undefined;
    S.mergeTo = undefined;
    S.measureScrollTs = undefined;
    S.bodyMetric = undefined;
    S.aiTab = undefined;
  }

  function scheduleSyncRetry(at: number): void {
    if (syncRetryTimer) clearTimeout(syncRetryTimer);
    const delay = Math.max(0, at - Date.now());
    syncRetryTimer = setTimeout(() => {
      syncRetryTimer = undefined;
      if (isOnline() && isVerifiedUser(ctx.state.user)) void runSync(false);
    }, delay);
  }

  async function runSync(showToast = false): Promise<void> {
    const S = ctx.state;
    if (!isVerifiedUser(S.user)) return;
    if (syncInFlight) {
      syncPending = true;
      return;
    }
    syncInFlight = true;
    const exec = (async () => {
      let runningJob: SyncJob | undefined;
      try {
        let previousJob: SyncJob | undefined;
        try {
          previousJob = await loadSyncJob();
        } catch (e) {
          if (showToast) ctx.toast(`No se pudo preparar la sincronización: ${humanizeError(e)}`);
          return;
        }
        if (!showToast && previousJob?.status === 'error' && previousJob.nextAttemptAt && previousJob.nextAttemptAt > Date.now()) {
          return;
        }
        const initialUid = S.user?.uid;
        if (!initialUid) return;
        const preMeta = loadSyncMeta();
        if (preMeta.uid && preMeta.uid !== initialUid && hasUnsyncedChanges(preMeta)) {
          const ok = await ctx.askConfirm({
            title: 'Cambiar de cuenta con cambios pendientes',
            message: 'Hay cambios locales sin subir de una cuenta anterior. Si cambias ahora se limpiarán de este dispositivo.',
            confirmLabel: 'Continuar y reemplazar',
            danger: true,
          });
          if (!ok) {
            syncPending = false;
            await signOutGoogle();
            S.user = null;
            return;
          }
          if (!S.user) return;
        }
        const activeUid = S.user?.uid;
        if (!activeUid) return;
        S.syncing = true;
        ctx.render();
        runningJob = {
          id: 'cloud-sync',
          status: 'running',
          createdAt: previousJob?.createdAt ?? Date.now(),
          updatedAt: Date.now(),
          attempts: (previousJob?.attempts ?? 0) + 1,
          error: undefined,
        };
        S.syncJob = runningJob;
        try {
          await saveSyncJob(runningJob);
        } catch (e) {
          if (showToast) ctx.toast(`No se pudo guardar el estado de sincronización: ${humanizeError(e)}`);
          return;
        }
        const res = await syncWithCloud(activeUid);
        await clearSyncJob();
        S.syncJob = undefined;
        S.lastSync = Date.now();
        if (res.accountSwitched || res.remoteWiped) {
          ctx.clearActiveWorkouts();
          resetSessionUiState(S);
        }
        const changed = Boolean(
          res.accountSwitched || res.remoteWiped || res.pulledItems || res.deletedItems || res.settingsDirection === 'pulled',
        );
        if (changed) {
          await ctx.reload();
        }
        const wizardDismissed = Boolean(
          S.activeModal?.type === 'wizard' &&
            (S.settings.onboardingCompleted || S.strength.length > 0 || S.measures.length > 0),
        );
        if (wizardDismissed) {
          S.activeModal = null;
        }
        if (maybeOpenInitialWizard(S) || changed || wizardDismissed) {
          ctx.render();
        }
        if (res.settingsConflict) {
          ctx.toast('Se aplicaron ajustes más recientes de tu cuenta (tus nombres y notas locales se conservaron).');
        } else if (showToast) {
          const msg = res.pulledItems || res.pushedBuckets || res.deletedItems || res.settingsDirection !== 'none'
            ? 'Datos sincronizados con tu cuenta.'
            : 'Todo al día con la nube.';
          ctx.toast(msg);
        }
      } catch (e) {
        const error = humanizeError(e, 'Error de sincronización.');
        const attempts = runningJob?.attempts ?? 1;
        const nextAttemptAt = Date.now() + Math.min(
          SYNC_RETRY_MAX_MS,
          SYNC_RETRY_BASE_MS * (2 ** Math.max(0, attempts - 1)),
        );
        const failedJob: SyncJob = {
          id: 'cloud-sync',
          createdAt: runningJob?.createdAt ?? Date.now(),
          attempts,
          status: 'error',
          updatedAt: Date.now(),
          error,
          nextAttemptAt,
        };
        try {
          await saveSyncJob(failedJob);
        } catch {
          /* persiste al menos en memoria */
        }
        S.syncJob = failedJob;
        scheduleSyncRetry(nextAttemptAt);
        if (showToast) ctx.toast(`Error de sincronización: ${error}`);
      } finally {
        S.syncing = false;
        syncInFlight = false;
        syncPromise = null;
        ctx.render();
      }
    })();
    syncPromise = exec;
    await exec;
    if (syncPending) {
      syncPending = false;
      if (isVerifiedUser(ctx.state.user) && isOnline()) void runSync(false);
    }
  }

  function queueSync(): void {
    ctx.render();
    const now = Date.now();
    syncJobWrite = (syncJobWrite ?? Promise.resolve())
      .then(async () => {
        const existing = await loadSyncJob();
        if (existing?.status === 'running') return;
        const pendingJob: SyncJob = {
          id: 'cloud-sync',
          status: 'pending',
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          attempts: existing?.attempts ?? 0,
          error: undefined,
          nextAttemptAt: undefined,
        };
        await saveSyncJob(pendingJob);
        ctx.state.syncJob = pendingJob;
      })
      .catch((e) => {
        if (import.meta.env.DEV) console.warn('[sync] could not persist pending job', { error: e instanceof Error ? e.name : 'unknown' });
      });
    if (!isVerifiedUser(ctx.state.user) || !isOnline()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      void runSync(false);
    }, 600);
  }

  async function resumeSyncJob(): Promise<void> {
    if (syncResumeAttempted || !isVerifiedUser(ctx.state.user)) return;
    syncResumeAttempted = true;
    const job = await loadSyncJob();
    if (!job) return;
    if (Date.now() - job.updatedAt > SYNC_JOB_MAX_AGE_MS) {
      await clearSyncJob();
      return;
    }
    if (job.status === 'pending' || job.status === 'running' || (job.status === 'error' && (!job.nextAttemptAt || job.nextAttemptAt <= Date.now()))) {
      await runSync(false);
    } else {
      ctx.toast(`La sincronización anterior falló: ${job.error ?? 'puedes reintentarlo.'}`);
    }
  }

  async function initAuth(): Promise<() => void> {
    const redir = await consumeRedirectAuth();
    if (redir.error) ctx.toast(`No se pudo completar el acceso con Google: ${redir.error}`);
    return subscribeAuth((user) => {
      const S = ctx.state;
      const wasReady = Boolean(S.authReady);
      const changed = user?.uid !== S.user?.uid || user?.emailVerified !== S.user?.emailVerified;
      const verified = isVerifiedUser(user);
      S.authReady = true;
      S.user = user;
      if (changed || !wasReady) ctx.render();
      if (verified && changed && isOnline()) {
        syncResumeAttempted = true;
        void runSync(false);
      } else if (verified) {
        void resumeSyncJob().catch((e) => ctx.toast(`No se pudo recuperar la sincronización: ${humanizeError(e)}`));
      }
      if (verified) hooks?.onUserReady?.();
    });
  }

  function closeAuthModalIfOpen(): void {
    if (ctx.state.activeModal?.type === 'auth') {
      ctx.state.activeModal = null;
      ctx.render();
    }
  }

  async function clearLocalSession(S: AppContext['state']): Promise<void> {
    if (syncPromise) await syncPromise;
    await wipeAll();
    clearSyncMeta();
    hooks?.onSessionReset?.();
    syncResumeAttempted = false;
    ctx.clearActiveWorkouts();
    resetSessionUiState(S);
    S.user = null;
    S.lastSync = undefined;
    await ctx.reload();
    ctx.render();
  }

  const cloudLogin = async (): Promise<void> => {
    try {
      await signInGoogle();
      closeAuthModalIfOpen();
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code !== 'auth/popup-closed-by-user') ctx.toast(`Error al iniciar sesión: ${humanizeError(e)}`);
    }
  };

  const cloudEmailLogin = async (email: string, password: string): Promise<boolean> => {
    try {
      await signInEmail(email, password);
      closeAuthModalIfOpen();
      return true;
    } catch (e) {
      ctx.toast(`Error al iniciar sesión: ${humanizeError(e)}`);
      return false;
    }
  };

  const cloudEmailSignUp = async (email: string, password: string, displayName: string): Promise<boolean> => {
    try {
      await signUpEmail(email, password, displayName);
      const cleanName = displayName.trim().slice(0, 60);
      if (ctx.state.user && cleanName && !ctx.state.user.displayName) {
        ctx.state.user = { ...ctx.state.user, displayName: cleanName };
      }
      closeAuthModalIfOpen();
      ctx.toast('Cuenta creada. Revisa tu correo para verificarla y activar la sincronización.');
      return true;
    } catch (e) {
      ctx.toast(`No se pudo crear la cuenta: ${humanizeError(e)}`);
      return false;
    }
  };

  const cloudResetPassword = async (email: string): Promise<boolean> => {
    try {
      await resetPasswordEmail(email);
      ctx.toast('Te hemos enviado un correo para restablecer tu contraseña.');
      return true;
    } catch (e) {
      ctx.toast(`No se pudo enviar el correo: ${humanizeError(e)}`);
      return false;
    }
  };

  const cloudResendVerification = async (): Promise<void> => {
    try {
      await resendVerificationEmail();
      ctx.toast('Correo de verificación reenviado. Revisa también tu carpeta de spam.');
    } catch (e) {
      ctx.toast(`No se pudo reenviar la verificación: ${humanizeError(e)}`);
    }
  };

  const cloudCheckEmailVerified = async (): Promise<void> => {
    try {
      const user = await reloadCurrentUser();
      ctx.state.user = user;
      if (user?.emailVerified) {
        ctx.render();
        void runSync(true);
        hooks?.onUserReady?.();
        ctx.toast('Correo verificado. Sincronización activada.');
      } else {
        ctx.toast('Tu correo todavía figura sin verificar. Abre el enlace recibido y vuelve a comprobar.');
      }
    } catch (e) {
      ctx.toast(`No se pudo comprobar la verificación: ${humanizeError(e)}`);
    }
  };

  const cloudLogout = async (): Promise<void> => {
    const S = ctx.state;
    clearSyncTimers();
    syncPending = false;
    if (syncPromise) await syncPromise;
    if (isVerifiedUser(S.user) && isOnline() && hasUnsyncedChanges()) await runSync(false);
    if (
      hasUnsyncedChanges() &&
      !(await ctx.askConfirm({
        title: 'Cerrar sesión con cambios locales',
        message: 'Hay cambios locales sin subir a la nube. Si cierras sesión se limpiarán los datos guardados en este dispositivo.',
        confirmLabel: 'Cerrar sesión',
        danger: true,
      }))
    ) {
      return;
    }
    try {
      await signOutGoogle();
      await clearLocalSession(S);
      ctx.toast('Sesión cerrada en este dispositivo.');
    } catch (e) {
      ctx.toast(`No se pudo cerrar la sesión: ${humanizeError(e)}`);
    }
  };

  const cloudDeleteAccount = async (): Promise<void> => {
    const S = ctx.state;
    if (!S.user) return;
    if (
      !(await ctx.askConfirm({
        title: 'Eliminar cuenta permanentemente',
        message: 'Se eliminará tu cuenta de RackMark y todos tus datos en la nube y en este dispositivo. Esta acción es irreversible.',
        confirmLabel: 'Eliminar cuenta',
        danger: true,
      }))
    ) {
      return;
    }
    try {
      if (!isRecentSignIn()) {
        if (isGoogleAuthUser()) {
          await reauthenticateGoogle();
        } else {
          ctx.toast('Por seguridad, cierra sesión y vuelve a iniciar sesión justo antes de eliminar tu cuenta.');
          return;
        }
      }
      clearSyncTimers();
      syncPending = false;
      if (syncPromise) await syncPromise;
      const uid = S.user.uid;
      if (isVerifiedUser(S.user) && isOnline()) {
        await deleteCloudUserData(uid);
      }
      await deleteCurrentUser();
      await clearLocalSession(S);
      ctx.toast('Tu cuenta y todos tus datos han sido eliminados.');
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
      ctx.toast(`No se pudo eliminar la cuenta: ${humanizeError(e)}`);
    }
  };

  const wipe = async (): Promise<void> => {
    const S = ctx.state;
    const msg = S.user
      ? 'Se borrarán todos los datos de este dispositivo y de tu nube conectada. Esta acción es irreversible.'
      : 'Se borrarán todos los datos almacenados en este dispositivo. Esta acción es irreversible.';
    if (
      !(await ctx.askConfirm({
        title: 'Borrar todos los datos',
        message: msg,
        confirmLabel: 'Borrar todo',
        danger: true,
      }))
    ) {
      return;
    }
    try {
      clearSyncTimers();
      syncPending = false;
      if (syncPromise) await syncPromise;
      await wipeAll();
      markWipePending();
      ctx.clearActiveWorkouts();
      resetSessionUiState(S);
      await ctx.reload();
      ctx.render();
      queueSync();
      ctx.toast('Datos borrados.');
    } catch (e) {
      ctx.toast(`No se pudieron borrar los datos: ${humanizeError(e)}`);
    }
  };

  return {
    cloudLogin,
    cloudEmailLogin,
    cloudEmailSignUp,
    cloudResetPassword,
    cloudResendVerification,
    cloudCheckEmailVerified,
    cloudSync: () => runSync(true),
    cloudLogout,
    cloudDeleteAccount,
    wipe,
    runSync,
    queueSync,
    initAuth,
    getLastSyncAt: () => loadSyncMeta().lastSyncAt,
  };
}
