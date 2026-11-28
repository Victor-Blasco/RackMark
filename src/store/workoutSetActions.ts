import type { LiveWorkout, SetKind } from '../types';
import type { ToastAction } from './types';
import { createWorkoutSetInputs, mapExercise } from './workoutSetInputs';
import { applyToggleLiveSet } from './workoutSetToggle';

/**
 * Crea las acciones inmutables de edición de series y notas para la sesión en vivo.
 *
 * @param getLive - Obtiene la sesión en vivo actual.
 * @param saveOnly - Persiste en `localStorage` sin forzar re-render.
 * @param commit - Persiste en `localStorage` y notifica a Preact.
 * @param toast - Muestra avisos al usuario ante validaciones (con acción opcional `Deshacer`).
 * @param getExerciseRestSec - Opcional: resuelve el descanso configurado en la rutina para un ejercicio.
 * @returns Acciones tipadas para manipular series del ejercicio activo.
 */
export function createWorkoutSetActions(
  getLive: () => LiveWorkout | undefined,
  saveOnly: (live?: LiveWorkout) => void,
  commit: (live?: LiveWorkout) => void,
  toast: (msg: string, action?: ToastAction) => void,
  getExerciseRestSec?: (live: LiveWorkout, ei: number) => number | undefined,
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
      const removedSet = ex?.sets[si];
      if (!live || !ex || !removedSet || ex.sets.length <= 1 || si < 0 || si >= ex.sets.length) return;
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
      const exName = ex.name;
      const startedAt = live.startedAt;
      toast(`Serie ${si + 1} eliminada.`, {
        label: 'Deshacer',
        onAction: () => {
          const cur = getLive();
          if (!cur || cur.startedAt !== startedAt) return;
          const targetEi = cur.exercises[ei]?.name === exName ? ei : cur.exercises.findIndex((x) => x.name === exName);
          if (targetEi < 0) return;
          commit(mapExercise(cur, targetEi, (item) => {
            const idx = Math.min(si, item.sets.length);
            const sets = [...item.sets.slice(0, idx), removedSet, ...item.sets.slice(idx)];
            return { ...item, sets, done: sets.some((x) => Boolean(x.done && x.r > 0)) };
          }));
        },
      });
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
      if (!live?.exercises[ei] || !Number.isFinite(targetW)) return;
      const nextW = Math.max(0, targetW);
      commit(mapExercise(live, ei, (item) => ({
        ...item,
        sets: item.sets.map((s) => (s.done ? s : { ...s, w: nextW })),
      })));
    },

    toggleSet(ei: number, si: number) {
      const live = getLive();
      if (!live) return;
      const exRest = getExerciseRestSec?.(live, ei);
      const { nextLive, changed, advanced } = applyToggleLiveSet(live, ei, si, toast, exRest);
      if (!changed) return;
      commit(nextLive);
      if (advanced && typeof window !== 'undefined') window.scrollTo?.(0, 0);
    },

    setSetKind(ei: number, si: number, kind: SetKind) {
      const live = getLive();
      if (!live?.exercises[ei]?.sets[si]) return;
      commit(mapExercise(live, ei, (item) => ({
        ...item,
        sets: item.sets.map((s, j) => {
          if (j !== si) return s;
          if (kind === 'S') {
            const { kind: _k, ...rest } = s;
            return rest;
          }
          return { ...s, kind };
        }),
      })));
    },

    addDropSet(ei: number, si: number) {
      const live = getLive();
      const ex = live?.exercises[ei];
      const base = ex?.sets[si];
      if (!live || !ex || !base) return;
      const dropW = Math.max(0, Math.round((base.w * 0.8) / 2.5) * 2.5);
      const dropSet = { w: dropW, r: base.r || 8, kind: 'D' as const, done: false };
      const nextRestRef = live.restRef?.ei === ei && live.restRef.si > si
        ? { ...live.restRef, si: live.restRef.si + 1 }
        : live.restRef;
      const nextLive = mapExercise({ ...live, restRef: nextRestRef }, ei, (item) => {
        const sets = [...item.sets.slice(0, si + 1), dropSet, ...item.sets.slice(si + 1)];
        return { ...item, sets, done: sets.every((s) => Boolean(s.done && s.r > 0)) };
      });
      commit(nextLive);
    },
  };
}
