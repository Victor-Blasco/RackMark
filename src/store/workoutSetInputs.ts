import { parseDecimal } from '../lib/seed';
import type { LiveWorkout, LogExDraft, SetRec } from '../types';
import { isCompletedSet, setOptionalSetInt } from './draftSetHelpers';

export const mapExercise = (live: LiveWorkout, ei: number, updater: (ex: LogExDraft) => LogExDraft): LiveWorkout => ({
  ...live,
  exercises: live.exercises.map((ex, i) => (i === ei ? updater(ex) : ex)),
});

export const mapSet = (live: LiveWorkout, ei: number, si: number, updater: (s: SetRec) => SetRec): LiveWorkout =>
  mapExercise(live, ei, (ex) => {
    const sets = ex.sets.map((s, j) => (j === si ? updater(s) : s));
    return { ...ex, sets, done: sets.some(isCompletedSet) };
  });

/**
 * Crea las acciones de edición numérica y notas para la sesión en vivo.
 *
 * @param getLive - Lector de la sesión en vivo actual.
 * @param saveOnly - Persiste en `localStorage` sin forzar re-render.
 * @param commit - Persiste en `localStorage` y notifica a Preact.
 * @returns Manejadores para `kg`, `reps`, `RIR`, `descanso` y notas.
 */
export function createWorkoutSetInputs(
  getLive: () => LiveWorkout | undefined,
  saveOnly: (live?: LiveWorkout) => void,
  commit: (live?: LiveWorkout) => void,
) {
  const updateOptionalInt = (ei: number, si: number, raw: string, key: 'rir' | 'restSec', max: number) => {
    const live = getLive();
    if (!live?.exercises[ei]?.sets[si]) return;
    saveOnly(mapSet(live, ei, si, (set) => setOptionalSetInt(set, key, raw, max)));
  };

  return {
    updateWeight(ei: number, si: number, raw: string, finalize = false) {
      const live = getLive();
      const s = live?.exercises[ei]?.sets[si];
      if (!live || !s) return;
      const trimmed = raw.trim();
      if (!finalize && (!trimmed || /[.,]$/.test(trimmed))) return;
      const nextW = Math.max(0, parseDecimal(trimmed) ?? 0);
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
      commit(mapSet(live, ei, si, (set) => ({ ...set, r: nextR, done: nextR === 0 ? false : Boolean(set.done) })));
    },

    updateRir: (ei: number, si: number, raw: string) => updateOptionalInt(ei, si, raw, 'rir', 10),
    updateRest: (ei: number, si: number, raw: string) => updateOptionalInt(ei, si, raw, 'restSec', 1800),

    updateNote(ei: number, note: string) {
      const live = getLive();
      if (!live?.exercises[ei]) return;
      saveOnly(mapExercise(live, ei, (item) => ({ ...item, note })));
    },
  };
}
