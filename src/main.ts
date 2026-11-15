import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { analyze } from './lib/analysis';
import { generateAnalysis } from './lib/ai';
import { deleteKey, exportBackup, getAll, importBackup, loadSettings, mergeWellbeing, parseBackup, putMany, saveSettings, wipeAll } from './lib/db';
import { consumeRedirectAuth, signInGoogle, signOutGoogle, subscribeAuth } from './lib/firebase';
import { clearSyncMeta, hasUnsyncedChanges, loadSyncMeta, markBucketDeletes, markBucketUpserts, markSettingsDirty, markWipePending, syncWithCloud } from './lib/sync';
import { importSamsungInWorker } from './lib/samsung';
import { parseMeasuresCsv } from './lib/measures';
import { BASIC_MEASURE_KEYS, MEASURE_FIELDS, type CardioRow, type DailyWellbeing, type DayName, type LogDraft, type Measure, type RoutineEx, type StrengthRow } from './types';
import { ROUTINE_COLORS, ROUTINE_TEMPLATES, norm } from './lib/seed';
import { icon, type IconName } from './ui/icons';
import { allExerciseNames, manualSessionId, renderRestTimerBar } from './ui/logView';
import { defaultSetsForEx, initLogDraft, renderAiReport, renderModals, resetCharts, runChartJobs, runCalc, viewAdherence, viewBody, viewCalc, viewData, viewDay, viewHome, viewLog, viewPlan, viewSettings, viewVolume, type State } from './ui/views';
import { esc, routineColor, routineNames, type RangeKey } from './ui/shared';
import { initSortableLists, moveItem } from './ui/reorder';

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

function syncStatusInfo(): { text: string; cls: string } {
  if (!S.user) return { text: navigator.onLine ? 'Solo local' : 'Sin conexión · local', cls: 'text-gray-400' };
  if (S.syncing) return { text: 'Sincronizando…', cls: 'text-blue-300' };
  if (!navigator.onLine) {
    return hasUnsyncedChanges()
      ? { text: 'Offline · pendiente de subir', cls: 'text-amberGold' }
      : { text: 'Sin conexión · caché offline', cls: 'text-gray-400' };
  }
  if (hasUnsyncedChanges()) return { text: 'Pendiente de sincronizar', cls: 'text-amberGold' };
  return { text: 'Sincronizado', cls: 'text-emerald-400' };
}

function updateSyncDom() {
  const st = syncStatusInfo();
  root.querySelectorAll<HTMLElement>('[data-sync-badge]').forEach((el) => {
    el.textContent = st.text;
    el.className = `${el.dataset.syncBase ?? 'truncate text-[10px]'} ${st.cls}`;
  });
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
  if (el.dataset.logW) return `[data-log-w="${CSS.escape(el.dataset.logW)}"]`;
  if (el.dataset.logR) return `[data-log-r="${CSS.escape(el.dataset.logR)}"]`;
  if (el.dataset.logNote != null) return `[data-log-note="${CSS.escape(el.dataset.logNote)}"]`;
  if (el.closest('#f-measure') && (el as HTMLInputElement).name) {
    return `#f-measure [name="${CSS.escape((el as HTMLInputElement).name)}"]`;
  }
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
      <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-electricBlue text-white shadow-sm">${icon('barbell', 'h-5 w-5')}</div>
      <div class="min-w-0">
        <p class="truncate text-sm font-extrabold text-white">Panel PPL</p>
        <p class="truncate text-[11px] text-gray-500 tabular-nums">${statsText}</p>
      </div>
    </div>

    <div class="p-3">
      <button data-act="tab" data-arg="log" ${S.tab === 'log' ? 'aria-current="page"' : ''} class="flex w-full items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white shadow-sm transition-all active:scale-[0.98] ${S.tab === 'log' ? 'bg-electricBlue ring-2 ring-blue-300/60' : 'bg-electricBlue hover:bg-blue-500'}">
        ${icon('plus', 'h-4 w-4')}
        <span>Registrar entreno</span>
        ${draftCount > 0 ? `<span class="ml-auto inline-flex items-center gap-1 rounded-full bg-emeraldGreen/25 px-2 py-0.5 text-[10px] font-bold text-emerald-200"><span class="h-1.5 w-1.5 rounded-full bg-emeraldGreen"></span>${draftCount}</span>` : ''}
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
      ${(() => {
        const st = syncStatusInfo();
        return S.user
          ? `<button data-act="tab" data-arg="settings" ${S.tab === 'settings' ? 'aria-current="page"' : ''} class="flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors ${S.tab === 'settings' ? 'border-electricBlue/40 bg-electricBlue/15' : 'border-white/5 bg-gray-900/60 hover:border-white/15'}">
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-electricBlue text-xs font-extrabold text-white">${esc(userInitial)}</span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-bold text-white">${esc(S.user.displayName ?? 'Usuario')}</p>
                <p data-sync-badge data-sync-base="truncate text-[10px]" class="truncate text-[10px] ${st.cls}">${st.text}</p>
              </div>
              ${icon('gear', 'h-4 w-4 text-gray-400')}
            </button>`
          : `${S.authReady ? `<button data-act="cloudLogin" ${S.syncing ? 'disabled' : ''} class="flex w-full items-center gap-2.5 rounded-xl border border-electricBlue/35 bg-electricBlue/10 px-3 py-2 text-xs font-semibold text-blue-300 transition-colors hover:bg-electricBlue/20 active:scale-[0.98]">
              ${icon('login', 'h-4 w-4')}
              <span class="flex-1 text-left">Iniciar sesión · Google</span>
            </button>` : ''}
            <button data-act="tab" data-arg="settings" ${S.tab === 'settings' ? 'aria-current="page"' : ''} class="nav-item ${S.tab === 'settings' ? 'nav-item-on' : ''}">
              ${icon('gear', 'h-4 w-4')}
              <span class="min-w-0 flex-1 text-left">
                <span class="block">Cuenta y ajustes</span>
                <span data-sync-badge data-sync-base="block truncate text-[10px] font-normal" class="block truncate text-[10px] font-normal ${st.cls}">${st.text}</span>
              </span>
            </button>`;
      })()}
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

  return `<header class="sticky top-0 z-30 border-b border-gray-800 bg-bgDark px-3 py-2 pt-[max(env(safe-area-inset-top),0.5rem)] lg:hidden">
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-2.5">
      <div class="flex min-w-0 items-center gap-2.5">
        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-electricBlue text-white shadow-sm">${icon('barbell', 'h-5 w-5')}</div>
        <div class="min-w-0">
          <h1 class="truncate text-sm font-extrabold leading-tight text-white">${esc(headerTitle)}</h1>
          <p class="truncate text-[11px] text-gray-400 tabular-nums">${statsText} · <span data-sync-badge data-sync-base="font-medium" class="font-medium ${syncStatusInfo().cls}">${syncStatusInfo().text}</span></p>
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
  return `<nav aria-label="Navegación principal móvil" class="fixed inset-x-0 bottom-0 z-30 border-t border-gray-800 bg-[#0B101B] px-2 pb-[env(safe-area-inset-bottom)] lg:hidden">
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
        <span class="relative inline-flex items-center justify-center rounded-full px-3.5 py-1 text-white shadow-sm bg-electricBlue ${S.tab === 'log' ? 'ring-2 ring-blue-300/60' : ''}">
          ${icon('plus', 'h-4 w-4')}
          ${draftCount > 0 ? `<span class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emeraldGreen ring-2 ring-[#0B101B]"></span>` : ''}
        </span>
        <span class="${S.tab === 'log' ? 'text-blue-300' : 'text-gray-200'}">Entrenar</span>
      </button>
    </div>
  </nav>`;
}

/** Re-renderiza el panel preservando posición de scroll, foco y selección de texto del control activo. */
function render() {
  const y = window.scrollY;
  const activeEl = document.activeElement;
  const activeSel = focusSelector(activeEl);
  const selStart = activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement ? activeEl.selectionStart : null;
  const selEnd = activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement ? activeEl.selectionEnd : null;
  resetCharts();
  const html = view();
  const statsText = S.strength.length ? `${S.analysis.sessions.length} sesiones · ${S.measures.length} medidas` : 'sin datos importados';
  const draftCount = S.logDraft?.exercises.filter((e) => e.sets.some((s) => s.done && s.r > 0)).length ?? 0;

  root.innerHTML = `
  ${renderSidebar(statsText, draftCount)}
  ${renderMobileHeader(statsText)}
  <div class="lg:pl-64">
    <main id="main-content" tabindex="-1" class="w-full space-y-4 p-2.5 pb-28 sm:p-5 lg:px-7 lg:py-6 xl:px-10 lg:pb-10 focus:outline-none">${html}</main>
  </div>
  ${renderMobileNav(draftCount)}
  ${renderModals(S)}`;
  runChartJobs(); runCalc();
  window.scrollTo(0, y);
  if (activeSel) {
    const nextEl = root.querySelector<HTMLElement>(activeSel);
    nextEl?.focus({ preventScroll: true });
    if ((nextEl instanceof HTMLInputElement || nextEl instanceof HTMLTextAreaElement) && selStart != null && selEnd != null) {
      try { nextEl.setSelectionRange(selStart, selEnd); } catch { /* algunos inputs como number/date no admiten setSelectionRange */ }
    }
  }
  syncRestTicker();
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
  updateSyncDom();
  try {
    const res = await syncWithCloud(S.user.uid);
    S.lastSync = Date.now();
    if (res.accountSwitched) { S.logDraft = undefined; saveDraft(undefined); }
    const changed = Boolean(res.accountSwitched || res.pulledItems || res.deletedItems || res.settingsDirection === 'pulled');
    if (changed) {
      await reload();
      render();
    }
    if (showToast) {
      const msg = res.pulledItems || res.pushedBuckets || res.deletedItems || res.settingsDirection !== 'none'
        ? `Sincronizado (${res.pushedBuckets} subidos, ${res.pulledItems} descargados).`
        : 'Todo al día con la nube.';
      toast(msg);
    }
  } catch (e) {
    if (showToast) toast(`Error de sincronización: ${(e as Error).message}`);
  } finally {
    S.syncing = false;
    syncInFlight = false;
    updateSyncDom();
    if (syncPending) { syncPending = false; void runSync(false); }
  }
}

function queueSync() {
  updateSyncDom();
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
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function addExToDraft(name: string, fallbackSets?: number, fallbackReps?: number) {
  const clean = name.trim();
  if (!clean) return;
  const today = new Date().toISOString().slice(0, 10);
  const firstRoutine = routineNames(S.settings)[0] ?? 'Libre';
  const draft = S.logDraft ?? (S.logDraft = initLogDraft(S, firstRoutine, today));
  const existingIdx = draft.exercises.findIndex((e) => norm(e.name) === norm(clean));
  if (existingIdx < 0) {
    draft.exercises.push({ name: clean, done: false, sets: defaultSetsForEx(S, clean, fallbackSets, fallbackReps, false), note: '' });
  }
  draft.dirty = true;
  saveDraft(draft);
  render();
  if (existingIdx >= 0) {
    root.querySelector<HTMLElement>(`[data-ex-idx="${existingIdx}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

let restTimerInterval: number | undefined;
function updateRestBarDom() {
  const bar = document.getElementById('rest-timer-bar');
  if (bar && S.logDraft) bar.outerHTML = renderRestTimerBar(S.logDraft);
}
function syncRestTicker() {
  const until = S.logDraft?.restUntil;
  const active = S.tab === 'log' && until != null && until > Date.now();
  if (active && restTimerInterval == null) {
    restTimerInterval = window.setInterval(() => {
      if (S.tab !== 'log' || !S.logDraft || S.logDraft.restUntil == null) {
        clearInterval(restTimerInterval);
        restTimerInterval = undefined;
        return;
      }
      updateRestBarDom();
      if (S.logDraft.restUntil <= Date.now()) {
        clearInterval(restTimerInterval);
        restTimerInterval = undefined;
        try { navigator.vibrate?.([40, 40, 40]); } catch { /* navigator.vibrate opcional */ }
      }
    }, 1000);
  } else if (!active && restTimerInterval != null) {
    clearInterval(restTimerInterval);
    restTimerInterval = undefined;
  }
}

function updateLogCountersDom(ei?: number) {
  const draft = S.logDraft;
  if (!draft) return;
  const doneExCount = draft.exercises.filter((e) => e.sets.some((s) => s.done && s.r > 0)).length;
  const doneSetsCount = draft.exercises.reduce((acc, e) => acc + e.sets.filter((s) => s.done && s.r > 0).length, 0);
  const totalSetsCount = draft.exercises.reduce((acc, e) => acc + e.sets.length, 0);

  const summary = document.getElementById('logCountSummary');
  if (summary) summary.textContent = `${doneExCount}/${draft.exercises.length} ejercicios · ${doneSetsCount}/${totalSetsCount} series marcadas ✓`;

  const saveBtns = root.querySelectorAll<HTMLButtonElement>('button[data-act="logSave"]');
  saveBtns.forEach((btn, idx) => {
    const label = idx === 0 ? ` Guardar (${doneSetsCount})` : ` Guardar sesión (${doneSetsCount} series)`;
    const svg = btn.querySelector('svg');
    btn.textContent = '';
    if (svg) btn.appendChild(svg);
    btn.appendChild(document.createTextNode(label));
  });

  if (ei != null && draft.exercises[ei]) {
    const ex = draft.exercises[ei];
    const doneInEx = ex.sets.filter((s) => s.done && s.r > 0).length;
    const allDoneInEx = ex.sets.length > 0 && doneInEx === ex.sets.length;
    const counter = root.querySelector<HTMLElement>(`[data-ex-counter="${ei}"]`);
    if (counter) {
      counter.textContent = `${doneInEx}/${ex.sets.length}`;
      counter.className = `ml-1 tabular-nums text-xs font-semibold ${allDoneInEx ? 'text-emerald-300' : 'text-gray-400'}`;
    }
    const card = root.querySelector<HTMLElement>(`[data-ex-idx="${ei}"]`);
    if (card) {
      card.classList.remove('border-emeraldGreen/50', 'border-electricBlue/50', 'border-white/10');
      card.classList.add(allDoneInEx ? 'border-emeraldGreen/50' : doneInEx > 0 ? 'border-electricBlue/50' : 'border-white/10');
    }
    const toggleBtn = root.querySelector<HTMLElement>(`[data-act="logToggleEx"][data-arg="${ei}"]`);
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-pressed', String(allDoneInEx));
      const box = toggleBtn.querySelector<HTMLElement>('span');
      if (box) {
        box.className = `mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${allDoneInEx ? 'border-emeraldGreen bg-emeraldGreen/20 text-emeraldGreen' : doneInEx > 0 ? 'border-electricBlue bg-electricBlue/20 text-blue-300' : 'border-gray-600 text-transparent'}`;
      }
    }
  }
}

function syncSetDom(ei: number, si: number) {
  const ex = S.logDraft?.exercises[ei];
  const s = ex?.sets[si];
  if (!ex || !s) return;
  const row = root.querySelector<HTMLElement>(`[data-set-row="${ei}|${si}"]`);
  if (row) {
    row.className = `flex items-center gap-1.5 rounded-xl p-1 transition-colors ${s.done ? 'bg-emeraldGreen/10' : ''}`;
    const label = row.querySelector<HTMLElement>('span');
    if (label) label.className = `w-5 shrink-0 text-center tabular-nums text-xs font-bold ${s.done ? 'text-emerald-300' : 'text-gray-400'}`;
  }
  const btn = root.querySelector<HTMLElement>(`[data-act="logToggleSet"][data-arg="${ei}|${si}"]`);
  if (btn) {
    btn.setAttribute('aria-pressed', String(Boolean(s.done)));
    btn.setAttribute('aria-label', `${s.done ? 'Desmarcar' : 'Completar'} serie ${si + 1} de ${ex.name}`);
    btn.className = `flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors active:scale-95 ${s.done ? 'border-emeraldGreen bg-emeraldGreen text-gray-950' : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-emeraldGreen/60 hover:text-white'}`;
  }
  updateLogCountersDom(ei);
}

async function confirmSwitchDraft(nextDay: DayName | 'Libre', nextDate: string, nextSessionId?: string): Promise<boolean> {
  const cur = S.logDraft;
  if (!cur?.dirty) return true;
  const targetSid = nextSessionId ?? manualSessionId(nextDate, nextDay);
  if (cur.day === nextDay && cur.date === nextDate && (cur.sessionId ?? manualSessionId(cur.date, cur.day)) === targetSid) {
    return true;
  }
  return askConfirm({
    title: 'Cambiar de sesión sin guardar',
    message: 'Tienes series o cambios sin guardar en el entrenamiento actual. Si cambias ahora se descartarán.',
    confirmLabel: 'Descartar cambios',
    danger: true,
  });
}

let confirmResolver: ((ok: boolean) => void) | null = null;
function resolveConfirm(ok: boolean) {
  const res = confirmResolver;
  confirmResolver = null;
  S.confirmModal = undefined;
  render();
  res?.(ok);
}
function askConfirm(opts: NonNullable<State['confirmModal']>): Promise<boolean> {
  if (confirmResolver) confirmResolver(false);
  S.confirmModal = opts;
  render();
  return new Promise((resolve) => { confirmResolver = resolve; });
}

const actions: Record<string, (el: HTMLElement) => void | Promise<void>> = {
  confirmYes: () => resolveConfirm(true),
  confirmNo: () => resolveConfirm(false),
  tab: (el) => { setTab(arg(el)); render(); window.scrollTo(0, 0); },
  openExDetail: (el) => {
    const [day, ex] = splitPair(arg(el));
    if (!day || !ex) return;
    S.sel[day] = ex;
    setTab(day);
    render();
    window.scrollTo(0, 0);
  },
  goLog: async (el) => {
    const day = arg(el) as DayName | '';
    const today = new Date().toISOString().slice(0, 10);
    if (day) {
      const sameDraft = S.logDraft && S.logDraft.day === day && S.logDraft.date === today;
      if (!sameDraft) {
        if (!(await confirmSwitchDraft(day, today))) return;
        S.logDraft = initLogDraft(S, day, today);
        saveDraft(S.logDraft);
      }
    } else if (!S.logDraft) {
      S.logDraft = initLogDraft(S, routineNames(S.settings)[0] ?? 'Libre', today);
      saveDraft(S.logDraft);
    }
    setTab('log'); render(); window.scrollTo(0, 0);
  },
  logDay: async (el) => {
    const day = arg(el) as DayName | 'Libre';
    const date = S.logDraft?.date ?? new Date().toISOString().slice(0, 10);
    if (!(await confirmSwitchDraft(day, date))) return;
    S.logDraft = initLogDraft(S, day, date);
    saveDraft(S.logDraft);
    render();
  },
  logReset: async () => {
    if (!(await askConfirm({
      title: 'Reiniciar borrador',
      message: 'Se restaurarán los ejercicios y series por defecto de la rutina actual.',
      confirmLabel: 'Reiniciar',
      danger: true,
    }))) return;
    const day = S.logDraft?.day ?? routineNames(S.settings)[0] ?? 'Libre';
    const date = S.logDraft?.date ?? new Date().toISOString().slice(0, 10);
    S.logDraft = initLogDraft(S, day, date, S.logDraft?.sessionId);
    saveDraft(S.logDraft);
    render();
  },
  logToggleEx: (el) => {
    const ex = S.logDraft?.exercises[+arg(el)];
    if (!ex || !S.logDraft) return;
    const next = !ex.sets.every((s) => s.done);
    ex.sets.forEach((s) => { s.done = next; });
    ex.done = next;
    S.logDraft.dirty = true;
    saveDraft(S.logDraft);
    render();
  },
  logToggleSet: (el) => {
    const [ei, si] = arg(el).split('|').map(Number);
    const draft = S.logDraft;
    const ex = draft?.exercises[ei];
    const s = ex?.sets[si];
    if (!draft || !ex || !s) return;
    s.done = !s.done;
    ex.done = ex.sets.some((x) => Boolean(x.done));
    draft.dirty = true;
    if (s.done) {
      draft.restUntil = Date.now() + (draft.restSec ?? 90) * 1000;
      try { navigator.vibrate?.(15); } catch { /* navigator.vibrate opcional */ }
    }
    saveDraft(draft);
    syncSetDom(ei, si);
    updateRestBarDom();
    syncRestTicker();
  },
  logApplyWeight: (el) => {
    const [eiStr, wStr] = arg(el).split('|');
    const ei = +eiStr;
    const targetW = parseFloat(wStr);
    const draft = S.logDraft;
    const ex = draft?.exercises[ei];
    if (!draft || !ex || !Number.isFinite(targetW)) return;
    for (const s of ex.sets) {
      if (!s.done) s.w = Math.max(0, targetW);
    }
    draft.dirty = true;
    saveDraft(draft);
    render();
  },
  restStart: (el) => {
    if (!S.logDraft) return;
    const sec = Math.max(15, +arg(el) || 90);
    S.logDraft.restSec = sec;
    S.logDraft.restUntil = Date.now() + sec * 1000;
    saveDraft(S.logDraft);
    updateRestBarDom();
    syncRestTicker();
  },
  restAdjust: (el) => {
    if (!S.logDraft) return;
    const deltaSec = +arg(el) || 0;
    const base = Math.max(Date.now(), S.logDraft.restUntil ?? Date.now());
    S.logDraft.restUntil = Math.max(Date.now() + 1000, base + deltaSec * 1000);
    saveDraft(S.logDraft);
    updateRestBarDom();
    syncRestTicker();
  },
  restStop: () => {
    if (!S.logDraft) return;
    delete S.logDraft.restUntil;
    saveDraft(S.logDraft);
    updateRestBarDom();
    syncRestTicker();
  },
  logRemoveEx: (el) => {
    if (!S.logDraft) return;
    S.logDraft.exercises.splice(+arg(el), 1);
    S.logDraft.dirty = true;
    saveDraft(S.logDraft);
    render();
  },
  logMoveEx: (el) => {
    if (!S.logDraft) return;
    const [ei, dir] = arg(el).split('|').map(Number);
    if (!moveItem(S.logDraft.exercises, ei, ei + dir)) return;
    S.logDraft.dirty = true;
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
    if (!ex || !S.logDraft) return;
    const last = ex.sets[ex.sets.length - 1];
    ex.sets.push(last ? { w: last.w, r: last.r, done: false } : { w: 0, r: 10, done: false });
    S.logDraft.dirty = true;
    saveDraft(S.logDraft);
    render();
  },
  logDelSet: (el) => {
    const [ei, si] = arg(el).split('|').map(Number);
    const ex = S.logDraft?.exercises[ei];
    if (!ex || !S.logDraft) return;
    ex.sets.splice(si, 1);
    ex.done = ex.sets.some((s) => Boolean(s.done));
    S.logDraft.dirty = true;
    saveDraft(S.logDraft);
    render();
  },
  logStepW: (el) => {
    const [ei, si, step] = arg(el).split('|').map(Number);
    const s = S.logDraft?.exercises[ei]?.sets[si];
    if (!s || !S.logDraft) return;
    s.w = Math.max(0, Math.round((s.w + step) * 10) / 10);
    S.logDraft.dirty = true;
    saveDraft(S.logDraft);
    const inp = root.querySelector<HTMLInputElement>(`[data-log-w="${ei}|${si}"]`);
    if (inp) inp.value = String(s.w);
    else render();
  },
  logStepR: (el) => {
    const [ei, si, step] = arg(el).split('|').map(Number);
    const s = S.logDraft?.exercises[ei]?.sets[si];
    if (!s || !S.logDraft) return;
    s.r = Math.max(0, s.r + step);
    S.logDraft.dirty = true;
    saveDraft(S.logDraft);
    const inp = root.querySelector<HTMLInputElement>(`[data-log-r="${ei}|${si}"]`);
    if (inp) inp.value = String(s.r);
    else render();
    updateLogCountersDom(ei);
  },
  logSave: async () => {
    const draft = S.logDraft;
    if (!draft) return;
    const targetSessionId = draft.sessionId ?? manualSessionId(draft.date, draft.day);
    const rows: StrengthRow[] = [];
    const ts = Date.parse(`${draft.date}T12:00:00Z`) || Date.now();
    for (const ex of draft.exercises) {
      const sets = ex.sets
        .filter((s) => s.done && s.r > 0)
        .map((s) => ({ w: Math.max(0, Number(s.w) || 0), r: Math.max(1, Math.round(Number(s.r) || 0)) }));
      if (!sets.length) continue;
      rows.push({
        id: `${targetSessionId}-${norm(ex.name)}`,
        sessionId: targetSessionId,
        ts,
        date: draft.date,
        ref: `name:${ex.name.trim()}`,
        sets,
        ...(ex.note.trim() ? { note: ex.note.trim() } : {}),
        ...(draft.day !== 'Libre' ? { day: draft.day } : {}),
      });
    }
    if (!rows.length) { toast('Marca con ✓ al menos una serie completada (con repeticiones > 0) antes de guardar.'); return; }
    const legacySid = `manual-${draft.date}`;
    const oldSessionRows = S.strength.filter((r) =>
      r.sessionId === targetSessionId ||
      (r.id.startsWith('manual-') && r.sessionId === legacySid && (r.day ?? 'Libre') === draft.day),
    );
    for (const r of oldSessionRows) await deleteKey('strength', r.id);
    if (oldSessionRows.length) markBucketDeletes('strength', oldSessionRows.map((r) => ({ key: r.id, date: r.date })));
    await putMany('strength', rows);
    markBucketUpserts('strength', rows);
    const savedDay = draft.day;
    S.logDraft = undefined;
    saveDraft(undefined);
    await reload();
    if (savedDay !== 'Libre') setTab(savedDay);
    render();
    queueSync();
    toast(`Sesión guardada: ${rows.length} ${rows.length === 1 ? 'ejercicio' : 'ejercicios'}.`);
  },
  logEditSession: async (el) => {
    const parts = arg(el).split('|');
    const [sessionId, date, day] = parts.length >= 3 ? parts : ['', parts[0], parts[1]];
    const nextDay = (day as DayName | 'Libre') || 'Libre';
    if (!(await confirmSwitchDraft(nextDay, date, sessionId || undefined))) return;
    S.logDraft = initLogDraft(S, nextDay, date, sessionId || undefined);
    saveDraft(S.logDraft);
    render();
    window.scrollTo(0, 0);
  },
  logDelSession: async (el) => {
    const [sessionId, date] = arg(el).split('|');
    const byId = S.strength.filter((r) => r.sessionId === sessionId);
    const toDel = byId.length ? byId : S.strength.filter((r) => r.date === date);
    if (!toDel.length) return;
    if (!(await askConfirm({
      title: `Borrar sesión del ${date}`,
      message: `Se eliminarán ${toDel.length} ${toDel.length === 1 ? 'ejercicio' : 'ejercicios'} de esta sesión. Esta acción no se puede deshacer.`,
      confirmLabel: 'Borrar sesión',
      danger: true,
    }))) return;
    for (const r of toDel) await deleteKey('strength', r.id);
    markBucketDeletes('strength', toDel.map((r) => ({ key: r.id, date: r.date })));
    await reload();
    render();
    queueSync();
    toast('Sesión borrada.');
  },
  selEx: (el) => { const [d, n] = splitPair(arg(el)); S.sel[d] = n; render(); },
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
        cur.from = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
        cur.to = new Date().toISOString().slice(0, 10);
      }
    }
    render();
  },
  selMuscle: (el) => { S.muscleSel = arg(el); render(); },
  setExMetric: (el) => {
    const m = arg(el);
    S.exMetric = m === 'e1rm' || m === 'volume' ? m : 'top';
    render();
  },
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
    if (!(await askConfirm({
      title: 'Borrar medición',
      message: `¿Seguro que quieres eliminar el registro corporal del ${key}?`,
      confirmLabel: 'Borrar',
      danger: true,
    }))) return;
    await deleteKey('measures', key);
    markBucketDeletes('measures', [{ key, date: key }]);
    await reload();
    render();
    queueSync();
  },
  editNote: (el) => {
    const n = arg(el);
    if (!n) return;
    S.noteModal = { exName: n, value: S.settings.notes[n] ?? '' };
    render();
    const ta = document.getElementById('noteModalInput') as HTMLTextAreaElement | null;
    ta?.focus();
    ta?.setSelectionRange(ta.value.length, ta.value.length);
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
      !(await askConfirm({
        title: 'Cerrar sesión con cambios locales',
        message: 'Hay cambios locales sin subir a la nube. Si cierras sesión se limpiará la caché local de este dispositivo.',
        confirmLabel: 'Cerrar sesión',
        danger: true,
      }))
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
      ? 'Se borrarán todos los datos de este dispositivo y de tu nube conectada. Esta acción es irreversible.'
      : 'Se borrarán todos los datos almacenados en este dispositivo. Esta acción es irreversible.';
    if (!(await askConfirm({
      title: 'Borrar todos los datos',
      message: msg,
      confirmLabel: 'Borrar todo',
      danger: true,
    }))) return;
    await wipeAll();
    markWipePending();
    S.measureDraft = undefined;
    await reload();
    render();
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
    if (!S.exModal && !S.routineModal && !S.noteModal) return;
    S.exModal = undefined;
    S.routineModal = undefined;
    S.noteModal = undefined;
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
    if (count > 0 && !(await askConfirm({
      title: `Eliminar rutina "${name}"`,
      message: `Contiene ${count} ${count === 1 ? 'ejercicio' : 'ejercicios'} configurados. El historial ya guardado se conservará.`,
      confirmLabel: 'Eliminar rutina',
      danger: true,
    }))) return;
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
    if (!(await askConfirm({
      title: `Aplicar plantilla "${tpl.label}"`,
      message: 'Reemplazará la distribución actual de rutinas y objetivos.',
      confirmLabel: 'Aplicar plantilla',
    }))) return;
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
  rtQuickAdd: async (el) => {
    const [d, name] = splitPair(arg(el));
    if (!d || !name) return;
    S.planTargetRoutine = d;
    (S.settings.routines[d] ??= []).push({ name, sets: 3, reps: 10 });
    await persist();
    toast(`Añadido «${name}» a ${d}`);
  },
  rtDel: async (el) => {
    const [d, i] = splitPair(arg(el));
    S.settings.routines[d]?.splice(+i, 1);
    await persist();
  },
  rtMove: async (el) => {
    const parts = arg(el).split('|');
    const dir = Number(parts.pop());
    const idx = Number(parts.pop());
    const d = parts.join('|');
    const list = S.settings.routines[d];
    if (!list || !moveItem(list, idx, idx + dir)) return;
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
    S.measureDraft = undefined;
    render();
    document.getElementById('f-measure')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  clearMeasureDate: () => {
    S.measureDate = undefined;
    S.measurePerimOpen = undefined;
    S.measureDraft = undefined;
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
  logDate: async (el) => {
    const day = S.logDraft?.day ?? routineNames(S.settings)[0] ?? 'Libre';
    if (!(await confirmSwitchDraft(day, el.value))) {
      if (S.logDraft) el.value = S.logDraft.date;
      return;
    }
    S.logDraft = initLogDraft(S, day, el.value);
    saveDraft(S.logDraft);
    render();
  },
  measureDate: (el) => {
    S.measureDate = el.value || undefined;
    S.measurePerimOpen = undefined;
    S.measureDraft = undefined;
    render();
  },
  rangeFrom: (el) => {
    const scope = arg(el);
    ((S.customRanges ??= {})[scope] ??= {}).from = el.value || undefined;
    render();
  },
  rangeTo: (el) => {
    const scope = arg(el);
    ((S.customRanges ??= {})[scope] ??= {}).to = el.value || undefined;
    render();
  },
  selPerim: (el) => { S.perimeter = el.value; render(); },
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
  planTargetRoutine: (el) => {
    S.planTargetRoutine = el.value;
    render();
  },
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
root.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = (e.target as HTMLElement).closest<HTMLElement>('[role="button"][data-act]');
  if (!el) return;
  e.preventDefault();
  void actions[el.dataset.act!]?.(el);
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
      const imp = await importSamsungInWorker(files);
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
      render();
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
      render();
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
      render();
      queueSync();
      toast('Copia restaurada.');
    }
  } catch (err) { toast(`Error al importar: ${(err as Error).message}`); }
  el.value = '';
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
  if (el.dataset.input === 'planSearch') {
    S.planSearch = el.value;
    render();
    return;
  }
  if (el.closest('#f-measure') && el.name && el.name !== 'date') {
    (S.measureDraft ??= {})[el.name] = el.value;
    return;
  }
  if (!S.logDraft) return;
  if (el.dataset.logW) {
    const [ei, si] = el.dataset.logW.split('|').map(Number);
    const s = S.logDraft.exercises[ei]?.sets[si];
    if (s) { s.w = Math.max(0, parseFloat(el.value.replace(',', '.')) || 0); S.logDraft.dirty = true; saveDraft(S.logDraft); }
  } else if (el.dataset.logR) {
    const [ei, si] = el.dataset.logR.split('|').map(Number);
    const s = S.logDraft.exercises[ei]?.sets[si];
    if (s) {
      s.r = Math.max(0, parseInt(el.value, 10) || 0);
      S.logDraft.dirty = true;
      saveDraft(S.logDraft);
      updateLogCountersDom(ei);
    }
  } else if (el.dataset.logNote != null) {
    const ex = S.logDraft.exercises[+el.dataset.logNote];
    if (ex) { ex.note = el.value; S.logDraft.dirty = true; saveDraft(S.logDraft); }
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
    S.measureDraft = undefined;
    await reload(); render(); queueSync(); toast('Medición guardada.');
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
  } else if (f.id === 'f-note-modal' && S.noteModal) {
    const { exName } = S.noteModal;
    const val = String(fd.get('note') ?? '').trim();
    if (val) S.settings.notes[exName] = val;
    else delete S.settings.notes[exName];
    S.noteModal = undefined;
    await persist();
    toast(val ? `Nota guardada para ${exName}` : `Nota eliminada de ${exName}`);
  }
});
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (S.confirmModal) { resolveConfirm(false); return; }
  if (S.exModal || S.routineModal || S.noteModal) {
    S.exModal = undefined;
    S.routineModal = undefined;
    S.noteModal = undefined;
    render();
  }
});
window.addEventListener('hashchange', () => {
  const raw = initialTab();
  const next = isValidTab(raw) ? raw : 'home';
  if (next !== S.tab) { setTab(next); render(); }
});

window.addEventListener('online', () => { updateSyncDom(); queueSync(); });
window.addEventListener('offline', () => updateSyncDom());
window.matchMedia('(min-width: 1024px)').addEventListener('change', () => render());

initSortableLists(root, async (scope, from, to) => {
  if (scope === 'log') {
    if (!S.logDraft || !moveItem(S.logDraft.exercises, from, to)) return;
    S.logDraft.dirty = true;
    saveDraft(S.logDraft);
    render();
  } else if (scope.startsWith('rt:')) {
    const d = scope.slice(3);
    const list = S.settings.routines[d];
    if (!list || !moveItem(list, from, to)) return;
    await persist();
  }
});

reload().then(async () => {
  await consumeRedirectAuth();
  S.lastSync = loadSyncMeta().lastSyncAt;
  render();
  subscribeAuth((user) => {
    const wasReady = Boolean(S.authReady);
    const changed = user?.uid !== S.user?.uid;
    S.authReady = true;
    S.user = user;
    if (changed || !wasReady) render();
    if (user && changed && navigator.onLine) void runSync(false);
  });
});
