import { clearAiJob, loadAiJob, sanitizeSettings, saveAiJob, saveSettings } from '../lib/db';
import { markSettingsDirty } from '../lib/sync';
import { humanizeError } from '../store/types';
import type { AiJob } from '../types';
import type { AppContext } from './context';

const AI_COOLDOWN_MS = 15_000;
const AI_JOB_MAX_AGE_MS = 30 * 60 * 1000;

export interface AiControllerDeps {
  readonly state: AppContext['state'];
  render: () => void;
  toast: AppContext['toast'];
  queueSync: () => void;
}

export interface AiController {
  runAi: () => Promise<void>;
  retryAi: () => Promise<void>;
  dismissAi: () => Promise<void>;
  resumeAiJob: () => Promise<void>;
  resetResumeFlag: () => void;
}

const createAiJobId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `ai-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

/** Crea el controlador de generación, reanudación y cola de errores del Coach IA. */
export function createAiController(deps: AiControllerDeps): AiController {
  let lastAiAt = 0;
  let aiResumeAttempted = false;

  async function runAiJob(job: AiJob): Promise<void> {
    const S = deps.state;
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
      deps.toast(`No se pudo guardar el estado del informe: ${humanizeError(e)}`);
      return;
    }
    S.aiJob = running;
    S.busy = 'ai';
    try {
      deps.render();
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
      deps.queueSync();
      deps.toast('Análisis generado.');
    } catch (e) {
      const message = humanizeError(e, 'No se pudo generar el análisis.');
      const failed: AiJob = { ...running, status: 'error', error: message, updatedAt: Date.now() };
      try {
        await saveAiJob(failed);
        S.aiJob = failed;
      } catch (persistError) {
        deps.toast(`Error de IA: ${message}. Además, no se pudo guardar el estado del error: ${humanizeError(persistError)}`);
      }
      deps.toast(`Error de IA: ${message}`);
    } finally {
      S.busy = undefined;
      deps.render();
    }
  }

  async function resumeAiJob(): Promise<void> {
    if (aiResumeAttempted || !deps.state.user) return;
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
      deps.state.aiJob = expired;
      deps.render();
      return;
    }
    if (job.status === 'error' || job.attempts >= 2) {
      const failed = job.status === 'error'
        ? job
        : { ...job, status: 'error' as const, error: 'La generación se interrumpió tras varios intentos. Pulsa reintentar.', updatedAt: Date.now() };
      if (failed !== job) await saveAiJob(failed);
      deps.state.aiJob = failed;
      deps.render();
      return;
    }
    lastAiAt = Date.now();
    await runAiJob(job);
  }

  const runAi = async (): Promise<void> => {
    const S = deps.state;
    if (!S.user) {
      deps.toast('Inicia sesión con Google para generar análisis con IA.');
      return;
    }
    const waitSec = Math.ceil((AI_COOLDOWN_MS - (Date.now() - lastAiAt)) / 1000);
    if (waitSec > 0) {
      deps.toast(`Espera ${waitSec}s antes de generar otro análisis.`);
      return;
    }
    if (S.busy) return;
    let buildPayload: typeof import('../lib/ai').buildPayload;
    try {
      ({ buildPayload } = await import('../lib/ai'));
    } catch (e) {
      deps.toast(`No se pudo cargar el módulo IA: ${humanizeError(e)}`);
      return;
    }
    const now = Date.now();
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
      deps.toast(`No se pudo guardar el estado del informe: ${humanizeError(e)}`);
      return;
    }
    lastAiAt = now;
    await runAiJob(job);
  };

  const retryAi = async (): Promise<void> => {
    if (deps.state.busy) return;
    try {
      const job = deps.state.aiJob ?? await loadAiJob();
      if (!job || job.status !== 'error') return;
      const now = Date.now();
      lastAiAt = now;
      await runAiJob({
        ...job,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        attempts: 0,
        error: undefined,
        startedAt: undefined,
        finishedAt: undefined,
      });
    } catch (e) {
      deps.toast(`No se pudo reintentar el informe IA: ${humanizeError(e)}`);
    }
  };

  const dismissAi = async (): Promise<void> => {
    const S = deps.state;
    if (S.busy) return;
    try {
      await clearAiJob();
      S.aiJob = undefined;
      deps.render();
    } catch (e) {
      deps.toast(`No se pudo descartar el estado del informe: ${humanizeError(e)}`);
    }
  };

  return {
    runAi,
    retryAi,
    dismissAi,
    resumeAiJob,
    resetResumeFlag: () => { aiResumeAttempted = false; },
  };
}
