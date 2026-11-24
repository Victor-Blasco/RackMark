import { clearSyncJob, loadSyncJob, saveSyncJob, wipeAll } from '../lib/db';
import { consumeRedirectAuth, signInGoogle, signOutGoogle, subscribeAuth } from '../lib/firebase';
import {
  clearSyncMeta,
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

export interface SyncControllerHooks {
  onUserReady?: () => void;
  onSessionReset?: () => void;
}

export interface SyncController {
  cloudLogin: () => Promise<void>;
  cloudSync: () => Promise<void>;
  cloudLogout: () => Promise<void>;
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
      if (isOnline() && ctx.state.user) void runSync(false);
    }, delay);
  }

  async function runSync(showToast = false): Promise<void> {
    const S = ctx.state;
    if (!S.user) return;
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
      if (ctx.state.user && isOnline()) void runSync(false);
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
    if (!ctx.state.user || !isOnline()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      void runSync(false);
    }, 600);
  }

  async function resumeSyncJob(): Promise<void> {
    if (syncResumeAttempted || !ctx.state.user) return;
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
      const changed = user?.uid !== S.user?.uid;
      S.authReady = true;
      S.user = user;
      if (changed || !wasReady) ctx.render();
      if (user && changed && isOnline()) {
        syncResumeAttempted = true;
        void runSync(false);
      } else if (user) {
        void resumeSyncJob().catch((e) => ctx.toast(`No se pudo recuperar la sincronización: ${humanizeError(e)}`));
      }
      if (user) hooks?.onUserReady?.();
    });
  }

  const cloudLogin = async (): Promise<void> => {
    try {
      await signInGoogle();
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code !== 'auth/popup-closed-by-user') ctx.toast(`Error al iniciar sesión: ${humanizeError(e)}`);
    }
  };

  const cloudLogout = async (): Promise<void> => {
    const S = ctx.state;
    clearSyncTimers();
    syncPending = false;
    if (syncPromise) await syncPromise;
    if (S.user && isOnline() && hasUnsyncedChanges()) await runSync(false);
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
      ctx.toast('Sesión cerrada en este dispositivo.');
    } catch (e) {
      ctx.toast(`No se pudo cerrar la sesión: ${humanizeError(e)}`);
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
    cloudSync: () => runSync(true),
    cloudLogout,
    wipe,
    runSync,
    queueSync,
    initAuth,
    getLastSyncAt: () => loadSyncMeta().lastSyncAt,
  };
}
