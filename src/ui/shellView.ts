import type { DayName } from '../types';
import { norm } from '../lib/seed';
import { icon, type IconName } from './icons';
import { fmtMMSS } from './logView';
import { esc, routineColor, routineNames, type State } from './shared';

export const ANALYTICS_TABS: { id: string; label: string; icon: IconName }[] = [
  { id: 'body', label: 'Cuerpo', icon: 'body' },
  { id: 'volume', label: 'Volumen', icon: 'chart' },
  { id: 'adherence', label: 'Adherencia', icon: 'calendar' },
  { id: 'calc', label: 'Calculadoras', icon: 'calc' },
];

export const SYSTEM_TABS = [
  { id: 'settings', label: 'Cuenta y ajustes' },
  { id: 'data', label: 'Datos e importar' },
];

export const TRAIN_TABS = [
  { id: 'workout', label: 'En vivo' },
  { id: 'log', label: 'Registrar hecho' },
];

export const TAB_TITLES: Record<string, string> = {
  home: 'Resumen',
  workout: 'Iniciar entrenamiento',
  log: 'Registrar entreno',
  plan: 'Plan y rutinas',
  body: 'Cuerpo',
  volume: 'Volumen',
  adherence: 'Adherencia',
  calc: 'Calculadoras',
  data: 'Datos e importación',
  settings: 'Cuenta y ajustes',
};

export const ANALYTICS_IDS = new Set<string>(ANALYTICS_TABS.map((t) => t.id));
export const SYSTEM_IDS = new Set<string>(SYSTEM_TABS.map((t) => t.id));
export const FIXED_TAB_IDS = new Set<string>(Object.keys(TAB_TITLES));
export const RESERVED_ROUTINE_NORMS = new Set([...FIXED_TAB_IDS, 'libre'].map((x) => norm(x)));

export const isRoutineTab = (S: State, tab: string): boolean => Boolean(S.settings?.routines?.[tab]);
export const isValidTab = (S: State, tab: string): boolean => FIXED_TAB_IDS.has(tab) || isRoutineTab(S, tab);

export function activeTabTitle(S: State): string {
  return TAB_TITLES[S.tab] ?? (isRoutineTab(S, S.tab) ? `Rutina ${S.tab}` : 'GymApp');
}

export function syncStatusInfo(
  S: State,
  unsynced: boolean,
  online = typeof navigator === 'undefined' ? true : navigator.onLine,
): { text: string; cls: string } {
  if (!S.user) return { text: online ? 'Solo local' : 'Sin conexión · local', cls: 'text-gray-400' };
  if (S.syncing) return { text: 'Sincronizando…', cls: 'text-blue-300' };
  if (!online) {
    return unsynced
      ? { text: 'Offline · pendiente de subir', cls: 'text-amberGold' }
      : { text: 'Sin conexión · caché offline', cls: 'text-gray-400' };
  }
  if (unsynced) return { text: 'Pendiente de sincronizar', cls: 'text-amberGold' };
  return { text: 'Sincronizado', cls: 'text-emerald-400' };
}

export function renderSidebar(
  S: State,
  statsText: string,
  liveCount: number,
  draftCount: number,
  unsynced: boolean,
): string {
  const routineBtns = routineNames(S.settings).map((id, idx) => {
    const active = S.tab === id;
    const count = (S.settings.routines[id] ?? []).length;
    const col = routineColor(id, S.settings, idx);
    const sub = S.settings.routineMeta?.[id]?.sub;
    return `<button data-act="tab" data-arg="${esc(id)}" ${active ? 'aria-current="page"' : ''} class="nav-item ${active ? 'nav-item-on' : ''}">
      <span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background-color:${col}"></span>
      <span class="flex-1 truncate text-left">${esc(id)}${sub ? ` <span class="text-xs font-normal text-gray-400">· ${esc(sub)}</span>` : ''}</span>
      <span class="font-mono text-[11px] text-gray-400 tabular-nums">${count}</span>
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
  const restUntil = S.liveWorkout?.restUntil;
  const restRemSec = restUntil != null && restUntil > Date.now() ? Math.ceil((restUntil - Date.now()) / 1000) : 0;

  return `<aside aria-label="Navegación de escritorio" class="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col border-r border-borderDark/80 bg-navDark">
    <div class="flex items-center gap-3 border-b border-borderDark/80 px-4 py-4">
      <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-electricBlue text-white shadow-sm">${icon('barbell', 'h-5 w-5')}</div>
      <div class="min-w-0">
        <p class="truncate text-sm font-extrabold text-white">GymApp</p>
        <p class="truncate text-[11px] text-gray-400 tabular-nums">${statsText}</p>
      </div>
    </div>

    <div class="p-3 space-y-2">
      <button data-act="tab" data-arg="workout" ${S.tab === 'workout' ? 'aria-current="page"' : ''} class="flex w-full items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white shadow-sm transition-all active:scale-[0.98] ${S.tab === 'workout' ? 'bg-electricBlue ring-2 ring-blue-300/60' : 'bg-electricBlue hover:bg-blue-500'}">
        ${icon('play', 'h-4 w-4')}
        <span>Iniciar entreno</span>
        <span data-nav-rest class="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold tabular-nums text-white ${restRemSec > 0 ? '' : 'hidden'}">${restRemSec > 0 ? fmtMMSS(restRemSec) : ''}</span>
        ${liveCount > 0 ? `<span class="${restRemSec > 0 ? '' : 'ml-auto '}inline-flex items-center gap-1 rounded-full bg-emeraldGreen/25 px-2 py-0.5 text-[10px] font-bold text-emerald-200"><span class="h-1.5 w-1.5 rounded-full bg-emeraldGreen"></span>${liveCount}</span>` : ''}
      </button>
      <button data-act="tab" data-arg="log" ${S.tab === 'log' ? 'aria-current="page"' : ''} class="flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${S.tab === 'log' ? 'border-electricBlue bg-electricBlue/15 text-blue-300' : 'border-white/10 bg-gray-900/70 text-gray-300 hover:border-white/25 hover:text-white'}">
        ${icon('edit', 'h-3.5 w-3.5')}
        <span>Registrar ya hecho</span>
        ${draftCount > 0 ? `<span class="ml-auto rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-gray-200 tabular-nums">${draftCount}</span>` : ''}
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
          <span>Datos y copias</span>
        </button>
      </div>
    </nav>

    <div class="mt-auto space-y-2 border-t border-borderDark/80 p-3">
      ${(() => {
        const st = syncStatusInfo(S, unsynced);
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

export function renderMobileHeader(S: State, statsText: string, unsynced: boolean): string {
  const inRoutine = isRoutineTab(S, S.tab) || S.tab === 'plan';
  const inAnalytics = ANALYTICS_IDS.has(S.tab);
  const inSystem = SYSTEM_IDS.has(S.tab);
  const inTrain = S.tab === 'workout' || S.tab === 'log';
  const rNames = routineNames(S.settings);
  const headerTitle = activeTabTitle(S);
  const st = syncStatusInfo(S, unsynced);
  const subNav = inRoutine
    ? `<div role="tablist" aria-label="Rutinas" class="mt-2 flex gap-1 overflow-x-auto rounded-xl border border-borderDark/80 bg-navDark p-1">${rNames.map((id, idx) => {
        const active = S.tab === id;
        return `<button role="tab" aria-selected="${active}" data-act="tab" data-arg="${esc(id)}" class="flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${active ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}">
          <span class="h-2 w-2 rounded-full" style="background-color:${routineColor(id, S.settings, idx)}"></span>
          <span>${esc(id)}</span>
        </button>`;
      }).join('')}<button role="tab" aria-selected="${S.tab === 'plan'}" data-act="tab" data-arg="plan" class="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${S.tab === 'plan' ? 'bg-electricBlue/20 text-blue-300' : 'text-gray-400 hover:text-gray-200'}">Plan</button></div>`
    : inAnalytics
      ? `<div role="tablist" aria-label="Vistas de análisis" class="mt-2 grid grid-cols-4 gap-1 rounded-xl border border-borderDark/80 bg-navDark p-1">${ANALYTICS_TABS.map((a) => {
          const active = S.tab === a.id;
          return `<button role="tab" aria-selected="${active}" data-act="tab" data-arg="${a.id}" class="flex min-h-[44px] min-w-0 items-center justify-center rounded-lg px-1.5 py-1.5 text-center text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${active ? 'bg-electricBlue/20 text-blue-300' : 'text-gray-400 hover:text-gray-200'}"><span class="truncate">${a.label === 'Calculadoras' ? 'Calc.' : a.label}</span></button>`;
        }).join('')}</div>`
      : inTrain
        ? `<div role="tablist" aria-label="Modo de entrenamiento" class="mt-2 grid grid-cols-2 gap-1 rounded-xl border border-borderDark/80 bg-navDark p-1">${TRAIN_TABS.map((t) => {
            const active = S.tab === t.id;
            return `<button role="tab" aria-selected="${active}" data-act="tab" data-arg="${t.id}" class="flex min-h-[44px] min-w-0 items-center justify-center rounded-lg px-2 py-1.5 text-center text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${active ? 'bg-electricBlue/20 text-blue-300' : 'text-gray-400 hover:text-gray-200'}"><span class="truncate">${t.label}</span></button>`;
          }).join('')}</div>`
        : inSystem
          ? `<div role="tablist" aria-label="Cuenta y datos" class="mt-2 grid grid-cols-2 gap-1 rounded-xl border border-borderDark/80 bg-navDark p-1">${SYSTEM_TABS.map((t) => {
              const active = S.tab === t.id;
              return `<button role="tab" aria-selected="${active}" data-act="tab" data-arg="${t.id}" class="flex min-h-[44px] min-w-0 items-center justify-center rounded-lg px-2 py-1.5 text-center text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${active ? 'bg-electricBlue/20 text-blue-300' : 'text-gray-400 hover:text-gray-200'}"><span class="truncate">${t.label}</span></button>`;
            }).join('')}</div>`
          : '';

  return `<header class="sticky top-0 z-30 border-b border-borderDark bg-bgDark px-3 py-2 pt-[max(env(safe-area-inset-top),0.5rem)] lg:hidden">
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-2.5">
      <div class="flex min-w-0 items-center gap-2.5">
        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-electricBlue text-white shadow-sm">${icon('barbell', 'h-5 w-5')}</div>
        <div class="min-w-0">
          <h1 class="truncate text-sm font-extrabold leading-tight text-white">${esc(headerTitle)}</h1>
          <p class="truncate text-[11px] text-gray-400 tabular-nums">${statsText} · <span data-sync-badge data-sync-base="font-medium" class="font-medium ${st.cls}">${st.text}</span></p>
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        ${S.authReady && !S.user ? `<button data-act="cloudLogin" ${S.syncing ? 'disabled' : ''} aria-label="Iniciar sesión con Google" title="Iniciar sesión con Google" class="flex h-11 items-center gap-1.5 rounded-xl border border-electricBlue/40 bg-electricBlue/15 px-3 text-xs font-bold text-blue-300 transition-colors hover:bg-electricBlue/25 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue">
          ${icon('login', 'h-3.5 w-3.5')}
          <span>Entrar</span>
        </button>` : ''}
        <button data-act="tab" data-arg="settings" aria-label="Cuenta y ajustes" ${inSystem ? 'aria-current="page"' : ''} class="flex h-11 w-11 items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${inSystem ? 'border-electricBlue bg-electricBlue/15 text-blue-300' : 'border-borderDark bg-gray-900/80 text-gray-400 hover:text-white'}">
          ${icon('gear', 'h-5 w-5')}
        </button>
      </div>
    </div>
    ${subNav}
  </header>`;
}

export function renderMobileNav(
  S: State,
  liveCount: number,
  draftCount: number,
  lastRoutine: DayName,
  lastAnalytics: string,
): string {
  const inRoutine = isRoutineTab(S, S.tab) || S.tab === 'plan';
  const inAnalytics = ANALYTICS_IDS.has(S.tab);
  const inTrain = S.tab === 'workout' || S.tab === 'log';
  const restUntil = S.liveWorkout?.restUntil;
  const restRemSec = restUntil != null && restUntil > Date.now() ? Math.ceil((restUntil - Date.now()) / 1000) : 0;
  return `<nav aria-label="Navegación principal móvil" class="fixed inset-x-0 bottom-0 z-30 border-t border-borderDark bg-navDark px-2 pb-[env(safe-area-inset-bottom)] lg:hidden">
    <div class="mx-auto grid max-w-md grid-cols-4 items-center gap-1">
      <button data-act="tab" data-arg="home" ${S.tab === 'home' ? 'aria-current="page"' : ''} class="bnav-item ${S.tab === 'home' ? 'bnav-item-on' : ''}">
        ${icon('home', 'h-5 w-5')}
        <span>Resumen</span>
      </button>
      <button data-act="tab" data-arg="${esc(lastRoutine)}" ${inRoutine ? 'aria-current="page"' : ''} class="bnav-item ${inRoutine ? 'bnav-item-on' : ''}">
        ${icon('barbell', 'h-5 w-5')}
        <span class="truncate max-w-full">${S.tab === 'plan' ? 'Rutinas · Plan' : isRoutineTab(S, S.tab) ? esc(S.tab) : 'Rutinas'}</span>
      </button>
      <button data-act="tab" data-arg="${lastAnalytics}" ${inAnalytics ? 'aria-current="page"' : ''} class="bnav-item ${inAnalytics ? 'bnav-item-on' : ''}">
        ${icon('chart', 'h-5 w-5')}
        <span>Análisis</span>
      </button>
      <button data-act="tab" data-arg="workout" ${inTrain ? 'aria-current="page"' : ''} class="bnav-item">
        <span class="relative inline-flex items-center justify-center rounded-full px-3.5 py-1 text-white shadow-sm bg-electricBlue ${inTrain ? 'ring-2 ring-blue-300/60' : ''}">
          ${icon('play', 'h-4 w-4')}
          <span data-nav-rest class="ml-1 text-[10px] font-bold tabular-nums text-blue-100 ${restRemSec > 0 ? '' : 'hidden'}">${restRemSec > 0 ? fmtMMSS(restRemSec) : ''}</span>
          ${liveCount > 0 || S.liveWorkout != null || draftCount > 0 ? `<span class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emeraldGreen ring-2 ring-navDark"></span>` : ''}
        </span>
        <span class="${inTrain ? 'text-blue-300' : 'text-gray-200'}">Entrenar</span>
      </button>
    </div>
  </nav>`;
}
