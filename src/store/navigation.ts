import { norm } from '../lib/seed';
import type { IconName } from '../ui/icons';
import type { PlanTab, State } from '../ui/shared';

export const ANALYTICS_TABS: { id: string; label: string; icon: IconName }[] = [
  { id: 'body', label: 'Cuerpo', icon: 'body' },
  { id: 'volume', label: 'Volumen', icon: 'chart' },
  { id: 'adherence', label: 'Adherencia', icon: 'calendar' },
  { id: 'phases', label: 'Fases del bloque', icon: 'calendar' },
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

export const PLAN_TABS: { id: PlanTab; label: string; shortLabel: string; icon: IconName }[] = [
  { id: 'exercises', label: 'Catálogo y músculos', shortLabel: 'Catálogo', icon: 'barbell' },
  { id: 'phases', label: 'Fases del bloque', shortLabel: 'Fases', icon: 'calendar' },
];

export const TAB_TITLES: Record<string, string> = {
  home: 'Resumen',
  workout: 'Iniciar entrenamiento',
  log: 'Registrar entreno',
  plan: 'Planificación',
  body: 'Cuerpo',
  volume: 'Volumen',
  adherence: 'Adherencia',
  phases: 'Fases del bloque',
  calc: 'Calculadoras',
  data: 'Datos e importación',
  settings: 'Cuenta y ajustes',
};

export const ANALYTICS_IDS = new Set<string>(ANALYTICS_TABS.map((t) => t.id));
export const SYSTEM_IDS = new Set<string>(SYSTEM_TABS.map((t) => t.id));
export const FIXED_TAB_IDS = new Set<string>(Object.keys(TAB_TITLES));
export const RESERVED_ROUTINE_NORMS = new Set([...FIXED_TAB_IDS, 'libre'].map((x) => norm(x)));

/** Comprueba si el identificador corresponde a una rutina definida en ajustes. */
export const isRoutineTab = (state: State, tab: string): boolean => Boolean(state.settings?.routines?.[tab]);

/** Comprueba si una pestaña existe como vista fija o rutina activa. */
export const isValidTab = (state: State, tab: string): boolean => FIXED_TAB_IDS.has(tab) || isRoutineTab(state, tab);

/** Devuelve el título visible y accesible para la pestaña actual. */
export function activeTabTitle(state: State): string {
  if (state.tab === 'workout' && state.liveWorkout) return 'Entreno en vivo';
  if (state.tab === 'plan') {
    if (state.planTab === 'phases') return 'Fases del bloque';
    if (!state.planTab || state.planTab === 'exercises') return 'Catálogo y músculos';
  }
  return TAB_TITLES[state.tab] ?? (isRoutineTab(state, state.tab) ? `Rutina ${state.tab}` : 'RackMark');
}

/**
 * Calcula texto y color del indicador de sincronización con la nube.
 *
 * @param state - Estado global con usuario y trabajos de sync.
 * @param unsynced - Indica si hay cambios locales pendientes.
 * @param online - Estado de conectividad del navegador.
 * @returns Par `{ text, cls }` listo para pintar en cabecera y barra lateral.
 */
export function syncStatusInfo(
  state: State,
  unsynced: boolean,
  online = typeof navigator === 'undefined' ? true : navigator.onLine,
): { text: string; cls: string } {
  if (!state.user) return { text: online ? 'En este dispositivo' : 'Sin conexión · local', cls: 'text-gray-400' };
  if (!state.user.emailVerified) return { text: 'Correo pendiente de verificar', cls: 'text-amberGold' };
  if (state.syncing) return { text: 'Sincronizando…', cls: 'text-blue-300' };
  if (state.syncJob?.status === 'error') return { text: 'Error de sincronización · reintentando', cls: 'text-rose-300' };
  if (state.syncJob?.status === 'pending') return { text: 'Guardado local · pendiente de subir', cls: 'text-amberGold' };
  if (!online) {
    return unsynced
      ? { text: 'Offline · pendiente de subir', cls: 'text-amberGold' }
      : { text: 'Sin conexión · caché offline', cls: 'text-gray-400' };
  }
  if (unsynced) return { text: 'Pendiente de sincronizar', cls: 'text-amberGold' };
  return { text: 'Sincronizado', cls: 'text-emerald-400' };
}

/**
 * Calcula los contadores globales de cabecera y navegación del shell raíz.
 *
 * @param state - Estado global con sesiones, medidas y borradores activos.
 * @returns Resumen textual y conteo de series/ejercicios activos.
 */
export function buildShellCounters(state: State): { statsText: string; liveCount: number; draftCount: number } {
  const statsText = state.strength.length
    ? `${state.analysis.sessions.length} sesiones · ${state.measures.length} medidas`
    : 'Sin sesiones aún';
  const liveCount = state.liveWorkout?.exercises.reduce(
    (acc, e) => acc + e.sets.filter((s) => s.done && s.r > 0).length,
    0,
  ) ?? 0;
  const draftCount = state.logDraft?.exercises.filter((e) => e.sets.some((s) => s.done && s.r > 0)).length ?? 0;
  return { statsText, liveCount, draftCount };
}
