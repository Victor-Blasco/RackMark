import type { LiveWorkout, LogExDraft, SetRec } from '../types';
import { applyToggleLiveSet } from './workoutSetToggle';

const mapExercise = (
  live: LiveWorkout,
  ei: number,
  updater: (ex: LogExDraft) => LogExDraft,
): LiveWorkout => ({
  ...live,
  exercises: live.exercises.map((ex, i) => (i === ei ? updater(ex) : ex)),
});

const mapSet = (
  live: LiveWorkout,
  ei: number,
  si: number,
  updater: (s: SetRec) => SetRec,
): LiveWorkout =>
  mapExercise(live, ei, (ex) => {
    const sets = ex.sets.map((s, j) => (j === si ? updater(s) : s));
    return {
      ...ex,
      sets,
      done: sets.some((x) => Boolean(x.done && x.r > 0)),
    };
  });

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
    addSet(ei: number) {
      const live = getLive();
      const ex = live?.exercises[ei];
      if (!live || !ex) return;
      const last = ex.sets.at(-1) ?? { w: 0, r: 8 };
      const nextLive = mapExercise(live, ei, (item) => ({
        ...item,
        sets: [...item.sets, { w: last.w, r: last.r, done: false }],
      }));
      commit(nextLive);
    },

    delSet(ei: number, si: number) {
      const live = getLive();
      const ex = live?.exercises[ei];
      if (!live || !ex || ex.sets.length <= 1 || si < 0 || si >= ex.sets.length) return;
      const nextExercises = live.exercises.map((item, i) => {
        if (i !== ei) return item;
        const sets = item.sets.filter((_, j) => j !== si);
        return {
          ...item,
          sets,
          done: sets.some((x) => Boolean(x.done && x.r > 0)),
        };
      });
      let nextRestRef = live.restRef;
      if (nextRestRef?.ei === ei) {
        if (nextRestRef.si === si) nextRestRef = undefined;
        else if (nextRestRef.si > si) nextRestRef = { ...nextRestRef, si: nextRestRef.si - 1 };
      }
      commit({
        ...live,
        exercises: nextExercises,
        restRef: nextRestRef,
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
      commit({
        ...nextLive,
        curIdx: prevIdx,
        lastCompletedExIdx: undefined,
      });
    },

    applyTargetWeight(ei: number, targetW: number) {
      const live = getLive();
      if (!live || !live.exercises[ei] || !Number.isFinite(targetW)) return;
      const nextW = Math.max(0, targetW);
      const nextLive = mapExercise(live, ei, (item) => ({
        ...item,
        sets: item.sets.map((s) => (s.done ? s : { ...s, w: nextW })),
      }));
      commit(nextLive);
    },

    updateWeight(ei: number, si: number, raw: string, finalize = false) {
      const live = getLive();
      const s = live?.exercises[ei]?.sets[si];
      if (!live || !s) return;
      const trimmed = raw.trim();
      if (!finalize && (!trimmed || /[.,]$/.test(trimmed))) return;
      const nextW = Math.max(0, parseFloat(trimmed.replace(',', '.')) || 0);
      const nextLive = mapSet(live, ei, si, (set) => ({ ...set, w: nextW }));
      if (finalize || s.done) commit(nextLive);
      else saveOnly(nextLive);
    },

    stepWeight(ei: number, si: number, delta: number) {
      const live = getLive();
      const s = live?.exercises[ei]?.sets[si];
      if (!live || !s || !Number.isFinite(delta)) return;
      const nextW = Math.max(0, Math.round((s.w + delta) * 10) / 10);
      commit(mapSet(live, ei, si, (set) => ({ ...set, w: nextW })));
    },

    updateReps(ei: number, si: number, raw: string, finalize = false) {
      const live = getLive();
      const s = live?.exercises[ei]?.sets[si];
      if (!live || !s) return;
      const trimmed = raw.trim();
      if (!trimmed && !finalize) return;
      const nextR = Math.max(0, parseInt(trimmed, 10) || 0);
      const nextDone = nextR === 0 ? false : Boolean(s.done);
      const nextLive = mapSet(live, ei, si, (set) => ({ ...set, r: nextR, done: nextDone }));
      if (finalize || Boolean(s.done) !== nextDone || nextDone) commit(nextLive);
      else saveOnly(nextLive);
    },

    stepReps(ei: number, si: number, delta: number) {
      const live = getLive();
      const s = live?.exercises[ei]?.sets[si];
      if (!live || !s || !Number.isFinite(delta)) return;
      const nextR = Math.max(0, Math.round(s.r + delta));
      const nextDone = nextR === 0 ? false : Boolean(s.done);
      commit(mapSet(live, ei, si, (set) => ({ ...set, r: nextR, done: nextDone })));
    },

    toggleSet(ei: number, si: number) {
      const live = getLive();
      if (!live) return;
      const { nextLive, changed, advanced } = applyToggleLiveSet(live, ei, si, toast);
      if (!changed) return;
      commit(nextLive);
      if (advanced) window.scrollTo?.(0, 0);
    },

    updateRir(ei: number, si: number, raw: string) {
      const live = getLive();
      if (!live?.exercises[ei]?.sets[si]) return;
      const trimmed = raw.trim();
      const nextLive = mapSet(live, ei, si, (set) => {
        if (!trimmed) {
          const { rir: _rir, ...rest } = set;
          return rest;
        }
        return { ...set, rir: Math.min(10, Math.max(0, Math.round(Number(trimmed) || 0))) };
      });
      saveOnly(nextLive);
    },

    updateRest(ei: number, si: number, raw: string) {
      const live = getLive();
      if (!live?.exercises[ei]?.sets[si]) return;
      const trimmed = raw.trim();
      const nextLive = mapSet(live, ei, si, (set) => {
        if (!trimmed) {
          const { restSec: _rest, ...rest } = set;
          return rest;
        }
        return { ...set, restSec: Math.min(1800, Math.max(0, Math.round(Number(trimmed) || 0))) };
      });
      saveOnly(nextLive);
    },

    updateNote(ei: number, note: string) {
      const live = getLive();
      if (!live?.exercises[ei]) return;
      saveOnly(mapExercise(live, ei, (item) => ({ ...item, note })));
    },
  };
}
