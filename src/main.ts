import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { analyze } from './lib/analysis';
import { getAll, loadAiJob, loadSettings, saveSettings } from './lib/db';
import { isValidIsoDate } from './lib/seed';
import { hasUnsyncedChanges, markSettingsDirty } from './lib/sync';
import type { CardioRow, DailyWellbeing, DayName, Measure, StrengthRow } from './types';
import {
  MODAL_DIALOG_SELECTOR,
  MODAL_FOCUSABLE_SELECTOR,
  captureModalTrigger,
  focusSelector,
  hasModalTrigger,
  restoreModalFocus,
} from './ui/domPatches';
import { initSortableLists } from './ui/reorder';
import { esc, routineNames, todayIso, type RangeKey } from './ui/shared';
import {
  ANALYTICS_IDS,
  FIXED_TAB_IDS,
  activeTabTitle,
  isRoutineTab,
  isValidTab,
  renderMobileHeader,
  renderMobileNav,
  renderSidebar,
  syncStatusInfo,
} from './ui/shellView';
import {
  buildPerimChartConfig,
  renderAiReport,
  renderModals,
  resetCharts,
  runCalc,
  runChartJobs,
  updateChart,
  viewAdherence,
  viewBody,
  viewCalc,
  viewData,
  viewDay,
  viewHome,
  viewLog,
  viewPlan,
  viewSettings,
  viewVolume,
  viewWorkout,
  type State,
} from './ui/views';
import { arg, loadDraft, loadLive, maybeOpenInitialWizard, splitPair, type AppContext } from './app/context';
import { createImportController } from './app/importController';
import { createPlanController } from './app/planController';
import { createSyncController } from './app/syncController';
import { createWorkoutController } from './app/workoutController';

let swUpdatePending = false;
const updateSW = registerSW({
  onNeedRefresh() {
    swUpdatePending = true;
    renderSwUpdateBanner();
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
function renderToast() {
  let layer = document.getElementById('toast-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'toast-layer';
    document.body.appendChild(layer);
  }
  layer.innerHTML = S.toast
    ? `<div role="status" aria-live="polite" class="fixed inset-x-3 bottom-20 z-40 mx-auto max-w-md rounded-xl border border-electricBlue/40 bg-gray-900 p-3 text-sm text-gray-100 shadow-xl lg:bottom-6 lg:left-64">${esc(S.toast)}</div>`
    : '';
}

function toast(msg: string) {
  S.toast = msg;
  renderToast();
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    if (S.toast === msg) {
      S.toast = undefined;
      renderToast();
    }
  }, 5000);
}

function renderSwUpdateBanner() {
  let layer = document.getElementById('sw-update-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'sw-update-layer';
    layer.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-sw-act]');
      if (!btn) return;
      const act = btn.dataset.swAct;
      swUpdatePending = false;
      renderSwUpdateBanner();
      if (act === 'reload') void updateSW(true);
    });
    document.body.appendChild(layer);
  }
  layer.innerHTML = swUpdatePending
    ? `<div role="status" aria-live="polite" class="fixed inset-x-3 bottom-20 z-50 mx-auto flex max-w-md flex-wrap items-center justify-between gap-2 rounded-xl border border-electricBlue/50 bg-floatDark p-3 text-sm text-gray-100 shadow-2xl lg:bottom-6 lg:left-64">
        <span class="font-medium text-gray-200">Nueva versión disponible.</span>
        <div class="flex shrink-0 items-center gap-1.5">
          <button type="button" data-sw-act="dismiss" class="min-h-[44px] sm:min-h-[36px] rounded-lg px-2.5 text-xs font-semibold text-gray-300 hover:bg-white/10 hover:text-white">Después</button>
          <button type="button" data-sw-act="reload" class="min-h-[44px] sm:min-h-[36px] rounded-lg bg-electricBlue px-3 text-xs font-bold text-white hover:bg-blue-500">Actualizar</button>
        </div>
      </div>`
    : '';
}

function updateSyncDom() {
  const st = syncStatusInfo(S, hasUnsyncedChanges());
  root.querySelectorAll<HTMLElement>('[data-sync-badge]').forEach((el) => {
    el.textContent = st.text;
    el.className = `${el.dataset.syncBase ?? 'truncate text-[10px]'} ${st.cls}`;
  });
}

function view(): string {
  if (isRoutineTab(S, S.tab)) return viewDay(S, S.tab);
  switch (S.tab) {
    case 'home': return viewHome(S);
    case 'workout': return viewWorkout(S);
    case 'log': return viewLog(S);
    case 'plan': return viewPlan(S);
    case 'body': return viewBody(S);
    case 'volume': return viewVolume(S);
    case 'adherence': return viewAdherence(S);
    case 'calc': return viewCalc(S);
    case 'data': return viewData(S);
    default: return viewSettings(S);
  }
}

/** Re-renderiza el panel preservando posición de scroll, foco y selección de texto del control activo. */
function render() {
  const y = window.scrollY;
  const activeEl = document.activeElement;
  const activeSel = focusSelector(activeEl);
  const selStart =
    activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement ? activeEl.selectionStart : null;
  const selEnd =
    activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement ? activeEl.selectionEnd : null;
  resetCharts();
  const html = view();
  const statsText = S.strength.length ? `${S.analysis.sessions.length} sesiones · ${S.measures.length} medidas` : 'Sin sesiones aún';
  const liveCount = S.liveWorkout?.exercises.reduce((acc, e) => acc + e.sets.filter((s) => s.done && s.r > 0).length, 0) ?? 0;
  const draftCount = S.logDraft?.exercises.filter((e) => e.sets.some((s) => s.done && s.r > 0)).length ?? 0;
  const unsynced = hasUnsyncedChanges();

  root.innerHTML = `
  ${renderSidebar(S, statsText, liveCount, draftCount, unsynced)}
  ${renderMobileHeader(S, statsText, unsynced)}
  <div class="lg:pl-64">
    <main id="main-content" tabindex="-1" class="w-full space-y-4 p-2.5 pb-28 sm:p-5 lg:px-7 lg:py-6 xl:px-10 lg:pb-10 focus:outline-none"><h1 class="sr-only hidden lg:block">${esc(activeTabTitle(S))}</h1>${html}</main>
  </div>
  ${renderMobileNav(S, liveCount, draftCount, lastRoutine, lastAnalytics)}
  ${renderModals(S)}`;
  if (S.wizard?.anim) S.wizard.anim = undefined;
  runChartJobs();
  runCalc();
  window.scrollTo(0, y);
  if (activeSel) {
    const nextEl = root.querySelector<HTMLElement>(activeSel);
    nextEl?.focus({ preventScroll: true });
    if ((nextEl instanceof HTMLInputElement || nextEl instanceof HTMLTextAreaElement) && selStart != null && selEnd != null) {
      try {
        nextEl.setSelectionRange(selStart, selEnd);
      } catch {
        /* algunos inputs como number/date no admiten setSelectionRange */
      }
    }
  }
  workoutCtrl.syncRestTicker();
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
  render();
  restoreModalFocus(root, S);
  res?.(ok);
}

function askConfirm(opts: NonNullable<State['confirmModal']>): Promise<boolean> {
  if (confirmResolver) confirmResolver(false);
  if (!hasModalTrigger()) captureModalTrigger(root);
  S.confirmModal = opts;
  render();
  root.querySelector<HTMLElement>('#confirm-modal [data-act="confirmNo"], #confirm-modal button')?.focus({
    preventScroll: true,
  });
  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
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
  updateSyncDom,
  askConfirm,
  clearActiveWorkouts: () => workoutCtrl.clearActiveWorkouts(),
  addExToDraft: (name, fallbackSets, fallbackReps) => workoutCtrl.addExToDraft(name, fallbackSets, fallbackReps),
  syncWorkoutRoutineNames: (oldName, newName) => workoutCtrl.syncWorkoutRoutineNames(oldName, newName),
};

const syncCtrl = createSyncController(ctx);
const workoutCtrl = createWorkoutController(ctx);
const planCtrl = createPlanController(ctx);
const importCtrl = createImportController(ctx);

const actions: Record<string, (el: HTMLElement) => void | Promise<void>> = {
  confirmYes: () => resolveConfirm(true),
  confirmNo: () => resolveConfirm(false),
  tab: (el) => {
    setTab(arg(el));
    render();
    window.scrollTo(0, 0);
  },
  openExDetail: (el) => {
    const [day, ex] = splitPair(arg(el));
    if (!day || !ex) return;
    S.sel[day] = ex;
    setTab(day);
    render();
    window.scrollTo(0, 0);
  },
  selEx: (el) => {
    const [d, n] = splitPair(arg(el));
    S.sel[d] = n;
    render();
  },
  setDayScope: (el) => {
    const [d, mode] = splitPair(arg(el));
    (S.dayExtra ??= {})[d] = mode === 'extra';
    delete S.sel[d];
    render();
  },
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
  setExMetric: (el) => {
    const m = arg(el);
    S.exMetric = m === 'e1rm' || m === 'volume' ? m : 'top';
    render();
  },
  aiTab: (el) => {
    S.aiTab = Math.max(0, +arg(el) || 0);
    const panel = document.getElementById('ai-report');
    if (!panel) {
      render();
      return;
    }
    const activeSel = focusSelector(document.activeElement);
    panel.outerHTML = renderAiReport(S);
    if (activeSel) document.getElementById('ai-report')?.querySelector<HTMLElement>(activeSel)?.focus({ preventScroll: true });
  },
  setBodyMetric: (el) => {
    S.bodyMetric = arg(el) === 'muscle' ? 'muscle' : 'weight';
    render();
  },
  editNote: (el) => {
    const n = arg(el);
    if (!n) return;
    captureModalTrigger(root);
    S.noteModal = { exName: n, value: S.settings.notes[n] ?? '' };
    render();
    const ta = document.getElementById('noteModalInput') as HTMLTextAreaElement | null;
    ta?.focus();
    ta?.setSelectionRange(ta.value.length, ta.value.length);
  },
  closeModal: () => {
    if (!S.exModal && !S.routineModal && !S.noteModal) return;
    S.exModal = undefined;
    S.routineModal = undefined;
    S.noteModal = undefined;
    render();
    restoreModalFocus(root, S);
  },
  ...workoutCtrl.actions,
  ...syncCtrl.actions,
  ...planCtrl.actions,
  ...importCtrl.actions,
};

const changes: Record<string, (el: HTMLInputElement | HTMLSelectElement) => void | Promise<void>> = {
  selHome: (el) => {
    S.sel.home = el.value;
    render();
  },
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
  nutri: () => {
    const act = document.getElementById('nuAct') as HTMLSelectElement | null;
    const goal = document.getElementById('nuGoal') as HTMLSelectElement | null;
    if (act) (S.calcDraft ??= {}).act = act.value;
    if (goal) (S.calcDraft ??= {}).goal = goal.value;
    runCalc();
  },
  ...workoutCtrl.changes,
  ...planCtrl.changes,
  ...importCtrl.changes,
};

root.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
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
          nextTab.focus({ preventScroll: true });
          void actions[nextAct]?.(nextTab);
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
          void actions[nextAct]?.(nextOpt);
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
  const el = target?.closest<HTMLElement>('[role="button"][data-act]');
  if (!el) return;
  e.preventDefault();
  void actions[el.dataset.act!]?.(el);
});

root.addEventListener('change', async (e) => {
  const el = e.target as HTMLInputElement;
  if (el.dataset.change) {
    await changes[el.dataset.change]?.(el);
    return;
  }
  await importCtrl.handleFileChange(el);
});

root.addEventListener('focusout', (e) => {
  const el = e.target as HTMLInputElement;
  if (!(el instanceof HTMLInputElement)) return;
  workoutCtrl.handleFocusout(el);
});

root.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
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
  e.preventDefault();
  const f = e.target as HTMLFormElement;
  const fd = new FormData(f);
  if (f.id === 'f-note-modal' && S.noteModal) {
    const { exName } = S.noteModal;
    const val = String(fd.get('note') ?? '').trim();
    if (val) S.settings.notes[exName] = val;
    else delete S.settings.notes[exName];
    S.noteModal = undefined;
    await persist();
    restoreModalFocus(root, S);
    toast(val ? `Nota guardada para ${exName}` : `Nota eliminada de ${exName}`);
    return;
  }
  if (await importCtrl.handleSubmit(f, fd)) return;
  await planCtrl.handleSubmit(f, fd);
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    const dialog = document.querySelector<HTMLElement>(MODAL_DIALOG_SELECTOR);
    if (!dialog) return;
    const focusables = [...dialog.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE_SELECTOR)].filter(
      (el) => !el.closest('[hidden], [inert]'),
    );
    if (!focusables.length) {
      e.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const activeEl = document.activeElement as HTMLElement | null;
    if (!activeEl || !dialog.contains(activeEl)) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
      return;
    }
    if (e.shiftKey && activeEl === first) {
      e.preventDefault();
      last.focus();
      return;
    }
    if (!e.shiftKey && activeEl === last) {
      e.preventDefault();
      first.focus();
    }
    return;
  }
  if (e.key !== 'Escape') return;
  if (S.confirmModal) {
    resolveConfirm(false);
    return;
  }
  if (S.workoutSummary) {
    void actions.closeWorkoutSummary(root);
    return;
  }
  if (S.wizard) {
    void actions.wizardSkip(root);
    return;
  }
  if (S.exModal || S.routineModal || S.noteModal) {
    S.exModal = undefined;
    S.routineModal = undefined;
    S.noteModal = undefined;
    render();
    restoreModalFocus(root, S);
  }
});

window.addEventListener('hashchange', () => {
  const raw = initialTab();
  const next = isValidTab(S, raw) ? raw : 'home';
  if (next !== S.tab) {
    setTab(next);
    render();
  }
});

window.addEventListener('online', () => {
  updateSyncDom();
  syncCtrl.queueSync();
});
window.addEventListener('offline', () => updateSyncDom());
window.matchMedia('(min-width: 1024px)').addEventListener('change', () => render());

initSortableLists(root, async (scope, from, to) => {
  if (scope === 'log') {
    workoutCtrl.handleReorder(from, to);
  } else {
    await planCtrl.handleReorder(scope, from, to);
  }
});

reload().then(async () => {
  S.lastSync = syncCtrl.getLastSyncAt();
  maybeOpenInitialWizard(S);
  render();
  await syncCtrl.initAuth();
});
