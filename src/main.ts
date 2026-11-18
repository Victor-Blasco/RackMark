import './style.css';
import { h, render as renderPreact } from 'preact';
import { useCallback } from 'preact/hooks';
import { registerSW } from 'virtual:pwa-register';
import { analyze } from './lib/analysis';
import { getAll, loadAiJob, loadSettings, loadSyncJob, saveSettings } from './lib/db';
import { isValidIsoDate } from './lib/seed';
import { hasUnsyncedChanges, markSettingsDirty } from './lib/sync';
import { AppShell } from './components/layout/AppShell';
import { AppStoreProvider, type AppStoreValue } from './store/appStore';
import { ANALYTICS_IDS, FIXED_TAB_IDS, isRoutineTab, isValidTab } from './store/navigation';
import { createLogWorkoutActions } from './store/logActions';
import { createPlanActions } from './store/planActions';
import { createWizardActions } from './store/wizardActions';
import { createLiveWorkoutActions } from './store/workoutActions';
import type { CardioRow, DailyWellbeing, DayName, Measure, StrengthRow } from './types';
import { playRestBeep } from './ui/domPatches';
import { initSortableLists } from './ui/reorder';
import { inRange, resetCharts, resolveRange, routineNames, runChartJobs, todayIso, updateChart, type RangeKey } from './ui/shared';
import {
  buildCompChartConfig,
  buildPerimChartConfig,
  runCalc,
  viewAdherence,
  viewBody,
  viewCalc,
  viewData,
  viewSettings,
  viewVolume,
  type State,
} from './ui/views';
import { arg, loadDraft, loadLive, maybeOpenInitialWizard, saveDraft, saveLive, splitPair, type AppContext } from './app/context';
import { createImportController } from './app/importController';
import { createPlanController } from './app/planController';
import { createSyncController } from './app/syncController';
import { createWorkoutController } from './app/workoutController';

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

const S = {
  tab: initialTab(),
  sel: {},
  perimeter: 'arms',
  muscleSel: 'Pecho',
  logDraft: loadDraft(),
  liveWorkout: loadLive(),
} as State;
let lastRoutine: DayName = 'Push';
let lastAnalytics = ANALYTICS_IDS.has(S.tab) ? S.tab : 'body';
const root = document.getElementById('app')!;
let cachedLegacyHtml = '';
let legacyVersion = 0;

function setTab(tab: string) {
  S.tab = isValidTab(S, tab) ? tab : 'home';
  if (isRoutineTab(S, S.tab)) lastRoutine = S.tab;
  if (ANALYTICS_IDS.has(S.tab)) lastAnalytics = S.tab;
  const encoded = encodeURIComponent(S.tab);
  if (location.hash.slice(1) !== encoded && location.hash.slice(1) !== S.tab) history.replaceState(null, '', `#${encoded}`);
}

async function reload() {
  S.settings = await loadSettings();
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
function toast(msg: string) {
  S.toast = msg;
  renderChrome();
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    if (S.toast === msg) {
      S.toast = undefined;
      renderChrome();
    }
  }, 5000);
}

const isPreactTab = (tab: string): boolean =>
  tab === 'home' || tab === 'workout' || tab === 'log' || tab === 'plan' || isRoutineTab(S, tab);

function legacyViewHtml(): string {
  switch (S.tab) {
    case 'body': return viewBody(S);
    case 'volume': return viewVolume(S);
    case 'adherence': return viewAdherence(S);
    case 'calc': return viewCalc(S);
    case 'data': return viewData(S);
    default: return viewSettings(S);
  }
}

function onLegacyBridgeMount() {
  runChartJobs();
  runCalc();
}

function renderChrome() {
  mountApp();
}

function render() {
  if (!isPreactTab(S.tab)) {
    resetCharts();
    cachedLegacyHtml = legacyViewHtml();
    legacyVersion++;
  } else {
    cachedLegacyHtml = '';
  }
  mountApp();
  if (S.wizard?.anim) S.wizard.anim = undefined;
}

async function persist() {
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
  S.confirmModal = undefined;
  if (S.activeModal?.type === 'confirm') S.activeModal = null;
  renderChrome();
  res?.(ok);
}

function askConfirm(opts: NonNullable<State['confirmModal']>): Promise<boolean> {
  if (confirmResolver) confirmResolver(false);
  S.confirmModal = opts;
  S.activeModal = { type: 'confirm', ...opts };
  renderChrome();
  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
}

function closeModal() {
  if (!S.exModal && !S.routineModal && !S.noteModal && !S.activeModal) return;
  S.exModal = undefined;
  S.routineModal = undefined;
  S.noteModal = undefined;
  if (S.activeModal?.type !== 'confirm') S.activeModal = null;
  renderChrome();
}

function openFixedNote(exName: string) {
  const val = S.settings.notes[exName] ?? '';
  S.noteModal = { exName, value: val };
  S.activeModal = { type: 'note', exName, value: val };
  renderChrome();
}

function closeWorkoutSummary() {
  if (!S.workoutSummary && S.activeModal?.type !== 'workoutSummary') return;
  S.workoutSummary = undefined;
  if (S.activeModal?.type === 'workoutSummary') S.activeModal = null;
  renderChrome();
}

async function saveNoteModal(exName: string, rawNote: string) {
  const val = rawNote.trim();
  if (val) S.settings.notes[exName] = val;
  else delete S.settings.notes[exName];
  S.noteModal = undefined;
  if (S.activeModal?.type === 'note') S.activeModal = null;
  await persist();
  toast(val ? `Nota guardada para ${exName}` : `Nota eliminada de ${exName}`);
}

const ctx: AppContext = {
  state: S,
  root,
  render,
  reload,
  persist,
  toast,
  setTab,
  getLastRoutine: () => lastRoutine,
  setLastRoutine: (day) => {
    lastRoutine = day;
  },
  queueSync: () => syncCtrl.queueSync(),
  updateSyncDom: renderChrome,
  askConfirm,
  clearActiveWorkouts: () => workoutCtrl.clearActiveWorkouts(),
  addExToDraft: (name, fallbackSets, fallbackReps) => workoutCtrl.addExToDraft(name, fallbackSets, fallbackReps),
  syncWorkoutRoutineNames: (oldName, newName) => workoutCtrl.syncWorkoutRoutineNames(oldName, newName),
};

const syncCtrl = createSyncController(ctx);
const workoutCtrl = createWorkoutController(ctx);
const planCtrl = createPlanController(ctx);
const importCtrl = createImportController(ctx);

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
  showSummary: (summary) => {
    S.workoutSummary = summary;
    S.activeModal = { type: 'workoutSummary', summary };
    render();
    syncCtrl.queueSync();
  },
});

const startWorkoutDay = async (day?: DayName) => {
  await workoutCtrl.actions.startWorkout({ dataset: { arg: day ?? '' } } as unknown as HTMLElement);
};

const openLogDay = async (day?: DayName) => {
  await workoutCtrl.actions.goLog({ dataset: { arg: day ?? '' } } as unknown as HTMLElement);
};

const wizardActions = createWizardActions({
  getState: () => S,
  getLastRoutine: () => lastRoutine,
  setLastRoutine: (day) => {
    lastRoutine = day;
  },
  persist,
  reload,
  render,
  syncWorkoutRoutineNames: (oldName, newName) => workoutCtrl.syncWorkoutRoutineNames(oldName, newName),
  queueSync: () => syncCtrl.queueSync(),
  toast,
  openWizardModal: (draft) => {
    S.wizard = draft;
    S.activeModal = { type: 'wizard', draft };
    renderChrome();
  },
  closeWizardModal: () => {
    S.wizard = undefined;
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
  onSearchChange: (q) => {
    S.logAddQuery = q;
    renderChrome();
  },
  onStartLiveTab: () => navigateTab('workout'),
  onOpenNewExerciseModal: () => planActions.openExerciseModal({ fromLog: true }),
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
  syncWorkoutRoutineNames: (oldName, newName) => workoutCtrl.syncWorkoutRoutineNames(oldName, newName),
  addExToDraft: (name, fallbackSets, fallbackReps) => logActions.addExerciseByName(name, fallbackSets, fallbackReps),
  askConfirm,
  toast,
  startWorkoutDay,
  openLogDay,
  runAiAnalysis: () => void planCtrl.actions.ai(root),
  retryAiAnalysis: () => void planCtrl.actions.aiRetry(root),
  dismissAiJob: () => void planCtrl.actions.aiDismiss(root),
  openWizard: () => wizardActions.open(),
  closeModal,
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
  const mountBridge = useCallback(() => onLegacyBridgeMount(), []);
  const getLegacyHtml = useCallback(() => cachedLegacyHtml, []);
  const storeValue: AppStoreValue = {
    state: S,
    lastRoutine,
    lastAnalytics,
    unsynced: hasUnsyncedChanges(),
    swUpdatePending,
    setTab: navigateTab,
    cloudLogin: () => void syncCtrl.actions.cloudLogin(root),
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
      void updateSW(true);
    },
    openFixedNote,
    live: liveActions,
    log: logActions,
    plan: planActions,
    wizard: wizardActions,
    renderLegacyViewHtml: getLegacyHtml,
    legacyVersion,
    onLegacyBridgeMount: mountBridge,
  };
  return h(AppStoreProvider, { value: storeValue, children: h(AppShell, { onRestExpire: handleRestExpire }) });
}

function mountApp() {
  renderPreact(h(RootShell, null), root);
}

const actions: Record<string, (el: HTMLElement) => void | Promise<void>> = {
  ...workoutCtrl.actions,
  ...syncCtrl.actions,
  ...planCtrl.actions,
  ...importCtrl.actions,
  confirmYes: () => resolveConfirm(true),
  confirmNo: () => resolveConfirm(false),
  tab: (el) => navigateTab(arg(el)),
  setRange: (el) => {
    const [scope, key] = splitPair(arg(el));
    (S.ranges ??= {})[scope] = key as RangeKey;
    if (key === 'Custom') {
      const cur = ((S.customRanges ??= {})[scope] ??= {});
      if (!cur.from && !cur.to) {
        cur.from = todayIso(new Date(Date.now() - 30 * 864e5));
        cur.to = todayIso();
      }
    }
    render();
  },
  selMuscle: (el) => {
    S.muscleSel = arg(el);
    render();
  },
  setBodyMetric: (el) => {
    S.bodyMetric = arg(el) === 'muscle' ? 'muscle' : 'weight';
    const bounds = resolveRange(S, 'body');
    const cfg = buildCompChartConfig(S.measures.filter((m) => inRange(m.date, bounds)), S.bodyMetric);
    if (!cfg || !updateChart('c-comp', cfg)) render();
  },
  editNote: (el) => {
    const n = arg(el);
    if (n) openFixedNote(n);
  },
  closeModal: () => closeModal(),
  openWizard: () => wizardActions.open(),
};

const changes: Record<string, (el: HTMLInputElement | HTMLSelectElement) => void | Promise<void>> = {
  rangeFrom: (el) => {
    const scope = arg(el);
    if (el.value && !isValidIsoDate(el.value)) {
      el.value = S.customRanges?.[scope]?.from ?? '';
      return;
    }
    ((S.customRanges ??= {})[scope] ??= {}).from = el.value || undefined;
    render();
  },
  rangeTo: (el) => {
    const scope = arg(el);
    if (el.value && !isValidIsoDate(el.value)) {
      el.value = S.customRanges?.[scope]?.to ?? '';
      return;
    }
    ((S.customRanges ??= {})[scope] ??= {}).to = el.value || undefined;
    render();
  },
  selPerim: (el) => {
    S.perimeter = el.value;
    const cfg = buildPerimChartConfig(S);
    if (!cfg || !updateChart('c-perim', cfg)) render();
  },
  calcPreset: (el) => {
    const [w, r] = el.value.split('|');
    (document.getElementById('calcW') as HTMLInputElement).value = w;
    (document.getElementById('calcR') as HTMLInputElement).value = r;
    (S.calcDraft ??= {}).w = w;
    S.calcDraft.r = r;
    runCalc();
  },
  nutriAct: (el) => {
    (S.calcDraft ??= {}).act = arg(el);
    const input = document.getElementById('nuAct') as HTMLInputElement | null;
    if (input) input.value = arg(el);
    for (const button of root.querySelectorAll<HTMLElement>('[data-act="nutriAct"]')) {
      button.setAttribute('aria-checked', String(button.dataset.arg === arg(el)));
      button.classList.toggle('border-electricBlue', button.dataset.arg === arg(el));
      button.classList.toggle('bg-electricBlue/15', button.dataset.arg === arg(el));
    }
    runCalc();
  },
  nutriGoal: (el) => {
    (S.calcDraft ??= {}).goal = arg(el);
    const input = document.getElementById('nuGoal') as HTMLInputElement | null;
    if (input) input.value = arg(el);
    for (const button of root.querySelectorAll<HTMLElement>('[data-act="nutriGoal"]')) {
      button.setAttribute('aria-checked', String(button.dataset.arg === arg(el)));
      button.classList.toggle('border-electricBlue', button.dataset.arg === arg(el));
      button.classList.toggle('bg-electricBlue/15', button.dataset.arg === arg(el));
    }
    runCalc();
  },
  nutriMeals: (el) => {
    (S.calcDraft ??= {}).meals = arg(el);
    const input = document.getElementById('nuMeals') as HTMLInputElement | null;
    if (input) input.value = arg(el);
    for (const button of root.querySelectorAll<HTMLElement>('[data-act="nutriMeals"]')) {
      const active = button.dataset.arg === arg(el);
      button.setAttribute('aria-checked', String(active));
      button.classList.toggle('bg-electricBlue', active);
      button.classList.toggle('text-white', active);
      button.classList.toggle('text-gray-400', !active);
      button.classList.toggle('hover:text-white', !active);
    }
    runCalc();
  },
  nutri: () => {
    const act = document.getElementById('nuAct') as HTMLSelectElement | null;
    const goal = document.getElementById('nuGoal') as HTMLSelectElement | null;
    const protein = document.getElementById('nuProtein') as HTMLSelectElement | null;
    const fat = document.getElementById('nuFat') as HTMLSelectElement | null;
    if (act) (S.calcDraft ??= {}).act = act.value;
    if (goal) (S.calcDraft ??= {}).goal = goal.value;
    if (protein) (S.calcDraft ??= {}).protein = protein.value;
    if (fat) (S.calcDraft ??= {}).fat = fat.value;
    runCalc();
  },
  ...workoutCtrl.changes,
  ...planCtrl.changes,
  ...importCtrl.changes,
};

const isLegacyEvent = (target: EventTarget | null): target is HTMLElement =>
  target instanceof HTMLElement && Boolean(target.closest('[data-legacy-view], [data-legacy-modal]'));

root.addEventListener('click', (e) => {
  if (!isLegacyEvent(e.target)) return;
  const el = e.target.closest<HTMLElement>('[data-act]');
  if (el) void actions[el.dataset.act!]?.(el);
});

root.addEventListener('keydown', (e) => {
  const target = e.target as HTMLElement | null;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End') {
    const tab = target?.closest<HTMLElement>('[role="tab"]');
    const tablist = tab?.closest<HTMLElement>('[role="tablist"]');
    if (tab && tablist) {
      const tabs = [...tablist.querySelectorAll<HTMLElement>('[role="tab"]')];
      const idx = tabs.indexOf(tab);
      if (idx !== -1 && tabs.length > 0) {
        const nextIdx = e.key === 'ArrowRight'
          ? (idx + 1) % tabs.length
          : e.key === 'ArrowLeft'
            ? (idx - 1 + tabs.length) % tabs.length
            : e.key === 'Home'
              ? 0
              : tabs.length - 1;
        const nextTab = tabs[nextIdx];
        const nextAct = nextTab?.dataset.act;
        if (nextTab && nextAct) {
          e.preventDefault();
          if (target?.closest('[data-legacy-view], [data-legacy-modal]')) void actions[nextAct]?.(nextTab);
          else nextTab.click();
          const lbl = tablist.getAttribute('aria-label');
          const listSel = lbl ? `[role="tablist"][aria-label="${CSS.escape(lbl)}"]` : '[role="tablist"]';
          const nextArg = nextTab.dataset.arg != null ? `[data-arg="${CSS.escape(nextTab.dataset.arg)}"]` : '';
          root.querySelector<HTMLElement>(`${listSel} [data-act="${CSS.escape(nextAct)}"]${nextArg}`)?.focus({
            preventScroll: true,
          });
          return;
        }
      }
    }
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
    const opt = target?.closest<HTMLElement>('[role="listbox"] [role="option"]');
    const listbox = opt?.closest<HTMLElement>('[role="listbox"]');
    if (opt && listbox) {
      const options = [...listbox.querySelectorAll<HTMLElement>('[role="option"]')];
      const idx = options.indexOf(opt);
      if (idx !== -1 && options.length > 0) {
        const nextIdx = e.key === 'ArrowDown'
          ? (idx + 1) % options.length
          : e.key === 'ArrowUp'
            ? (idx - 1 + options.length) % options.length
            : e.key === 'Home'
              ? 0
              : options.length - 1;
        const nextOpt = options[nextIdx];
        const nextAct = nextOpt?.dataset.act;
        if (nextOpt && nextAct) {
          e.preventDefault();
          nextOpt.focus({ preventScroll: true });
          if (target?.closest('[data-legacy-view], [data-legacy-modal]')) void actions[nextAct]?.(nextOpt);
          else nextOpt.click();
          const lbl = listbox.getAttribute('aria-label');
          const listSel = lbl ? `[role="listbox"][aria-label="${CSS.escape(lbl)}"]` : '[role="listbox"]';
          const freshListbox = root.querySelector<HTMLElement>(listSel);
          const freshOpt = (nextOpt.id
            ? freshListbox?.querySelector<HTMLElement>(`#${CSS.escape(nextOpt.id)}`)
            : undefined) ?? freshListbox?.querySelectorAll<HTMLElement>('[role="option"]')[nextIdx];
          freshOpt?.focus({ preventScroll: true });
          freshOpt?.scrollIntoView({ block: 'nearest' });
          return;
        }
      }
    }
  }
  if (e.key !== 'Enter' && e.key !== ' ') return;
  if (!isLegacyEvent(target)) return;
  const el = target.closest<HTMLElement>('[role="button"][data-act]');
  if (!el) return;
  e.preventDefault();
  void actions[el.dataset.act!]?.(el);
});

root.addEventListener('change', async (e) => {
  if (!isLegacyEvent(e.target)) return;
  const el = e.target as HTMLInputElement;
  if (el.dataset.change) {
    await changes[el.dataset.change]?.(el);
    return;
  }
  await importCtrl.handleFileChange(el);
});

root.addEventListener('focusout', (e) => {
  if (!isLegacyEvent(e.target) || !(e.target instanceof HTMLInputElement)) return;
  workoutCtrl.handleFocusout(e.target);
});

root.addEventListener('input', (e) => {
  if (!isLegacyEvent(e.target) || !(e.target instanceof HTMLInputElement)) return;
  const el = e.target;
  if (el.dataset.input === 'homeExSearch') {
    S.homeExQuery = el.value;
    render();
    return;
  }
  if (el.dataset.input === 'calc') {
    if (el.id === 'calcW') (S.calcDraft ??= {}).w = el.value;
    else if (el.id === 'calcR') (S.calcDraft ??= {}).r = el.value;
    else if (el.id === 'calcRir') (S.calcDraft ??= {}).rir = el.value;
    runCalc();
    return;
  }
  if (planCtrl.handleInput(el)) return;
  if (importCtrl.handleInput(el)) return;
  workoutCtrl.handleInput(el);
});

root.addEventListener('submit', async (e) => {
  if (!isLegacyEvent(e.target)) return;
  e.preventDefault();
  const f = e.target as HTMLFormElement;
  const fd = new FormData(f);
  if (await importCtrl.handleSubmit(f, fd)) return;
  await planCtrl.handleSubmit(f, fd);
});

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
  if (scope === 'log') logActions.reorderExercises(from, to);
  else if (scope.startsWith('rt:')) await planActions.reorderRoutineRows(scope.slice(3), from, to);
  else await planCtrl.handleReorder(scope, from, to);
});

reload().then(async () => {
  S.lastSync = syncCtrl.getLastSyncAt();
  maybeOpenInitialWizard(S);
  render();
  await syncCtrl.initAuth();
});
