import { inRange, routineColor, type DateBounds, type State } from '../ui/shared';
import { CARDIO_CALENDAR_COLOR, OTHER_CALENDAR_COLOR } from './adherenceCalendar';

/** Chip de filtro disponible para las sesiones recientes de adherencia. */
export interface AdherenceSessionFilter {
  id: string;
  label: string;
  color?: string;
}

/** Elemento unificado de sesión reciente (rutina de fuerza o cardio). */
export type AdherenceSessionItem =
  | {
      kind: 'strength';
      id: string;
      date: string;
      day: string;
      routineKey: string;
      color: string;
      exCount: number;
      sets: number;
      durMin?: number;
      avgHr?: number;
      kcal?: number;
    }
  | {
      kind: 'cardio';
      id: string;
      date: string;
      color: string;
      durMin: number;
      distKm: number;
      avgHr?: number;
      kcal?: number;
      vo2?: number;
    };

/**
 * Combina sesiones de fuerza y cardio del rango seleccionado y construye sus filtros por rutina/tipo.
 *
 * @param state - Estado global de la aplicación.
 * @param bounds - Rango temporal activo en `Adherencia`.
 * @param routines - Lista ordenada de nombres de rutinas configuradas.
 * @returns Sesiones ordenadas descendentes por fecha y chips de filtro aplicables.
 */
export function buildAdherenceSessions(
  state: State,
  bounds: DateBounds,
  routines: string[],
): { recentSessions: AdherenceSessionItem[]; sessionFilters: AdherenceSessionFilter[] } {
  const strengthItems: AdherenceSessionItem[] = state.analysis.sessions
    .filter((s) => inRange(s.date, bounds))
    .map((s) => {
      const idx = s.day ? routines.indexOf(s.day) : -1;
      return {
        kind: 'strength',
        id: s.id,
        date: s.date,
        day: s.day ?? 'Entreno libre',
        routineKey: s.day ?? 'Libre',
        color: s.day ? routineColor(s.day, state.settings, Math.max(0, idx)) : OTHER_CALENDAR_COLOR,
        exCount: s.exercises.length,
        sets: s.sets,
        durMin: s.durMin,
        avgHr: s.avgHr,
        kcal: s.kcal,
      };
    });

  const cardioItems: AdherenceSessionItem[] = state.cardio
    .filter((c) => inRange(c.date, bounds))
    .map((c) => ({
      kind: 'cardio',
      id: c.id,
      date: c.date,
      color: CARDIO_CALENDAR_COLOR,
      durMin: c.durMin,
      distKm: c.distKm,
      avgHr: c.avgHr,
      kcal: c.kcal,
      vo2: c.vo2,
    }));

  const recentSessions = [...strengthItems, ...cardioItems].sort((a, b) => {
    const cmp = b.date.localeCompare(a.date);
    if (cmp !== 0) return cmp;
    if (a.kind !== b.kind) return a.kind === 'strength' ? -1 : 1;
    return b.id.localeCompare(a.id);
  });

  const sessionFilters: AdherenceSessionFilter[] = [
    { id: 'all', label: 'Todas' },
    ...routines.map((r, idx) => ({ id: r, label: r, color: routineColor(r, state.settings, idx) })),
  ];
  if (strengthItems.some((s) => s.kind === 'strength' && s.routineKey === 'Libre')) {
    sessionFilters.push({ id: 'Libre', label: 'Libre', color: OTHER_CALENDAR_COLOR });
  }
  if (cardioItems.length > 0 || state.cardio.length > 0) {
    sessionFilters.push({ id: 'cardio', label: 'Cardio', color: CARDIO_CALENDAR_COLOR });
  }

  return { recentSessions, sessionFilters };
}
