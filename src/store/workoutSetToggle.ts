import type { LiveWorkout } from '../types';
import { finalizePendingRest } from './workoutRestActions';

const clearRestFields = (live: LiveWorkout): LiveWorkout => {
  const { restStartedAt: _s, restUntil: _u, restRef: _r, ...rest } = live;
  return rest;
};

const countDoneSets = (live: LiveWorkout) =>
  live.exercises.reduce((sum, item) => sum + item.sets.filter((x) => x.done && x.r > 0).length, 0);

const isAllDone = (live: LiveWorkout) =>
  live.exercises.length > 0 &&
  live.exercises.every((e) => e.sets.length > 0 && e.sets.every((x) => Boolean(x.done && x.r > 0)));

const nextPendingExIdx = (live: LiveWorkout, ei: number) => {
  const after = live.exercises.findIndex((e, i) => i > ei && e.sets.some((x) => !(x.done && x.r > 0)));
  if (after >= 0) return after;
  return live.exercises.findIndex((e, i) => i !== ei && e.sets.some((x) => !(x.done && x.r > 0)));
};

/**
 * Genera de forma inmutable la siguiente instantánea de sesión al marcar o
 * desmarcar una serie, gestionando descanso automático y avance de ejercicio.
 *
 * @param live - Sesión en vivo actual.
 * @param ei - Índice del ejercicio.
 * @param si - Índice de la serie.
 * @param toast - Callback de aviso si faltan repeticiones o se completa el entreno.
 * @returns Objeto `{ nextLive, changed, advanced }` con la nueva referencia.
 */
export function applyToggleLiveSet(
  live: LiveWorkout,
  ei: number,
  si: number,
  toast: (msg: string) => void,
): { nextLive: LiveWorkout; changed: boolean; advanced: boolean } {
  const ex = live.exercises[ei];
  const s = ex?.sets[si];
  if (!ex || !s) {
    return { nextLive: live, changed: false, advanced: false };
  }

  if (!s.done && !(s.r > 0)) {
    toast('Indica al menos 1 repetición antes de marcar la serie.');
    return { nextLive: live, changed: false, advanced: false };
  }

  const wasAllDone = isAllDone(live);
  const nextDone = !s.done;
  let workingLive = nextDone ? finalizePendingRest(live) : live;

  const nextExercises = workingLive.exercises.map((item, idx) => {
    if (idx !== ei) return item;
    const nextSets = item.sets.map((set, setIdx) => (setIdx === si ? { ...set, done: nextDone } : set));
    return {
      ...item,
      sets: nextSets,
      done: nextSets.some((x) => Boolean(x.done && x.r > 0)),
    };
  });

  workingLive = { ...workingLive, exercises: nextExercises };
  let advanced = false;

  if (nextDone) {
    try {
      navigator?.vibrate?.(15);
    } catch {
      /* vibración opcional según navegador */
    }

    const hasMore = nextExercises.some((e) => e.sets.some((x) => !(x.done && x.r > 0)));
    if (hasMore) {
      const restStartedAt = Date.now();
      workingLive = {
        ...workingLive,
        restStartedAt,
        restUntil: restStartedAt + workingLive.targetRestSec * 1000,
        restRef: { ei, si },
      };
    } else {
      workingLive = clearRestFields(workingLive);
    }

    const exDone = nextExercises[ei].sets.every((x) => Boolean(x.done && x.r > 0));
    const nextIdx = exDone ? nextPendingExIdx(workingLive, ei) : -1;
    if (nextIdx >= 0) {
      advanced = true;
      workingLive = {
        ...workingLive,
        lastCompletedExIdx: ei,
        curIdx: nextIdx,
        exMenuOpen: undefined,
        pickerMode: undefined,
      };
    } else {
      workingLive = {
        ...workingLive,
        lastCompletedExIdx: undefined,
      };
    }
  } else {
    if (workingLive.restRef?.ei === ei && workingLive.restRef?.si === si) {
      workingLive = clearRestFields(workingLive);
    }
    if (workingLive.lastCompletedExIdx === ei) {
      workingLive = {
        ...workingLive,
        lastCompletedExIdx: undefined,
      };
    }
  }

  if (!wasAllDone && isAllDone(workingLive)) {
    const mins = Math.max(1, Math.round((Date.now() - workingLive.startedAt) / 60000));
    toast(`Entreno completo · ${countDoneSets(workingLive)} series · ${mins} min.`);
  }

  return { nextLive: workingLive, changed: true, advanced };
}
