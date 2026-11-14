import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { analyze } from './lib/analysis';
import { generateAnalysis } from './lib/ai';
import { deleteKey, exportBackup, getAll, importBackup, loadSettings, mergeWellbeing, parseBackup, putMany, saveSettings, wipeAll } from './lib/db';
import { consumeRedirectAuth, signInGoogle, signOutGoogle, subscribeAuth } from './lib/firebase';
import { clearSyncMeta, hasUnsyncedChanges, loadSyncMeta, markBucketDeletes, markBucketUpserts, markSettingsDirty, markWipePending, syncWithCloud } from './lib/sync';
import { importSamsungFiles } from './lib/samsung';
import { parseMeasuresCsv } from './lib/measures';
import { BASIC_MEASURE_KEYS, MEASURE_FIELDS, type CardioRow, type DailyWellbeing, type DayName, type LogDraft, type Measure, type RoutineEx, type StrengthRow } from './types';
import { ROUTINE_COLORS, ROUTINE_TEMPLATES, norm } from './lib/seed';
import { icon, type IconName } from './ui/icons';
import { allExerciseNames } from './ui/logView';
import { defaultSetsForEx, initLogDraft, renderAiReport, renderModals, resetCharts, runChartJobs, runCalc, viewAdherence, viewBody, viewCalc, viewData, viewDay, viewHome, viewLog, viewPlan, viewSettings, viewVolume, type State } from './ui/views';
import { esc, routineColor, routineNames, type RangeKey } from './ui/shared';

registerSW({ immediate: true });

const ANALYTICS_TABS: { id: string; label: string; icon: IconName }[] = [
  { id: 'body', label: 'Cuerpo', icon: 'body' },
  { id: 'volume', label: 'Volumen', icon: 'chart' },
  { id: 'adherence', label: 'Adherencia', icon: 'calendar' },
  { id: 'calc', label: 'Calculadoras', icon: 'calc' },
];
const SYSTEM_TABS = [
  { id: 'settings', label: 'Cuenta y IA' },
  { id: 'data', label: 'Datos e importar' },
];
const TAB_TITLES: Record<string, string> = {
  home: 'Resumen',
  log: 'Registrar entreno',
  plan: 'Plan y rutinas',
  body: 'Cuerpo',
  volume: 'Volumen',
  adherence: 'Adherencia',
  calc: 'Calculadoras',
  data: 'Datos e importación',
  settings: 'Cuenta y ajustes',
};
const ANALYTICS_IDS = new Set<string>(ANALYTICS_TABS.map((t) => t.id));
const SYSTEM_IDS = new Set<string>(SYSTEM_TABS.map((t) => t.id));
const FIXED_TAB_IDS = new Set<string>(Object.keys(TAB_TITLES));
const RESERVED_ROUTINE_NORMS = new Set([...FIXED_TAB_IDS, 'libre'].map((x) => norm(x)));
const splitPair = (raw: string): [string, string] => {
  const sep = raw.lastIndexOf('|');
  return sep < 0 ? [raw, ''] : [raw.slice(0, sep), raw.slice(sep + 1)];
};
const initialTab = () => {
  try { return decodeURIComponent(location.hash.slice(1)) || 'home'; }
  catch { return location.hash.slice(1) || 'home'; }
};

const DRAFT_KEY = 'gymapp_log_draft';
function loadDraft(): LogDraft | undefined {
  try { const raw = localStorage.getItem(DRAFT_KEY); return raw ? (JSON.parse(raw) as LogDraft) : undefined; }
  catch { return undefined; }
}
function saveDraft(d?: LogDraft) {
  try { if (d) localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); else localStorage.removeItem(DRAFT_KEY); }
  catch { /* ignore quota errors */ }
}

const S = { tab: initialTab(), sel: {}, perimeter: 'arms', muscleSel: 'Pecho', logDraft: loadDraft() } as State;
const isRoutineTab = (tab: string) => Boolean(S.settings?.routines?.[tab]);
const isValidTab = (tab: string) => FIXED_TAB_IDS.has(tab) || isRoutineTab(tab);
let lastRoutine: DayName = 'Push';
let lastAnalytics = ANALYTICS_IDS.has(S.tab) ? S.tab : 'body';
const root = document.getElementById('app')!;

function setTab(tab: string) {
  S.tab = isValidTab(tab) ? tab : 'home';
  if (isRoutineTab(S.tab)) lastRoutine = S.tab;
  if (ANALYTICS_IDS.has(S.tab)) lastAnalytics = S.tab;
  const encoded = encodeURIComponent(S.tab);
  if (location.hash.slice(1) !== encoded && location.hash.slice(1) !== S.tab) history.replaceState(null, '', `#${encoded}`);
}

async function reload() {
  S.settings = await loadSettings();
  S.strength = (await getAll<StrengthRow>('strength')).sort((a, b) => a.ts - b.ts);
  S.cardio = (await getAll<CardioRow>('cardio')).sort((a, b) => a.ts - b.ts);
  S.measures = (await getAll<Measure>('measures')).sort((a, b) => a.date.localeCompare(b.date));
  S.wellbeing = (await getAll<DailyWellbeing>('wellbeing')).sort((a, b) => a.date.localeCompare(b.date));
  S.analysis = analyze(S.strength, S.settings);
  const rNames = routineNames(S.settings);
  if (!isRoutineTab(lastRoutine)) lastRoutine = rNames[0] ?? 'Push';
  if (isRoutineTab(S.tab)) lastRoutine = S.tab;
  else if (!FIXED_TAB_IDS.has(S.tab)) S.tab = 'home';
}

function toast(msg: string) {
  S.toast = msg; render();
  setTimeout(() => { if (S.toast === msg) { S.toast = undefined; render(); } }, 5000);
}

function view(): string {
  if (isRoutineTab(S.tab)) return viewDay(S, S.tab);
  switch (S.tab) {
    case 'home': return viewHome(S);
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

function focusSelector(el: Element | null): string | null {
  if (!(el instanceof HTMLElement)) return null;
  if (el.id) return `#${CSS.escape(el.id)}`;
  if (el.dataset.act) {
    const argVal = el.dataset.arg != null ? `[data-arg="${CSS.escape(el.dataset.arg)}"]` : '';
    return `[data-act="${CSS.escape(el.dataset.act)}"]${argVal}`;
  }
  if (el.dataset.change) {
    const argVal = el.dataset.arg != null ? `[data-arg="${CSS.escape(el.dataset.arg)}"]` : '';
    return `[data-change="${CSS.escape(el.dataset.change)}"]${argVal}`;
  }
  return null;
}

function renderSidebar(statsText: string, draftCount: number): string {
  const routineBtns = routineNames(S.settings).map((id, idx) => {
    const active = S.tab === id;
    const count = (S.settings.routines[id] ?? []).length;
    const col = routineColor(id, S.settings, idx);
    const sub = S.settings.routineMeta?.[id]?.sub;
    return `<button data-act="tab" data-arg="${esc(id)}" ${active ? 'aria-current="page"' : ''} class="nav-item ${active ? 'nav-item-on' : ''}">
      <span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background-color:${col}"></span>
      <span class="flex-1 truncate text-left">${esc(id)}${sub ? ` <span class="text-xs font-normal text-gray-500">· ${esc(sub)}</span>` : ''}</span>
      <span class="font-mono text-[11px] text-gray-500 tabular-nums">${count}</span>
    </button>`;
  }).join('');
  const analyticsBtns = ANALYTICS_TABS.map((a) => {
    const active = S.tab === a.id;
    return `<button data-act="tab" data-arg="${a.id}" ${active ? 'aria-current="page"' : ''} class="nav-item ${active ? 'nav-item-on' : ''}">
      ${icon(a.icon, 'h-4 w-4')}
      <span>${a.label}</span>
    </button>`;
  }).join('');
  const unmappedCount = S.analysis.unmapped.length;
  const userInitial = (S.user?.displayName ?? S.user?.email ?? 'U').trim().charAt(0).toUpperCase() || 'U';

  return `<aside aria-label="Navegación de escritorio" class="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col border-r border-gray-800/80 bg-[#0B101B]">
    <div class="flex items-center gap-3 border-b border-gray-800/80 px-4 py-4">
      <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-electricBlue to-emeraldGreen text-white shadow-sm">${icon('barbell', 'h-5 w-5')}</div>
      <div class="min-w-0">
        <p class="truncate text-sm font-extrabold text-white">Panel PPL</p>
        <p class="truncate text-[11px] text-gray-500 tabular-nums">${statsText}</p>
      </div>
    </div>

    <div class="p-3">
      <button data-act="tab" data-arg="log" ${S.tab === 'log' ? 'aria-current="page"' : ''} class="flex w-full items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white shadow-sm transition-all active:scale-[0.98] ${S.tab === 'log' ? 'bg-gradient-to-r from-electricBlue to-emeraldGreen ring-2 ring-blue-300/60' : 'bg-electricBlue hover:bg-blue-500'}">
        ${icon('plus', 'h-4 w-4')}
        <span>Registrar entreno</span>
        ${draftCount > 0 ? `<span class="ml-auto inline-flex items-center gap-1 rounded-full bg-emeraldGreen/25 px-2 py-0.5 text-[10px] font-bold text-emerald-200"><span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emeraldGreen"></span>${draftCount}</span>` : ''}
      </button>
    </div>

    <nav class="flex-1 space-y-3.5 overflow-y-auto px-3 py-1">
      <div>
        <p class="nav-sec-lbl">General</p>
        <button data-act="tab" data-arg="home" ${S.tab === 'home' ? 'aria-current="page"' : ''} class="nav-item ${S.tab === 'home' ? 'nav-item-on' : ''}">
          ${icon('home', 'h-4 w-4')}
          <span>Resumen</span>
        </button>
      </div>

      <div>
        <p class="nav-sec-lbl">Rutinas</p>
        <div class="space-y-1">
          ${routineBtns}
          <button data-act="tab" data-arg="plan" ${S.tab === 'plan' ? 'aria-current="page"' : ''} class="nav-item ${S.tab === 'plan' ? 'nav-item-on' : ''}">
            ${icon('edit', 'h-4 w-4')}
            <span class="flex-1 text-left">Plan y rutinas</span>
            ${unmappedCount > 0 ? `<span class="rounded-full bg-amberGold/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amberGold">${unmappedCount}</span>` : ''}
          </button>
        </div>
      </div>

      <div>
        <p class="nav-sec-lbl">Análisis y métricas</p>
        <div class="space-y-1">${analyticsBtns}</div>
      </div>

      <div>
        <p class="nav-sec-lbl">Datos</p>
        <button data-act="tab" data-arg="data" ${S.tab === 'data' ? 'aria-current="page"' : ''} class="nav-item ${S.tab === 'data' ? 'nav-item-on' : ''}">
          ${icon('upload', 'h-4 w-4')}
          <span>Importar y backups</span>
        </button>
      </div>
    </nav>

    <div class="mt-auto space-y-2 border-t border-gray-800/80 p-3">
      ${S.user
        ? `<button data-act="tab" data-arg="settings" ${S.tab === 'settings' ? 'aria-current="page"' : ''} class="flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors ${S.tab === 'settings' ? 'border-electricBlue/40 bg-electricBlue/15' : 'border-white/5 bg-gray-900/60 hover:border-white/15'}">
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-electricBlue to-emeraldGreen text-xs font-extrabold text-white">${esc(userInitial)}</span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-xs font-bold text-white">${esc(S.user.displayName ?? 'Usuario')}</p>
              <p class="truncate text-[10px] text-emerald-400">${S.syncing ? 'Sincronizando…' : 'Cuenta y ajustes'}</p>
            </div>
            ${icon('gear', 'h-4 w-4 text-gray-400')}
          </button>`
        : `${S.authReady ? `<button data-act="cloudLogin" ${S.syncing ? 'disabled' : ''} class="flex w-full items-center gap-2.5 rounded-xl border border-electricBlue/35 bg-electricBlue/10 px-3 py-2 text-xs font-semibold text-blue-300 transition-colors hover:bg-electricBlue/20 active:scale-[0.98]">
            ${icon('login', 'h-4 w-4')}
            <span class="flex-1 text-left">Iniciar sesión · Google</span>
          </button>` : ''}
          <button data-act="tab" data-arg="settings" ${S.tab === 'settings' ? 'aria-current="page"' : ''} class="nav-item ${S.tab === 'settings' ? 'nav-item-on' : ''}">
            ${icon('gear', 'h-4 w-4')}
            <span class="flex-1 text-left">Cuenta y ajustes</span>
          </button>`}
    </div>
  </aside>`;
}

function renderMobileHeader(statsText: string): string {
  const inRoutine = isRoutineTab(S.tab) || S.tab === 'plan';
  const inAnalytics = ANALYTICS_IDS.has(S.tab);
  const inSystem = SYSTEM_IDS.has(S.tab);
  const rNames = routineNames(S.settings);
  const headerTitle = TAB_TITLES[S.tab] ?? (isRoutineTab(S.tab) ? `Rutina ${S.tab}` : 'GymApp');
  const subNav = inRoutine
    ? `<div role="tablist" aria-label="Rutinas" class="mt-2 flex gap-1 overflow-x-auto rounded-xl border border-gray-800/80 bg-[#0B101B] p-1">${rNames.map((id, idx) => {
        const active = S.tab === id;
        return `<button role="tab" aria-selected="${active}" data-act="tab" data-arg="${esc(id)}" class="flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${active ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}">
          <span class="h-2 w-2 rounded-full" style="background-color:${routineColor(id, S.settings, idx)}"></span>
          <span>${esc(id)}</span>
        </button>`;
      }).join('')}<button role="tab" aria-selected="${S.tab === 'plan'}" data-act="tab" data-arg="plan" class="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${S.tab === 'plan' ? 'bg-electricBlue/20 text-blue-300' : 'text-gray-400 hover:text-gray-200'}">Plan</button></div>`
    : inAnalytics
      ? `<div role="tablist" aria-label="Vistas de análisis" class="mt-2 grid grid-cols-4 gap-1 rounded-xl border border-gray-800/80 bg-[#0B101B] p-1">${ANALYTICS_TABS.map((a) => {
          const active = S.tab === a.id;
          return `<button role="tab" aria-selected="${active}" data-act="tab" data-arg="${a.id}" class="truncate rounded-lg px-1.5 py-1.5 text-center text-[11px] font-bold transition-colors ${active ? 'bg-electricBlue/20 text-blue-300' : 'text-gray-400 hover:text-gray-200'}">${a.label === 'Calculadoras' ? 'Calc.' : a.label}</button>`;
        }).join('')}</div>`
      : inSystem
        ? `<div role="tablist" aria-label="Cuenta y datos" class="mt-2 grid grid-cols-2 gap-1 rounded-xl border border-gray-800/80 bg-[#0B101B] p-1">${SYSTEM_TABS.map((t) => {
            const active = S.tab === t.id;
            return `<button role="tab" aria-selected="${active}" data-act="tab" data-arg="${t.id}" class="truncate rounded-lg px-2 py-1.5 text-center text-xs font-bold transition-colors ${active ? 'bg-electricBlue/20 text-blue-300' : 'text-gray-400 hover:text-gray-200'}">${t.label}</button>`;
          }).join('')}</div>`
        : '';

  return `<header class="sticky top-0 z-30 border-b border-gray-800 bg-bgDark/95 px-3 py-2 pt-[max(env(safe-area-inset-top),0.5rem)] backdrop-blur lg:hidden">
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-2.5">
      <div class="flex min-w-0 items-center gap-2.5">
        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-electricBlue to-emeraldGreen text-white shadow-sm">${icon('barbell', 'h-5 w-5')}</div>
        <div class="min-w-0">
          <h1 class="truncate text-sm font-extrabold leading-tight text-white">${esc(headerTitle)}</h1>
          <p class="truncate text-[11px] text-gray-500 tabular-nums">${statsText}</p>
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        ${S.authReady && !S.user ? `<button data-act="cloudLogin" ${S.syncing ? 'disabled' : ''} aria-label="Iniciar sesión con Google" title="Iniciar sesión con Google" class="flex h-9 items-center gap-1.5 rounded-xl border border-electricBlue/40 bg-electricBlue/15 px-2.5 text-xs font-bold text-blue-300 transition-colors hover:bg-electricBlue/25 active:scale-[0.98]">
          ${icon('login', 'h-3.5 w-3.5')}
          <span>Entrar</span>
        </button>` : ''}
        <button data-act="tab" data-arg="settings" aria-label="Cuenta y ajustes" ${inSystem ? 'aria-current="page"' : ''} class="flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${inSystem ? 'border-electricBlue bg-electricBlue/15 text-blue-300' : 'border-gray-800 bg-gray-900/80 text-gray-400 hover:text-white'}">
          ${icon('gear', 'h-5 w-5')}
        </button>
      </div>
    </div>
    ${subNav}
  </header>`;
}

function renderMobileNav(draftCount: number): string {
  const inRoutine = isRoutineTab(S.tab) || S.tab === 'plan';
  const inAnalytics = ANALYTICS_IDS.has(S.tab);
  return `<nav aria-label="Navegación principal móvil" class="fixed inset-x-0 bottom-0 z-30 border-t border-gray-800 bg-[#0B101B]/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
    <div class="mx-auto grid max-w-md grid-cols-4 items-center gap-1">
      <button data-act="tab" data-arg="home" ${S.tab === 'home' ? 'aria-current="page"' : ''} class="bnav-item ${S.tab === 'home' ? 'bnav-item-on' : ''}">
        ${icon('home', 'h-5 w-5')}
        <span>Resumen</span>
      </button>
      <button data-act="tab" data-arg="${esc(lastRoutine)}" ${inRoutine ? 'aria-current="page"' : ''} class="bnav-item ${inRoutine ? 'bnav-item-on' : ''}">
        ${icon('barbell', 'h-5 w-5')}
        <span class="truncate max-w-full">${S.tab === 'plan' ? 'Rutinas · Plan' : isRoutineTab(S.tab) ? esc(S.tab) : 'Rutinas'}</span>
      </button>
      <button data-act="tab" data-arg="${lastAnalytics}" ${inAnalytics ? 'aria-current="page"' : ''} class="bnav-item ${inAnalytics ? 'bnav-item-on' : ''}">
        ${icon('chart', 'h-5 w-5')}
        <span>Análisis</span>
      </button>
      <button data-act="tab" data-arg="log" ${S.tab === 'log' ? 'aria-current="page"' : ''} class="bnav-item">
        <span class="relative inline-flex items-center justify-center rounded-full px-3.5 py-1 text-white shadow-sm ${S.tab === 'log' ? 'bg-gradient-to-r from-electricBlue to-emeraldGreen ring-2 ring-blue-300/60' : 'bg-electricBlue'}">
          ${icon('plus', 'h-4 w-4')}
          ${draftCount > 0 ? `<span class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emeraldGreen ring-2 ring-[#0B101B]"></span>` : ''}
        </span>
        <span class="${S.tab === 'log' ? 'text-blue-300' : 'text-gray-200'}">Entrenar</span>
      </button>
    </div>
  </nav>`;
}

/** Re-renderiza el panel preservando posición de scroll y foco del control activo. */
function render() {
  const y = window.scrollY;
  const activeSel = focusSelector(document.activeElement);
  resetCharts();
  const html = view();
  const statsText = S.strength.length ? `${S.analysis.sessions.length} sesiones · ${S.measures.length} medidas` : 'sin datos importados';
  const draftCount = S.logDraft?.exercises.filter((e) => e.done).length ?? 0;

  root.innerHTML = `
  ${renderSidebar(statsText, draftCount)}
  ${renderMobileHeader(statsText)}
  <div class="lg:pl-64">
    <main id="main-content" tabindex="-1" class="w-full space-y-4 p-3 pb-28 sm:p-5 lg:px-7 lg:py-6 xl:px-10 lg:pb-10 focus:outline-none">${html}</main>
  </div>
  ${renderMobileNav(draftCount)}
  ${renderModals(S)}
  ${S.toast ? `<div role="status" aria-live="polite" class="fixed inset-x-3 bottom-20 z-40 mx-auto max-w-md rounded-xl border border-electricBlue/40 bg-gray-900 p-3 text-sm shadow-xl lg:bottom-6 lg:left-64">${esc(S.toast)}</div>` : ''}`;
  runChartJobs(); runCalc();
  window.scrollTo(0, y);
  if (activeSel) root.querySelector<HTMLElement>(activeSel)?.focus({ preventScroll: true });
}

const num = (v: string) => { const n = parseFloat(v.replace(',', '.')); return Number.isFinite(n) ? n : undefined; };
const arg = (el: HTMLElement) => el.dataset.arg ?? '';

const AI_COOLDOWN_MS = 15_000;
const MAX_SINGLE_FILE_BYTES = 50 * 1024 * 1024;
let lastAiAt = 0;
let syncTimer: number | undefined;
let syncInFlight = false;
let syncPending = false;

async function runSync(showToast = false) {
  if (!S.user) return;
  if (syncInFlight) { syncPending = true; return; }
  syncInFlight = true;
  S.syncing = true;
  render();
  try {
    const res = await syncWithCloud(S.user.uid);
    S.lastSync = Date.now();
    if (res.accountSwitched) { S.logDraft = undefined; saveDraft(undefined); }
    if (res.accountSwitched || res.pulledItems || res.deletedItems || res.settingsDirection === 'pulled') await reload();
    if (showToast) {
      const msg = res.pulledItems || res.pushedBuckets || res.deletedItems || res.settingsDirection !== 'none'
        ? `Sincronizado (${res.pushedBuckets} subidos, ${res.pulledItems} descargados).`
        : 'Todo al día con la nube.';
      toast(msg);
    }
  } catch (e) {
    toast(`Error de sincronización: ${(e as Error).message}`);
  } finally {
    S.syncing = false;
    syncInFlight = false;
    render();
    if (syncPending) { syncPending = false; void runSync(false); }
  }
}

function queueSync() {
  if (!S.user || !navigator.onLine) return;
  clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => { void runSync(false); }, 600);
}

async function persist() {
  await saveSettings(S.settings);
  markSettingsDirty();
  S.analysis = analyze(S.strength, S.settings);
  render();
  queueSync();
}
function download(name: string, data: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; a.click();
}

function addExToDraft(name: string, fallbackSets?: number, fallbackReps?: number) {
  const clean = name.trim();
  if (!clean) return;
  const today = new Date().toISOString().slice(0, 10);
  const firstRoutine = routineNames(S.settings)[0] ?? 'Libre';
  const draft = S.logDraft ?? (S.logDraft = initLogDraft(S, firstRoutine, today));
  const existing = draft.exercises.find((e) => norm(e.name) === norm(clean));
  if (existing) existing.done = true;
  else draft.exercises.push({ name: clean, done: true, sets: defaultSetsForEx(S, clean, fallbackSets, fallbackReps), note: '' });
  saveDraft(draft);
  render();
}

const actions: Record<string, (el: HTMLElement) => void | Promise<void>> = {
  tab: (el) => { setTab(arg(el)); render(); window.scrollTo(0, 0); },
  goLog: (el) => {
    const day = arg(el) as DayName | '';
    const today = new Date().toISOString().slice(0, 10);
    if (day) {
      S.logDraft = initLogDraft(S, day, S.logDraft?.date ?? today);
      saveDraft(S.logDraft);
    } else if (!S.logDraft) {
      S.logDraft = initLogDraft(S, routineNames(S.settings)[0] ?? 'Libre', today);
      saveDraft(S.logDraft);
    }
    setTab('log'); render(); window.scrollTo(0, 0);
  },
  logDay: (el) => {
    const day = arg(el) as DayName | 'Libre';
    const date = S.logDraft?.date ?? new Date().toISOString().slice(0, 10);
    S.logDraft = initLogDraft(S, day, date);
    saveDraft(S.logDraft);
    render();
  },
  logReset: () => {
    if (!confirm('¿Reiniciar el borrador actual a los valores por defecto de la rutina?')) return;
    const day = S.logDraft?.day ?? routineNames(S.settings)[0] ?? 'Libre';
    const date = S.logDraft?.date ?? new Date().toISOString().slice(0, 10);
    S.logDraft = initLogDraft(S, day, date);
    saveDraft(S.logDraft);
    render();
  },
  logToggleEx: (el) => {
    const ex = S.logDraft?.exercises[+arg(el)];
    if (!ex) return;
    ex.done = !ex.done;
    saveDraft(S.logDraft);
    render();
  },
  logRemoveEx: (el) => {
    if (!S.logDraft) return;
    S.logDraft.exercises.splice(+arg(el), 1);
    saveDraft(S.logDraft);
    render();
  },
  logAddEx: () => {
    const sel = document.getElementById('logAddSelect') as HTMLSelectElement | null;
    if (sel?.value) addExToDraft(sel.value);
  },
  logAddCustomEx: () => {
    const inp = document.getElementById('logNewExName') as HTMLInputElement | null;
    if (inp?.value.trim()) addExToDraft(inp.value);
  },
  logAddQuick: (el) => addExToDraft(arg(el)),
  logAddSet: (el) => {
    const ex = S.logDraft?.exercises[+arg(el)];
    if (!ex) return;
    const last = ex.sets[ex.sets.length - 1];
    ex.sets.push(last ? { ...last } : { w: 0, r: 10 });
    saveDraft(S.logDraft);
    render();
  },
  logDelSet: (el) => {
    const [ei, si] = arg(el).split('|').map(Number);
    const ex = S.logDraft?.exercises[ei];
    if (!ex) return;
    ex.sets.splice(si, 1);
    if (!ex.sets.length) ex.done = false;
    saveDraft(S.logDraft);
    render();
  },
  logStepW: (el) => {
    const [ei, si, step] = arg(el).split('|').map(Number);
    const s = S.logDraft?.exercises[ei]?.sets[si];
    if (!s) return;
    s.w = Math.max(0, Math.round((s.w + step) * 10) / 10);
    saveDraft(S.logDraft);
    render();
  },
  logStepR: (el) => {
    const [ei, si, step] = arg(el).split('|').map(Number);
    const s = S.logDraft?.exercises[ei]?.sets[si];
    if (!s) return;
    s.r = Math.max(0, s.r + step);
    saveDraft(S.logDraft);
    render();
  },
  logSave: async () => {
    const draft = S.logDraft;
    if (!draft) return;
    const active = draft.exercises.filter((e) => e.done);
    const rows: StrengthRow[] = [];
    const ts = Date.parse(`${draft.date}T12:00:00Z`) || Date.now();
    for (const ex of active) {
      const sets = ex.sets.filter((s) => s.r > 0).map((s) => ({ w: Math.max(0, Number(s.w) || 0), r: Math.max(1, Math.round(Number(s.r) || 0)) }));
      if (!sets.length) continue;
      rows.push({
        id: `manual-${draft.date}-${norm(ex.name)}`,
        sessionId: `manual-${draft.date}`,
        ts,
        date: draft.date,
        ref: `name:${ex.name.trim()}`,
        sets,
        ...(ex.note.trim() ? { note: ex.note.trim() } : {}),
        ...(draft.day !== 'Libre' ? { day: draft.day } : {}),
      });
    }
    if (!rows.length) { toast('Marca al menos un ejercicio con series y repeticiones (> 0).'); return; }
    const oldManual = S.strength.filter((r) => r.id.startsWith('manual-') && r.date === draft.date);
    for (const r of oldManual) await deleteKey('strength', r.id);
    if (oldManual.length) markBucketDeletes('strength', oldManual.map((r) => ({ key: r.id, date: r.date })));
    await putMany('strength', rows);
    markBucketUpserts('strength', rows);
    const savedDay = draft.day;
    S.logDraft = undefined;
    saveDraft(undefined);
    await reload();
    queueSync();
    if (savedDay !== 'Libre') setTab(savedDay);
    toast(`Sesión guardada: ${rows.length} ejercicios.`);
  },
  logEditSession: (el) => {
    const [date, day] = arg(el).split('|');
    S.logDraft = initLogDraft(S, (day as DayName | 'Libre') || 'Libre', date);
    saveDraft(S.logDraft);
    render();
    window.scrollTo(0, 0);
  },
  logDelSession: async (el) => {
    const [sessionId, date] = arg(el).split('|');
    if (!confirm(`¿Borrar la sesión manual del ${date}?`)) return;
    const toDel = S.strength.filter((r) => r.id.startsWith('manual-') && (r.sessionId === sessionId || r.date === date));
    for (const r of toDel) await deleteKey('strength', r.id);
    if (toDel.length) markBucketDeletes('strength', toDel.map((r) => ({ key: r.id, date: r.date })));
    await reload();
    queueSync();
    toast('Sesión manual borrada.');
  },
  selEx: (el) => { const [d, n] = arg(el).split('|'); S.sel[d] = n; render(); },
  setDayScope: (el) => {
    const [d, mode] = arg(el).split('|');
    (S.dayExtra ??= {})[d] = mode === 'extra';
    delete S.sel[d];
    render();
  },
  setRange: (el) => {
    const [scope, key] = arg(el).split('|');
    (S.ranges ??= {})[scope] = key as RangeKey;
    render();
  },
  selMuscle: (el) => { S.muscleSel = arg(el); render(); },
  aiTab: (el) => {
    S.aiTab = Math.max(0, +arg(el) || 0);
    const panel = document.getElementById('ai-report');
    if (!panel) { render(); return; }
    const activeSel = focusSelector(document.activeElement);
    panel.outerHTML = renderAiReport(S);
    if (activeSel) document.getElementById('ai-report')?.querySelector<HTMLElement>(activeSel)?.focus({ preventScroll: true });
  },
  planTab: (el) => { S.planTab = arg(el) === 'exercises' ? 'exercises' : 'routines'; render(); },
  openUnmapped: () => { S.planTab = 'exercises'; setTab('plan'); render(); window.scrollTo(0, 0); },
  setAiTone: async (el) => {
    const tone = arg(el) === 'simple' ? 'simple' : 'technical';
    if (S.settings.aiTone === tone) return;
    S.settings.aiTone = tone;
    await persist();
    toast(`Nivel de IA: ${tone === 'simple' ? 'Sencillo y generalista' : 'Técnico y detallado'}.`);
  },
  delMeasure: async (el) => {
    const key = arg(el);
    if (!confirm('¿Borrar esta medición?')) return;
    await deleteKey('measures', key);
    markBucketDeletes('measures', [{ key, date: key }]);
    await reload();
    render();
    queueSync();
  },
  editNote: async (el) => {
    const n = arg(el); const v = prompt(`Nota biomecánica para «${n}»`, S.settings.notes[n] ?? '');
    if (v == null) return; S.settings.notes[n] = v; await persist();
  },
  ai: async () => {
    if (!S.user) { toast('Inicia sesión con Google para generar análisis con IA.'); return; }
    const waitSec = Math.ceil((AI_COOLDOWN_MS - (Date.now() - lastAiAt)) / 1000);
    if (waitSec > 0) { toast(`Espera ${waitSec}s antes de generar otro análisis.`); return; }
    if (S.busy) return;
    S.busy = 'ai'; lastAiAt = Date.now(); render();
    try {
      S.settings.ai = await generateAnalysis(S.analysis, S.measures, S.settings, S.cardio, S.wellbeing);
      S.aiTab = 0;
      await saveSettings(S.settings);
      markSettingsDirty();
      queueSync();
      toast('Análisis generado.');
    }
    catch (e) { toast(`Error de IA: ${(e as Error).message}`); }
    S.busy = undefined; render();
  },
  cloudLogin: async () => {
    try {
      await signInGoogle();
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code !== 'auth/popup-closed-by-user') toast(`Error al iniciar sesión: ${(e as Error).message}`);
    }
  },
  cloudSync: async () => { await runSync(true); },
  cloudLogout: async () => {
    if (S.user && navigator.onLine && hasUnsyncedChanges()) await runSync(false);
    if (
      hasUnsyncedChanges() &&
      !confirm('Hay cambios locales sin subir a la nube. Si cierras sesión se limpiará la caché local de este dispositivo. ¿Continuar?')
    ) return;
    await signOutGoogle();
    await wipeAll();
    clearSyncMeta();
    S.logDraft = undefined;
    saveDraft(undefined);
    S.user = null;
    S.lastSync = undefined;
    await reload();
    render();
    toast('Sesión cerrada y caché local limpiada.');
  },
  export: async () => download(`gymapp-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(await exportBackup()), 'application/json'),
  wipe: async () => {
    const msg = S.user
      ? 'Se borrarán todos los datos de este dispositivo y de tu nube conectada. ¿Seguro?'
      : 'Se borrarán todos los datos de este dispositivo. ¿Seguro?';
    if (!confirm(msg)) return;
    await wipeAll();
    markWipePending();
    await reload();
    queueSync();
    toast('Datos borrados.');
  },
  openExModal: (el) => {
    S.exModal = { routine: arg(el) || undefined };
    render();
    document.getElementById('newExName')?.focus();
  },
  openExModalLog: () => {
    S.exModal = { fromLog: true };
    render();
    document.getElementById('newExName')?.focus();
  },
  closeModal: () => {
    if (!S.exModal && !S.routineModal) return;
    S.exModal = undefined;
    S.routineModal = undefined;
    render();
  },
  rtModalNew: () => {
    const used = new Set(routineNames(S.settings).map((r) => routineColor(r, S.settings)));
    const nextColor = ROUTINE_COLORS.find((c) => !used.has(c)) ?? ROUTINE_COLORS[routineNames(S.settings).length % ROUTINE_COLORS.length];
    S.routineModal = { mode: 'create', name: '', sub: '', color: nextColor };
    render();
    document.getElementById('rtModalName')?.focus();
  },
  rtModalEdit: (el) => {
    const name = arg(el);
    if (!name || !S.settings.routines[name]) return;
    S.routineModal = {
      mode: 'edit',
      oldName: name,
      name,
      sub: S.settings.routineMeta?.[name]?.sub ?? '',
      color: routineColor(name, S.settings),
    };
    render();
    document.getElementById('rtModalName')?.focus();
  },
  rtRemoveDay: async (el) => {
    const name = arg(el);
    const names = routineNames(S.settings);
    if (!name || !S.settings.routines[name]) return;
    if (names.length <= 1) { toast('Debes mantener al menos una rutina activa.'); return; }
    const count = S.settings.routines[name].length;
    if (count > 0 && !confirm(`¿Eliminar la rutina "${name}" (${count} ejercicios)? El historial ya guardado se conservará.`)) return;
    delete S.settings.routines[name];
    if (S.settings.routineMeta) delete S.settings.routineMeta[name];
    const remaining = routineNames(S.settings);
    if (lastRoutine === name) lastRoutine = remaining[0] ?? 'Push';
    if (S.sel.home === name) delete S.sel.home;
    if (S.logDraft?.day === name) {
      S.logDraft.day = remaining[0] ?? 'Libre';
      saveDraft(S.logDraft);
    }
    await persist();
    toast(`Rutina "${name}" eliminada.`);
  },
  rtApplyTpl: async (el) => {
    const tpl = ROUTINE_TEMPLATES[arg(el)];
    if (!tpl) return;
    if (!confirm(`¿Aplicar la plantilla "${tpl.label}"? Reemplazará la distribución actual de rutinas.`)) return;
    S.settings.routines = structuredClone(tpl.routines);
    S.settings.routineMeta = structuredClone(tpl.meta);
    const remaining = routineNames(S.settings);
    if (!isRoutineTab(lastRoutine)) lastRoutine = remaining[0] ?? 'Push';
    if (S.sel.home && !S.settings.routines[S.sel.home]) delete S.sel.home;
    if (S.logDraft && S.logDraft.day !== 'Libre' && !S.settings.routines[S.logDraft.day]) {
      S.logDraft.day = remaining[0] ?? 'Libre';
      saveDraft(S.logDraft);
    }
    await persist();
    toast(`Plantilla "${tpl.label}" aplicada.`);
  },
  rtAdd: async (el) => {
    const d = arg(el);
    (S.settings.routines[d] ??= []).push({ name: '', sets: 2, reps: 10 });
    await persist();
  },
  rtDel: async (el) => {
    const [d, i] = splitPair(arg(el));
    S.settings.routines[d]?.splice(+i, 1);
    await persist();
  },
  toggleMeasurePerim: () => {
    const today = new Date().toISOString().slice(0, 10);
    const activeDate = S.measureDate ?? today;
    const entry = S.measures.find((m) => m.date === activeDate);
    const hasPerim = Boolean(entry && MEASURE_FIELDS.some((f) => !BASIC_MEASURE_KEYS.includes(f.key) && entry[f.key] != null));
    S.measurePerimOpen = !(S.measurePerimOpen ?? hasPerim);
    render();
  },
  editMeasure: (el) => {
    const d = arg(el);
    if (!d) return;
    S.measureDate = d;
    S.measurePerimOpen = undefined;
    render();
    document.getElementById('f-measure')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  clearMeasureDate: () => {
    S.measureDate = undefined;
    S.measurePerimOpen = undefined;
    render();
  },
  merge: async () => {
    const f = (document.getElementById('mergeFrom') as HTMLSelectElement).value; const t = (document.getElementById('mergeTo') as HTMLSelectElement).value;
    if (!f || !t || f === t) return; S.settings.aliases[f] = t; await persist();
  },
  unmerge: async (el) => { delete S.settings.aliases[arg(el)]; await persist(); },
  phaseDel: async (el) => { const sorted = [...S.settings.phases].sort((a, b) => a.start.localeCompare(b.start)); sorted.splice(+arg(el), 1); S.settings.phases = sorted; await persist(); },
};

const changes: Record<string, (el: HTMLInputElement | HTMLSelectElement) => void | Promise<void>> = {
  selHome: (el) => { S.sel.home = el.value; render(); },
  logDate: (el) => {
    const day = S.logDraft?.day ?? routineNames(S.settings)[0] ?? 'Libre';
    S.logDraft = initLogDraft(S, day, el.value);
    saveDraft(S.logDraft);
    render();
  },
  measureDate: (el) => {
    S.measureDate = el.value || undefined;
    S.measurePerimOpen = undefined;
    render();
  },
  selPerim: (el) => { S.perimeter = el.value; render(); },
  calcPreset: (el) => { const [w, r] = el.value.split('|'); (document.getElementById('calcW') as HTMLInputElement).value = w; (document.getElementById('calcR') as HTMLInputElement).value = r; runCalc(); },
  nutri: () => runCalc(),
  rtName: async (el) => {
    const [d, i] = splitPair(arg(el));
    if (el.value === '__new__') {
      S.exModal = { routine: d, rowIdx: +i };
      render();
      document.getElementById('newExName')?.focus();
      return;
    }
    const item = S.settings.routines[d]?.[+i];
    if (!item) return;
    item.name = el.value;
    await persist();
  },
  rtSets: async (el) => {
    const [d, i] = splitPair(arg(el));
    const item = S.settings.routines[d]?.[+i];
    if (!item) return;
    item.sets = Math.max(1, +el.value || 1);
    await persist();
  },
  rtReps: async (el) => {
    const [d, i] = splitPair(arg(el));
    const item = S.settings.routines[d]?.[+i];
    if (!item) return;
    item.reps = Math.max(1, +el.value || 1);
    await persist();
  },
  refName: async (el) => { if (!el.value.trim()) return; S.settings.refNames[arg(el)] = el.value.trim(); await persist(); },
  musP: async (el) => { const n = norm(arg(el)); const cur = S.settings.muscles[n] ?? { p: '', s: [] }; S.settings.muscles[n] = { ...cur, p: el.value }; await persist(); },
  musS: async (el) => {
    const n = norm(arg(el)); const cur = S.settings.muscles[n] ?? { p: '', s: [] };
    S.settings.muscles[n] = { ...cur, p: cur.p || (document.querySelector(`select[data-arg="${CSS.escape(arg(el))}"]`) as HTMLSelectElement | null)?.value || '', s: el.value.split(',').map((x) => x.trim()).filter(Boolean) };
    await persist();
  },
  pfSex: async (el) => { S.settings.profile.sex = el.value; await persist(); },
  pfAge: async (el) => { S.settings.profile.age = +el.value; await persist(); },
  pfHeight: async (el) => { S.settings.profile.height = +el.value; await persist(); },
};

root.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (el) void actions[el.dataset.act!]?.(el);
});
root.addEventListener('change', async (e) => {
  const el = e.target as HTMLInputElement;
  if (el.dataset.change) { await changes[el.dataset.change]?.(el); return; }
  const kind = el.dataset.file;
  if (!kind || !el.files?.length) return;
  const files = [...el.files];
  try {
    if (kind === 'samsung') {
      toast('Procesando exportación…');
      const imp = await importSamsungFiles(files);
      const before = S.strength.length;
      await putMany('strength', imp.strength); await putMany('cardio', imp.cardio);
      await mergeWellbeing(imp.wellbeing);
      Object.assign(S.settings.customNames, imp.customNames);
      await saveSettings(S.settings);
      markBucketUpserts('strength', imp.strength);
      markBucketUpserts('cardio', imp.cardio);
      markBucketUpserts('wellbeing', imp.wellbeing);
      markSettingsDirty();
      await reload();
      queueSync();
      const parts = [
        `${S.strength.length - before} ejercicios nuevos (${imp.strength.length} leídos)`,
        `${imp.cardio.length} cardio`,
        `${imp.wellbeing.length} días de bienestar`,
        `${Object.keys(imp.customNames).length} nombres`,
      ];
      toast(`Importado: ${parts.join(', ')}.${!Object.keys(S.settings.customNames).length && imp.strength.length ? ' Falta custom_exercise.csv para los nombres.' : ''}`);
    } else if (kind === 'measures') {
      if (files[0].size > MAX_SINGLE_FILE_BYTES) throw new Error('Archivo demasiado grande (máx. 50 MB).');
      const m = parseMeasuresCsv(await files[0].text());
      await putMany('measures', m.measures);
      Object.assign(S.settings.profile, m.profile);
      await saveSettings(S.settings);
      markBucketUpserts('measures', m.measures);
      markSettingsDirty();
      await reload();
      queueSync();
      toast(`Importadas ${m.measures.length} mediciones.`);
    } else if (kind === 'backup') {
      if (files[0].size > MAX_SINGLE_FILE_BYTES) throw new Error('Archivo demasiado grande (máx. 50 MB).');
      const b = parseBackup(await files[0].text());
      await importBackup(b);
      markBucketUpserts('strength', b.strength);
      markBucketUpserts('cardio', b.cardio);
      markBucketUpserts('measures', b.measures);
      if (b.wellbeing?.length) markBucketUpserts('wellbeing', b.wellbeing);
      markSettingsDirty();
      await reload();
      queueSync();
      toast('Copia restaurada.');
    }
  } catch (err) { toast(`Error al importar: ${(err as Error).message}`); }
  el.value = '';
});
root.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  if (el.dataset.input === 'calc') { runCalc(); return; }
  if (!S.logDraft) return;
  if (el.dataset.logW) {
    const [ei, si] = el.dataset.logW.split('|').map(Number);
    const s = S.logDraft.exercises[ei]?.sets[si];
    if (s) { s.w = Math.max(0, parseFloat(el.value.replace(',', '.')) || 0); saveDraft(S.logDraft); }
  } else if (el.dataset.logR) {
    const [ei, si] = el.dataset.logR.split('|').map(Number);
    const s = S.logDraft.exercises[ei]?.sets[si];
    if (s) { s.r = Math.max(0, parseInt(el.value, 10) || 0); saveDraft(S.logDraft); }
  } else if (el.dataset.logNote != null) {
    const ex = S.logDraft.exercises[+el.dataset.logNote];
    if (ex) { ex.note = el.value; saveDraft(S.logDraft); }
  }
});
root.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target as HTMLFormElement; const fd = new FormData(f);
  if (f.id === 'f-measure') {
    const date = String(fd.get('date') ?? '').trim();
    if (!date) return;
    const existing = S.measures.find((x) => x.date === date);
    const m: Measure = { date };
    let metricCount = 0;
    for (const { key } of MEASURE_FIELDS) {
      if (fd.has(key)) {
        const v = num(String(fd.get(key) ?? ''));
        if (v != null) { (m as unknown as Record<string, number>)[key] = v; metricCount++; }
      } else if (typeof existing?.[key] === 'number') {
        (m as unknown as Record<string, number>)[key] = existing[key] as number;
        metricCount++;
      }
    }
    if (!metricCount) { toast('Introduce al menos una métrica numérica (por ejemplo, peso o % de grasa).'); return; }
    const note = fd.has('note') ? String(fd.get('note') ?? '').trim() : (existing?.note ?? '');
    if (note) m.note = note;
    await putMany('measures', [m]); markBucketUpserts('measures', [m]);
    S.measureDate = date;
    S.measurePerimOpen = undefined;
    await reload(); queueSync(); toast('Medición guardada.');
  } else if (f.id === 'f-new-ex') {
    const rawName = String(fd.get('name') ?? '').trim().slice(0, 80);
    if (!rawName) return;
    const modal = S.exModal;
    const existingName = allExerciseNames(S).find((n) => norm(n) === norm(rawName));
    if (existingName && !modal?.fromLog && modal?.rowIdx == null) {
      toast(`Ya existe "${existingName}" en tu biblioteca.`);
      return;
    }
    const finalName = existingName ?? rawName;
    const primary = String(fd.get('primary') ?? '').trim();
    const sec = fd.getAll('secondary').map((x) => String(x)).filter((m) => m && m !== primary);
    if (primary) S.settings.muscles[norm(finalName)] = { p: primary, s: [...new Set(sec)] };
    if (!existingName) S.settings.customNames[`manual:${norm(finalName)}`] = finalName;
    const sets = Math.max(1, Math.min(20, Math.round(Number(fd.get('sets')) || 3)));
    const reps = Math.max(1, Math.min(100, Math.round(Number(fd.get('reps')) || 10)));
    const targetRoutine = String(fd.get('routine') ?? modal?.routine ?? '').trim();
    if (!modal?.fromLog && targetRoutine && S.settings.routines[targetRoutine]) {
      const list = S.settings.routines[targetRoutine];
      if (modal?.rowIdx != null && modal.routine === targetRoutine && list[modal.rowIdx]) {
        list[modal.rowIdx] = { name: finalName, sets, reps };
      } else {
        list.push({ name: finalName, sets, reps });
      }
    }
    S.exModal = undefined;
    await persist();
    if (modal?.fromLog) addExToDraft(finalName, sets, reps);
    toast(existingName ? `Ejercicio "${finalName}" actualizado.` : `Ejercicio "${finalName}" creado.`);
  } else if (f.id === 'f-routine-meta' && S.routineModal) {
    const rm = S.routineModal;
    const rawName = String(fd.get('name') ?? '').replace(/\|/g, '/').trim().slice(0, 40);
    if (!rawName) return;
    if (RESERVED_ROUTINE_NORMS.has(norm(rawName)) || rawName === '__proto__' || rawName === 'constructor' || rawName === 'prototype') {
      toast(`"${rawName}" es un nombre reservado. Elige otro nombre.`);
      return;
    }
    const existingKeys = routineNames(S.settings);
    const conflict = existingKeys.find((k) => norm(k) === norm(rawName) && (rm.mode === 'create' || k !== rm.oldName));
    if (conflict) { toast(`Ya existe una rutina llamada "${conflict}".`); return; }

    const sub = String(fd.get('sub') ?? '').trim().slice(0, 40);
    const color = String(fd.get('color') ?? '').trim();
    const validColor = ROUTINE_COLORS.includes(color) ? color : rm.color;
    S.settings.routineMeta ??= {};

    if (rm.mode === 'create') {
      if (existingKeys.length >= 20) { toast('Máximo 20 rutinas permitidas.'); return; }
      S.settings.routines[rawName] = [];
      S.settings.routineMeta[rawName] = { color: validColor, ...(sub ? { sub } : {}) };
      S.routineModal = undefined;
      await persist();
      toast(`Rutina "${rawName}" creada.`);
    } else if (rm.oldName && S.settings.routines[rm.oldName]) {
      const oldName = rm.oldName;
      if (rawName !== oldName) {
        const nextRoutines: Record<string, RoutineEx[]> = {};
        for (const [k, v] of Object.entries(S.settings.routines)) {
          nextRoutines[k === oldName ? rawName : k] = v;
        }
        S.settings.routines = nextRoutines;
        delete S.settings.routineMeta[oldName];
        if (lastRoutine === oldName) lastRoutine = rawName;
        if (S.tab === oldName) setTab(rawName);
        if (S.sel.home === oldName) S.sel.home = rawName;
        if (S.logDraft?.day === oldName) { S.logDraft.day = rawName; saveDraft(S.logDraft); }
        const migrated = S.strength.filter((r) => r.day === oldName).map((r) => ({ ...r, day: rawName }));
        if (migrated.length) {
          await putMany('strength', migrated);
          markBucketUpserts('strength', migrated);
          S.strength = S.strength.map((r) => (r.day === oldName ? { ...r, day: rawName } : r));
        }
      }
      S.settings.routineMeta[rawName] = { color: validColor, ...(sub ? { sub } : {}) };
      S.routineModal = undefined;
      await persist();
      toast(`Rutina "${rawName}" actualizada.`);
    }
  } else if (f.id === 'f-phase') {
    S.settings.phases.push({ name: String(fd.get('name')), start: String(fd.get('start')) }); await persist();
  }
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && (S.exModal || S.routineModal)) {
    S.exModal = undefined;
    S.routineModal = undefined;
    render();
  }
});
window.addEventListener('hashchange', () => {
  const raw = initialTab();
  const next = isValidTab(raw) ? raw : 'home';
  if (next !== S.tab) { setTab(next); render(); }
});

window.addEventListener('online', () => queueSync());
window.matchMedia('(min-width: 1024px)').addEventListener('change', () => render());

reload().then(async () => {
  await consumeRedirectAuth();
  S.lastSync = loadSyncMeta().lastSyncAt;
  const first = !S.strength.length && !S.measures.length;
  if (first && !location.hash) setTab('data');
  render();
  subscribeAuth((user) => {
    const changed = user?.uid !== S.user?.uid;
    S.authReady = true;
    S.user = user;
    if (user && changed && navigator.onLine) void runSync(false);
    else render();
  });
});
