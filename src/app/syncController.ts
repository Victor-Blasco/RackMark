import { sanitizeSettings, saveSettings, wipeAll } from '../lib/db';
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

const AI_COOLDOWN_MS = 15_000;

const isOnline = (): boolean => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);

export interface SyncController {
  actions: Record<string, (el: HTMLElement) => void | Promise<void>>;
  runSync: (showToast?: boolean) => Promise<void>;
  queueSync: () => void;
  initAuth: () => Promise<() => void>;
  getLastSyncAt: () => number | undefined;
}

export function createSyncController(ctx: AppContext): SyncController {
  let lastAiAt = 0;
  let syncTimer: ReturnType<typeof setTimeout> | undefined;
  let syncInFlight = false;
  let syncPending = false;

  async function runSync(showToast = false): Promise<void> {
    const S = ctx.state;
    if (!S.user) return;
    if (syncInFlight) {
      syncPending = true;
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
    try {
      const res = await syncWithCloud(S.user.uid);
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
        S.wizard && (S.settings.onboardingCompleted || S.strength.length > 0 || S.measures.length > 0),
      );
      if (wizardDismissed) {
        S.wizard = undefined;
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
    if (!ctx.state.user || !isOnline()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      void runSync(false);
    }, 600);
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
    });
  }

  const getLastSyncAt = (): number | undefined => loadSyncMeta().lastSyncAt;

  const actions: Record<string, (el: HTMLElement) => void | Promise<void>> = {
    setAiTone: async (el) => {
      const S = ctx.state;
      const tone = arg(el) === 'simple' ? 'simple' : 'technical';
      if (S.settings.aiTone === tone) return;
      S.settings.aiTone = tone;
      await ctx.persist();
      ctx.toast(`Nivel de IA: ${tone === 'simple' ? 'Sencillo y generalista' : 'Técnico y detallado'}.`);
    },
    ai: async () => {
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
      S.busy = 'ai';
      lastAiAt = Date.now();
      ctx.render();
      try {
        const { generateAnalysis } = await import('../lib/ai');
        S.settings.ai = await generateAnalysis(S.analysis, S.measures, S.settings, S.cardio, S.wellbeing);
        S.settings = sanitizeSettings(S.settings);
        S.aiTab = 0;
        await saveSettings(S.settings);
        markSettingsDirty();
        queueSync();
        ctx.toast('Análisis generado.');
      } catch (e) {
        ctx.toast(`Error de IA: ${(e as Error).message}`);
      }
      S.busy = undefined;
      ctx.render();
    },
    cloudLogin: async () => {
      try {
        await signInGoogle();
      } catch (e) {
        const code = (e as { code?: string })?.code;
        if (code !== 'auth/popup-closed-by-user') ctx.toast(`Error al iniciar sesión: ${(e as Error).message}`);
      }
    },
    cloudSync: async () => {
      await runSync(true);
    },
    cloudLogout: async () => {
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
    },
    wipe: async () => {
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
    },
  };

  return { actions, runSync, queueSync, initAuth, getLastSyncAt };
}
