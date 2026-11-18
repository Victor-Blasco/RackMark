import { clearAiJob, clearSyncJob, loadAiJob, loadSyncJob, sanitizeSettings, saveAiJob, saveSettings, saveSyncJob, wipeAll } from '../lib/db';
import { consumeRedirectAuth, signInGoogle, signOutGoogle, subscribeAuth } from '../lib/firebase';
import {
  clearSyncMeta,
  hasUnsyncedChanges,
  loadSyncMeta,
  markSettingsDirty,
  markWipePending,
  syncWithCloud,
} from '../lib/sync';
import { arg, maybeOpenInitialWizard, type AppContext } from './context';
import type { AiJob, SyncJob } from '../types';

const AI_COOLDOWN_MS = 15_000;
const AI_JOB_MAX_AGE_MS = 30 * 60 * 1000;
const SYNC_JOB_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SYNC_RETRY_BASE_MS = 2_000;
const SYNC_RETRY_MAX_MS = 5 * 60 * 1000;

const isOnline = (): boolean => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);

export interface SyncController {
  actions: Record<string, (el: HTMLElement) => void | Promise<void>>;
  runAi: () => Promise<void>;
  retryAi: () => Promise<void>;
  dismissAi: () => Promise<void>;
  cloudLogin: () => Promise<void>;
  cloudSync: () => Promise<void>;
  cloudLogout: () => Promise<void>;
  wipe: () => Promise<void>;
  runSync: (showToast?: boolean) => Promise<void>;
  queueSync: () => void;
  initAuth: () => Promise<() => void>;
  getLastSyncAt: () => number | undefined;
}

export function createSyncController(ctx: AppContext): SyncController {
  let lastAiAt = 0;
  let syncTimer: ReturnType<typeof setTimeout> | undefined;
  let syncRetryTimer: ReturnType<typeof setTimeout> | undefined;
  let syncInFlight = false;
  let syncPending = false;

  function scheduleSyncRetry(at: number): void {
    if (syncRetryTimer) clearTimeout(syncRetryTimer);
    const delay = Math.max(0, at - Date.now());
    syncRetryTimer = setTimeout(() => {
      syncRetryTimer = undefined;
      if (isOnline() && ctx.state.user) void runSync(false);
    }, delay);
  }
  let aiResumeAttempted = false;
  let syncResumeAttempted = false;
  let syncJobWrite: Promise<void> | undefined;

  const createAiJobId = (): string =>
    globalThis.crypto?.randomUUID?.() ?? `ai-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  async function runAiJob(job: AiJob): Promise<void> {
    const S = ctx.state;
    if (S.busy) return;
    const startedAt = Date.now();
    const running: AiJob = {
      ...job,
      status: 'running',
      attempts: job.attempts + 1,
      startedAt,
      updatedAt: startedAt,
      error: undefined,
    };
    try {
      await saveAiJob(running);
    } catch (e) {
      ctx.toast(`No se pudo guardar el estado del informe: ${(e as Error).message}`);
      return;
    }
    S.aiJob = running;
    S.busy = 'ai';
    try {
      ctx.render();
      const { generateAnalysisFromPayload } = await import('../lib/ai');
      const result = await generateAnalysisFromPayload(running.payload, running.tone);
      const nextSettings = sanitizeSettings({ ...S.settings, ai: result });
      await saveSettings(nextSettings);
      S.settings = nextSettings;
      S.aiTab = 0;
      markSettingsDirty();
      try {
        await clearAiJob();
      } catch (e) {
        if (import.meta.env.DEV) console.warn('[ai] could not clear completed job', { error: (e as Error).name });
      }
      S.aiJob = undefined;
      queueSync();
      ctx.toast('Análisis generado.');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo generar el análisis.';
      const failed: AiJob = { ...running, status: 'error', error: message, updatedAt: Date.now() };
      try {
        await saveAiJob(failed);
        S.aiJob = failed;
      } catch (persistError) {
        ctx.toast(`Error de IA: ${message}. Además, no se pudo guardar el estado del error: ${(persistError as Error).message}`);
      }
      ctx.toast(`Error de IA: ${message}`);
    } finally {
      S.busy = undefined;
      ctx.render();
    }
  }

  async function resumeAiJob(): Promise<void> {
    if (aiResumeAttempted || !ctx.state.user) return;
    aiResumeAttempted = true;
    const job = await loadAiJob();
    if (!job) return;
    const age = Date.now() - job.updatedAt;
    if (job.status === 'completed') {
      await clearAiJob();
      return;
    }
    if (age > AI_JOB_MAX_AGE_MS && (job.status === 'pending' || job.status === 'running')) {
      const expired: AiJob = { ...job, status: 'error', error: 'La generación caducó. Puedes reintentarlo.', updatedAt: Date.now() };
      await saveAiJob(expired);
      ctx.state.aiJob = expired;
      ctx.render();
      return;
    }
    if (job.status === 'error' || job.attempts >= 2) {
      ctx.state.aiJob = job;
      ctx.render();
      return;
    }
    lastAiAt = Date.now();
    await runAiJob(job);
  }

  async function retryAiJob(): Promise<void> {
    const job = ctx.state.aiJob ?? await loadAiJob();
    if (!job || job.status !== 'error') return;
    const now = Date.now();
    const retry: AiJob = {
      ...job,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      attempts: 0,
      error: undefined,
      startedAt: undefined,
      finishedAt: undefined,
    };
    lastAiAt = now;
    await runAiJob(retry);
  }

  async function runSync(showToast = false): Promise<void> {
    const S = ctx.state;
    if (!S.user) return;
    if (syncInFlight) {
      syncPending = true;
      return;
    }
    const storedJob = await loadSyncJob();
    if (!showToast && storedJob?.status === 'error' && storedJob.nextAttemptAt && storedJob.nextAttemptAt > Date.now()) {
      return;
    }
    const preMeta = loadSyncMeta();
    if (preMeta.uid && preMeta.uid !== S.user.uid && hasUnsyncedChanges(preMeta)) {
      syncInFlight = true;
      const ok = await ctx.askConfirm({
        title: 'Cambiar de cuenta con cambios pendientes',
        message: 'Hay cambios locales sin subir de una cuenta anterior. Si cambias ahora se limpiarán de este dispositivo.',
        confirmLabel: 'Continuar y reemplazar',
        danger: true,
      });
      syncInFlight = false;
      if (!ok) {
        syncPending = false;
        await signOutGoogle();
        S.user = null;
        ctx.render();
        return;
      }
      if (!S.user) return;
    }
    syncInFlight = true;
    S.syncing = true;
    ctx.updateSyncDom();
    let previousJob: SyncJob | undefined;
    try {
      previousJob = await loadSyncJob();
    } catch (e) {
      S.syncing = false;
      syncInFlight = false;
      ctx.updateSyncDom();
      if (showToast) ctx.toast(`No se pudo preparar la sincronización: ${(e as Error).message}`);
      return;
    }
    const runningJob: SyncJob = {
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
      S.syncing = false;
      syncInFlight = false;
      ctx.updateSyncDom();
      if (showToast) ctx.toast(`No se pudo guardar el estado de sincronización: ${(e as Error).message}`);
      return;
    }
    try {
      const res = await syncWithCloud(S.user.uid);
      await clearSyncJob();
      S.syncJob = undefined;
      S.lastSync = Date.now();
      if (res.accountSwitched || res.remoteWiped) {
        ctx.clearActiveWorkouts();
      }
      const changed = Boolean(
        res.accountSwitched || res.remoteWiped || res.pulledItems || res.deletedItems || res.settingsDirection === 'pulled',
      );
      if (changed) {
        await ctx.reload();
      }
      const wizardDismissed = Boolean(
        (S.wizard || S.activeModal?.type === 'wizard') &&
          (S.settings.onboardingCompleted || S.strength.length > 0 || S.measures.length > 0),
      );
      if (wizardDismissed) {
        S.wizard = undefined;
        if (S.activeModal?.type === 'wizard') S.activeModal = null;
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
      const error = e instanceof Error ? e.message : 'Error de sincronización.';
      const nextAttemptAt = Date.now() + Math.min(
        SYNC_RETRY_MAX_MS,
        SYNC_RETRY_BASE_MS * (2 ** Math.max(0, runningJob.attempts - 1)),
      );
      const failedJob: SyncJob = {
        ...runningJob,
        status: 'error',
        updatedAt: Date.now(),
        error,
        nextAttemptAt,
      };
      await saveSyncJob(failedJob);
      S.syncJob = failedJob;
      scheduleSyncRetry(nextAttemptAt);
      if (showToast) ctx.toast(`Error de sincronización: ${(e as Error).message}`);
    } finally {
      S.syncing = false;
      syncInFlight = false;
      ctx.updateSyncDom();
      if (syncPending) {
        syncPending = false;
        void runSync(false);
      }
    }
  }

  function queueSync(): void {
    ctx.updateSyncDom();
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
      if (user && changed && isOnline()) void runSync(false);
      if (user) void resumeSyncJob().catch((e) => ctx.toast(`No se pudo recuperar la sincronización: ${(e as Error).message}`));
      if (user) void resumeAiJob().catch((e) => ctx.toast(`No se pudo recuperar el informe IA: ${(e as Error).message}`));
    });
  }

  const getLastSyncAt = (): number | undefined => loadSyncMeta().lastSyncAt;

  const runAi = async (): Promise<void> => {
    const S = ctx.state;
    if (!S.user) {
      ctx.toast('Inicia sesión con Google para generar análisis con IA.');
      return;
    }
    const waitSec = Math.ceil((AI_COOLDOWN_MS - (Date.now() - lastAiAt)) / 1000);
    if (waitSec > 0) {
      ctx.toast(`Espera ${waitSec}s antes de generar otro análisis.`);
      return;
    }
    if (S.busy) return;
    lastAiAt = Date.now();
    const now = Date.now();
    const { buildPayload } = await import('../lib/ai');
    const job: AiJob = {
      id: createAiJobId(),
      status: 'pending',
      tone: S.settings.aiTone === 'simple' ? 'simple' : 'technical',
      payload: buildPayload(S.analysis, S.measures, S.settings, S.cardio, S.wellbeing),
      createdAt: now,
      updatedAt: now,
      attempts: 0,
    };
    S.aiJob = job;
    try {
      await saveAiJob(job);
    } catch (e) {
      S.aiJob = undefined;
      ctx.toast(`No se pudo guardar el estado del informe: ${(e as Error).message}`);
      return;
    }
    await runAiJob(job);
  };

  const retryAi = async (): Promise<void> => {
    const S = ctx.state;
    if (S.busy) return;
    try {
      await retryAiJob();
    } catch (e) {
      ctx.toast(`No se pudo reintentar el informe IA: ${(e as Error).message}`);
    }
  };

  const dismissAi = async (): Promise<void> => {
    const S = ctx.state;
    if (S.busy) return;
    try {
      await clearAiJob();
      S.aiJob = undefined;
      ctx.render();
    } catch (e) {
      ctx.toast(`No se pudo descartar el estado del informe: ${(e as Error).message}`);
    }
  };

  const cloudLogin = async (): Promise<void> => {
    try {
      await signInGoogle();
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code !== 'auth/popup-closed-by-user') ctx.toast(`Error al iniciar sesión: ${(e as Error).message}`);
    }
  };

  const cloudSync = async (): Promise<void> => {
    await runSync(true);
  };

  const cloudLogout = async (): Promise<void> => {
    const S = ctx.state;
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
    await signOutGoogle();
    await wipeAll();
    clearSyncMeta();
    ctx.clearActiveWorkouts();
    S.user = null;
    S.lastSync = undefined;
    await ctx.reload();
    ctx.render();
    ctx.toast('Sesión cerrada en este dispositivo.');
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
    await wipeAll();
    markWipePending();
    S.measureDraft = undefined;
    ctx.clearActiveWorkouts();
    await ctx.reload();
    ctx.render();
    queueSync();
    ctx.toast('Datos borrados.');
  };

  const actions: Record<string, (el: HTMLElement) => void | Promise<void>> = {
    setAiTone: async (el) => {
      const S = ctx.state;
      const tone = arg(el) === 'simple' ? 'simple' : 'technical';
      if (S.settings.aiTone === tone) return;
      S.settings.aiTone = tone;
      await ctx.persist();
      ctx.toast(`Nivel de IA: ${tone === 'simple' ? 'Sencillo y generalista' : 'Técnico y detallado'}.`);
    },
    ai: runAi,
    aiRetry: retryAi,
    aiDismiss: dismissAi,
    cloudLogin,
    cloudSync,
    cloudLogout,
    wipe,
  };

  return { actions, runAi, retryAi, dismissAi, cloudLogin, cloudSync, cloudLogout, wipe, runSync, queueSync, initAuth, getLastSyncAt };
}
