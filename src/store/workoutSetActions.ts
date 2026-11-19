import type { LiveWorkout } from '../types';
import { createWorkoutSetInputs, mapExercise } from './workoutSetInputs';
import { applyToggleLiveSet } from './workoutSetToggle';

/**
 * Crea las acciones inmutables de edición de series y notas para la sesión en vivo.
 *
 * @param getLive - Obtiene la sesión en vivo actual.
 * @param saveOnly - Persiste en `localStorage` sin forzar re-render.
 * @param commit - Persiste en `localStorage` y notifica a Preact.
 * @param toast - Muestra avisos al usuario ante validaciones.
 * @returns Acciones tipadas para manipular series del ejercicio activo.
 */
export function createWorkoutSetActions(
  getLive: () => LiveWorkout | undefined,
  saveOnly: (live?: LiveWorkout) => void,
  commit: (live?: LiveWorkout) => void,
  toast: (msg: string) => void,
) {
  return {
    ...createWorkoutSetInputs(getLive, saveOnly, commit),

    addSet(ei: number) {
      const live = getLive();
      const ex = live?.exercises[ei];
      if (!live || !ex) return;
      const last = ex.sets.at(-1) ?? { w: 0, r: 8 };
      commit(mapExercise(live, ei, (item) => ({ ...item, sets: [...item.sets, { w: last.w, r: last.r, done: false }] })));
    },

    delSet(ei: number, si: number) {
      const live = getLive();
      const ex = live?.exercises[ei];
      if (!live || !ex || ex.sets.length <= 1 || si < 0 || si >= ex.sets.length) return;
      const nextExercises = live.exercises.map((item, i) => {
        if (i !== ei) return item;
        const sets = item.sets.filter((_, j) => j !== si);
        return { ...item, sets, done: sets.some((x) => Boolean(x.done && x.r > 0)) };
      });
      let nextRestRef = live.restRef;
      if (nextRestRef?.ei === ei) {
        if (nextRestRef.si === si) nextRestRef = undefined;
        else if (nextRestRef.si > si) nextRestRef = { ...nextRestRef, si: nextRestRef.si - 1 };
      }
      commit({ ...live, exercises: nextExercises, restRef: nextRestRef });
    },

    addExtraSetPrev() {
      const live = getLive();
      const prevIdx = live?.lastCompletedExIdx;
      const prevEx = prevIdx != null ? live?.exercises[prevIdx] : undefined;
      if (!live || prevIdx == null || !prevEx) return;
      const last = prevEx.sets.at(-1) ?? { w: 0, r: 8 };
      const nextLive = mapExercise(live, prevIdx, (item) => ({
        ...item,
        sets: [...item.sets, { w: last.w, r: last.r, done: false }],
      }));
      commit({ ...nextLive, curIdx: prevIdx, lastCompletedExIdx: undefined });
    },

    applyTargetWeight(ei: number, targetW: number) {
      const live = getLive();
      if (!live || !live.exercises[ei] || !Number.isFinite(targetW)) return;
      const nextW = Math.max(0, targetW);
      commit(mapExercise(live, ei, (item) => ({
        ...item,
        sets: item.sets.map((s) => (s.done ? s : { ...s, w: nextW })),
      })));
    },

    toggleSet(ei: number, si: number) {
      const live = getLive();
      if (!live) return;
      const { nextLive, changed, advanced } = applyToggleLiveSet(live, ei, si, toast);
      if (!changed) return;
      commit(nextLive);
      if (advanced) window.scrollTo?.(0, 0);
    },
  };
}
