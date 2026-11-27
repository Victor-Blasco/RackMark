import './style.css';
import { h, render as renderPreact } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { analyze } from './lib/analysis';
import { getAll, loadAiJob, loadSettings, loadSyncJob, sanitizeSettings, saveSettings } from './lib/db';
import { DEFAULT_SETTINGS, norm } from './lib/seed';
import { hasUnsyncedChanges, markSettingsDirty } from './lib/sync';
import { AppShell } from './components/layout/AppShell';
import { createAnalyticsActions } from './store/analyticsActions';
import { AppStoreProvider, type AppStoreValue } from './store/appStore';
import { createDataSyncActions } from './store/dataSyncActions';
import { createLogWorkoutActions } from './store/logActions';
import { ANALYTICS_IDS, FIXED_TAB_IDS, isRoutineTab, isValidTab } from './store/navigation';
import { createPlanActions } from './store/planActions';
import type { ConfirmModalOpts, ToastAction } from './store/types';
import { createWizardActions } from './store/wizardActions';
import { createLiveWorkoutActions } from './store/workoutActions';
import { createWorkoutLaunchActions } from './store/workoutLaunchActions';
import type { CardioRow, DailyWellbeing, DayName, Measure, StrengthRow } from './types';
import { initKeyboardNav } from './ui/keyboardNav';
import { initSortableLists } from './ui/reorder';
import { playRestBeep } from './ui/restAudio';
import { humanizeError, routineNames, type State } from './ui/shared';
import { applyTheme, initThemeListener } from './ui/theme';
import { loadDraft, loadLive, maybeOpenInitialWizard, saveDraft, saveLive, type AppContext } from './app/context';
import { createAiController } from './app/aiController';
import { createSyncController } from './app/syncController';

let swUpdatePending = false;
const updateSW = registerSW({
  onNeedRefresh() {
    swUpdatePending = true;
    renderChrome();
  },
});

const initialTab = () => {
  try {
    return decodeURIComponent(location.hash.slice(1)) || 'home';
  } catch {
    return location.hash.slice(1) || 'home';
  }
};

const initialSettings = structuredClone(DEFAULT_SETTINGS);
const S: State = {
  tab: initialTab(),
  strength: [],
  cardio: [],
  measures: [],
  wellbeing: [],
  settings: initialSettings,
  analysis: analyze([], initialSettings),
  sel: {},
  perimeter: 'arms',
  muscleSel: 'Pecho',
  logDraft: loadDraft(),
  liveWorkout: loadLive(),
};
let lastRoutine: DayName = 'Push';
let lastAnalytics = ANALYTICS_IDS.has(S.tab) ? S.tab : 'body';
const root = document.getElementById('app')!;
initThemeListener(() => S.settings?.theme ?? 'dark', () => render());

function downloadBrowserFile(name: string, data: string, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function setTab(tab: string) {
  S.tab = isValidTab(S, tab) ? tab : 'home';
  if (isRoutineTab(S, S.tab)) lastRoutine = S.tab;
  if (ANALYTICS_IDS.has(S.tab)) lastAnalytics = S.tab;
  const encoded = encodeURIComponent(S.tab);
  if (location.hash.slice(1) !== encoded && location.hash.slice(1) !== S.tab) {
    history.replaceState(null, '', `#${encoded}`);
  }
}

async function reload() {
  S.settings = await loadSettings();
  applyTheme(S.settings.theme ?? 'dark');
  S.aiJob = await loadAiJob();
  S.syncJob = await loadSyncJob();
  S.strength = (await getAll<StrengthRow>('strength')).sort((a, b) => a.ts - b.ts);
  S.cardio = (await getAll<CardioRow>('cardio')).sort((a, b) => a.ts - b.ts);
  S.measures = (await getAll<Measure>('measures')).sort((a, b) => a.date.localeCompare(b.date));
  S.wellbeing = (await getAll<DailyWellbeing>('wellbeing')).sort((a, b) => a.date.localeCompare(b.date));
  S.analysis = analyze(S.strength, S.settings);
  const rNames = routineNames(S.settings);
  if (!isRoutineTab(S, lastRoutine)) lastRoutine = rNames[0] ?? 'Push';
  if (isRoutineTab(S, S.tab)) lastRoutine = S.tab;
  else if (!FIXED_TAB_IDS.has(S.tab)) S.tab = 'home';
}

let toastTimer: number | undefined;
function toast(msg: string, action?: ToastAction) {
  S.toast = msg;
  S.toastAction = action
    ? {
        label: action.label,
        onAction: () => {
          clearTimeout(toastTimer);
          S.toast = undefined;
          S.toastAction = undefined;
          renderChrome();
          action.onAction();
        },
      }
    : undefined;
  renderChrome();
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    if (S.toast === msg) {
      S.toast = undefined;
      S.toastAction = undefined;
      renderChrome();
    }
  }, action ? 6000 : 5000);
}

function renderChrome() {
  renderPreact(h(RootShell, null), root);
}

function render() {
  renderChrome();
  if (S.activeModal?.type === 'wizard' && S.activeModal.draft.anim) {
    S.activeModal = { type: 'wizard', draft: { ...S.activeModal.draft, anim: undefined } };
  }
}

async function persist() {
  S.settings = sanitizeSettings(S.settings);
  applyTheme(S.settings.theme ?? 'dark');
  await saveSettings(S.settings);
  markSettingsDirty();
  S.analysis = analyze(S.strength, S.settings);
  render();
  syncCtrl.queueSync();
}

let confirmResolver: ((ok: boolean) => void) | null = null;
function resolveConfirm(ok: boolean) {
  const res = confirmResolver;
  confirmResolver = null;
  if (S.activeModal?.type === 'confirm') S.activeModal = null;
  renderChrome();
  res?.(ok);
}

function askConfirm(opts: ConfirmModalOpts): Promise<boolean> {
  if (confirmResolver) confirmResolver(false);
  S.activeModal = { type: 'confirm', ...opts };
  renderChrome();
  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
}

function closeModal() {
  if (!S.activeModal || S.activeModal.type === 'confirm') return;
  S.activeModal = null;
  renderChrome();
}

function openFixedNote(exName: string) {
  const val = S.settings.notes[exName] ?? '';
  S.activeModal = { type: 'note', exName, value: val };
  renderChrome();
}

function closeWorkoutSummary() {
  if (S.activeModal?.type !== 'workoutSummary') return;
  S.activeModal = null;
  renderChrome();
}

async function saveNoteModal(exName: string, rawNote: string) {
  const val = rawNote.trim();
  const { [exName]: _removed, ...restNotes } = S.settings.notes;
  const nextNotes = val ? { ...restNotes, [exName]: val } : restNotes;
  S.settings = { ...S.settings, notes: nextNotes };
  if (S.activeModal?.type === 'note') S.activeModal = null;
  await persist();
  toast(val ? `Nota guardada para ${exName}` : `Nota eliminada de ${exName}`);
}

const workoutLaunch = createWorkoutLaunchActions({
  getState: () => S,
  setTab,
  render,
  saveDraft,
  saveLive,
  askConfirm,
});

const ctx: AppContext = {
  state: S,
  render,
  reload,
  toast,
  askConfirm,
  clearActiveWorkouts: workoutLaunch.clearActiveWorkouts,
};

const syncCtrl = createSyncController(ctx, {
  onUserReady: () => {
    void aiCtrl.refreshQuota();
    void aiCtrl.resumeAiJob().catch((e) => toast(`No se pudo recuperar el informe IA: ${humanizeError(e)}`));
  },
  onSessionReset: () => aiCtrl.resetResumeFlag(),
});

const aiCtrl = createAiController({
  state: S,
  render,
  toast,
  queueSync: () => syncCtrl.queueSync(),
});

const liveActions = createLiveWorkoutActions({
  getState: () => S,
  saveLiveOnly: (live) => {
    S.liveWorkout = live;
    saveLive(live);
  },
  commitLive: (live) => {
    S.liveWorkout = live;
    saveLive(live);
    renderChrome();
  },
  reload,
  setTab: (tab) => {
    setTab(tab);
    render();
  },
  queueSync: () => syncCtrl.queueSync(),
  toast,
  askConfirm,
  openNoteModal: openFixedNote,
  setLoadType: (exName, loadType) => {
    const nk = norm(exName);
    if (!nk) return;
    const prev = S.settings.loadTypes ?? {};
    const next = { ...prev, [nk]: loadType };
    S.settings = { ...S.settings, loadTypes: next };
    const lbl = loadType === 'weighted' ? 'Peso corporal (+lastre)' : loadType === 'assisted' ? 'Asistido (−kg)' : 'Carga externa';
    toast(`${exName}: ${lbl}.`);
    void persist();
  },
  showSummary: (summary) => {
    S.activeModal = { type: 'workoutSummary', summary };
    render();
  },
});

const wizardActions = createWizardActions({
  getState: () => S,
  getLastRoutine: () => lastRoutine,
  setLastRoutine: (day) => {
    lastRoutine = day;
  },
  persist,
  reload,
  render,
  syncWorkoutRoutineNames: workoutLaunch.syncWorkoutRoutineNames,
  queueSync: () => syncCtrl.queueSync(),
  toast,
  openWizardModal: (draft) => {
    S.activeModal = { type: 'wizard', draft };
    renderChrome();
  },
  closeWizardModal: () => {
    if (S.activeModal?.type === 'wizard') S.activeModal = null;
    renderChrome();
  },
});

const logActions = createLogWorkoutActions({
  getState: () => S,
  saveDraftOnly: (draft) => {
    S.logDraft = draft;
    saveDraft(draft);
  },
  commitDraft: (draft) => {
    S.logDraft = draft;
    saveDraft(draft);
    renderChrome();
  },
  reload,
  setTab: navigateTab,
  queueSync: () => syncCtrl.queueSync(),
  toast,
  askConfirm,
  openNoteModal: openFixedNote,
  onStartLiveTab: () => navigateTab('workout'),
  onOpenExercisePicker: () => {
    S.activeModal = { type: 'logExercisePicker' };
    renderChrome();
  },
});

const planActions = createPlanActions({
  getState: () => S,
  getLastRoutine: () => lastRoutine,
  setLastRoutine: (day) => {
    lastRoutine = day;
  },
  persist,
  render,
  setTab,
  navigateTab,
  syncWorkoutRoutineNames: workoutLaunch.syncWorkoutRoutineNames,
  addExToDraft: (name, fallbackSets, fallbackReps) => logActions.addExerciseByName(name, fallbackSets, fallbackReps),
  askConfirm,
  toast,
  startWorkoutDay: workoutLaunch.startWorkoutDay,
  openLogDay: workoutLaunch.openLogDay,
  runAiAnalysis: () => void aiCtrl.runAi(),
  retryAiAnalysis: () => void aiCtrl.retryAi(),
  dismissAiJob: () => void aiCtrl.dismissAi(),
  openWizard: () => wizardActions.open(),
  saveDraft,
  saveLive,
});

const analyticsActions = createAnalyticsActions({
  getState: () => S,
  persist,
  reload,
  render,
  queueSync: () => syncCtrl.queueSync(),
  toast,
  askConfirm,
});

const openAuthModal = (mode: 'login' | 'signup' = 'login') => {
  S.activeModal = { type: 'auth', mode };
  renderChrome();
};

const dataSyncActions = createDataSyncActions({
  getState: () => S,
  persist,
  reload,
  render,
  queueSync: () => syncCtrl.queueSync(),
  toast,
  downloadFile: downloadBrowserFile,
  wipeAllData: syncCtrl.wipe,
  openAuthModal,
  cloudLogin: syncCtrl.cloudLogin,
  cloudEmailLogin: syncCtrl.cloudEmailLogin,
  cloudEmailSignUp: syncCtrl.cloudEmailSignUp,
  cloudResetPassword: syncCtrl.cloudResetPassword,
  cloudResendVerification: syncCtrl.cloudResendVerification,
  cloudCheckEmailVerified: syncCtrl.cloudCheckEmailVerified,
  cloudSync: syncCtrl.cloudSync,
  cloudLogout: syncCtrl.cloudLogout,
  cloudDeleteAccount: syncCtrl.cloudDeleteAccount,
});

function navigateTab(tab: string) {
  setTab(tab);
  render();
  window.scrollTo(0, 0);
}

function handleRestExpire() {
  try { navigator?.vibrate?.([40, 40, 40]); } catch { /* opcional */ }
  playRestBeep();
  if (S.tab !== 'workout') toast('Descanso completado · listo para la siguiente serie.');
}

function RootShell() {
  const storeValue: AppStoreValue = {
    state: S,
    lastRoutine,
    lastAnalytics,
    unsynced: hasUnsyncedChanges(),
    swUpdatePending,
    setTab: navigateTab,
    cloudLogin: () => openAuthModal('login'),
    resolveConfirm,
    closeModal,
    saveNoteModal,
    closeWorkoutSummary,
    dismissSwUpdate: () => {
      swUpdatePending = false;
      renderChrome();
    },
    reloadSwUpdate: () => {
      swUpdatePending = false;
      renderChrome();
      void updateSW(true).catch((e) => toast(`No se pudo actualizar la app: ${humanizeError(e)}`));
    },
    openFixedNote,
    live: liveActions,
    log: logActions,
    plan: planActions,
    wizard: wizardActions,
    analytics: analyticsActions,
    dataSync: dataSyncActions,
  };
  return h(AppStoreProvider, { value: storeValue, children: h(AppShell, { onRestExpire: handleRestExpire }) });
}

initKeyboardNav(root);

window.addEventListener('hashchange', () => {
  const raw = initialTab();
  const next = isValidTab(S, raw) ? raw : 'home';
  if (next !== S.tab) navigateTab(next);
});

window.addEventListener('online', () => {
  renderChrome();
  syncCtrl.queueSync();
});
window.addEventListener('offline', () => renderChrome());

initSortableLists(root, async (scope, from, to) => {
  try {
    if (scope === 'log') logActions.reorderExercises(from, to);
    else if (scope.startsWith('rt:')) await planActions.reorderRoutineRows(scope.slice(3), from, to);
  } catch (e) {
    toast(`No se pudo guardar el orden: ${humanizeError(e)}`);
  }
});

reload()
  .then(async () => {
    S.lastSync = syncCtrl.getLastSyncAt();
    maybeOpenInitialWizard(S);
    render();
    await syncCtrl.initAuth();
  })
  .catch((e) => {
    renderChrome();
    toast(`No se pudieron cargar los datos locales: ${humanizeError(e)}`);
  });
