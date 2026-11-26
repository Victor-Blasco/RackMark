import { daysAgoIso, isValidIsoDate } from '../lib/seed';
import type { DayName } from '../types';
import { todayIso, type PlanTab, type RangeKey, type State } from '../ui/shared';

/**
 * Crea acciones de filtrado, rangos temporales, selección y navegación ligera para `Home`, `Rutina` y `Plan`.
 *
 * @param state - Lector del estado global.
 * @param render - Fuerza actualización reactiva de la UI.
 * @param navigateTab - Cambia de pestaña manteniendo historial/scroll.
 * @returns Manejadores de filtros, selectores y navegación rápida.
 */
export function createPlanFilterActions(
  state: () => State,
  render: () => void,
  navigateTab: (tab: string) => void,
) {
  return {
    setRange: (scope: string, key: RangeKey) => {
      const S = state();
      S.ranges = { ...S.ranges, [scope]: key };
      if (key === 'Custom') {
        const cur = S.customRanges?.[scope] ?? {};
        if (!cur.from && !cur.to) {
          S.customRanges = {
            ...S.customRanges,
            [scope]: { from: daysAgoIso(30), to: todayIso() },
          };
        }
      }
      render();
    },

    setCustomRangeDate: (scope: string, edge: 'from' | 'to', val: string) => {
      const S = state();
      if (val && !isValidIsoDate(val)) return;
      const cur = S.customRanges?.[scope] ?? {};
      S.customRanges = { ...S.customRanges, [scope]: { ...cur, [edge]: val || undefined } };
      render();
    },

    selectHomeEx: (exName: string) => {
      const S = state();
      S.sel = { ...S.sel, home: exName };
      render();
    },

    openExDetail: (day: DayName, exName: string) => {
      const S = state();
      S.sel = { ...S.sel, [day]: exName };
      navigateTab(day);
    },

    selectDayEx: (day: DayName, exName: string) => {
      const S = state();
      S.sel = { ...S.sel, [day]: exName };
      render();
    },

    setDayScope: (day: DayName, mode: 'routine' | 'extra') => {
      const S = state();
      S.dayExtra = { ...S.dayExtra, [day]: mode === 'extra' };
      const { [day]: _cleared, ...restSel } = S.sel;
      S.sel = restSel;
      render();
    },

    setPlanTab: (tab: PlanTab) => {
      state().planTab = tab;
      render();
    },

    openPlanTab: (tab: PlanTab) => {
      state().planTab = tab;
      navigateTab('plan');
    },

    setPlanRoutine: (day: string) => {
      state().planRoutine = day;
      render();
    },

    setExerciseMapSearch: (q: string) => {
      state().exerciseMapSearch = q;
      render();
    },

    clearExerciseMapSearch: () => {
      state().exerciseMapSearch = '';
      render();
    },

    setExerciseMapMuscle: (muscle?: string) => {
      state().exerciseMapMuscle = muscle || undefined;
      render();
    },

    toggleExerciseMapAll: () => {
      const S = state();
      S.showAllExerciseMap = !S.showAllExerciseMap;
      render();
    },

    openUnmapped: () => {
      state().planTab = 'exercises';
      navigateTab('plan');
    },

    openRoutineInPlan: (day?: DayName) => {
      const S = state();
      S.planTab = 'routines';
      if (day) S.planRoutine = day;
      navigateTab('plan');
    },
  };
}
