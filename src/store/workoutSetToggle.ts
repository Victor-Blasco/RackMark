import type { LiveWorkout } from '../types';
import { isCompletedSet } from './draftSetHelpers';
import { finalizePendingRest } from './workoutRestActions';

const clearRestFields = (live: LiveWorkout): LiveWorkout => {
  const { restStartedAt: _s, restUntil: _u, restPausedRemSec: _p, restRef: _r, ...rest } = live;
  return rest;
};

const countDoneSets = (live: LiveWorkout) =>
  live.exercises.reduce((sum, item) => sum + item.sets.filter(isCompletedSet).length, 0);

const isAllDone = (live: LiveWorkout) =>
  live.exercises.length > 0 &&
  live.exercises.every((e) => e.sets.length > 0 && e.sets.every(isCompletedSet));

const nextPendingExIdx = (live: LiveWorkout, ei: number) => {
  const after = live.exercises.findIndex((e, i) => i > ei && e.sets.some((x) => !isCompletedSet(x)));
  if (after >= 0) return after;
  return live.exercises.findIndex((e, i) => i !== ei && e.sets.some((x) => !isCompletedSet(x)));
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
  exerciseRestSec?: number,
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
  const maxExTs = workingLive.exercises.reduce((m, item) => Math.max(m, item.meta?.ts ?? 0), 0);

  const nextExercises = workingLive.exercises.map((item, idx) => {
    if (idx !== ei) return item;
    const nextSets = item.sets.map((set, setIdx) => (setIdx === si ? { ...set, done: nextDone } : set));
    const hasDone = nextSets.some(isCompletedSet);
    let nextMeta = item.meta;
    if (nextDone && !nextMeta?.ts) {
      nextMeta = { ...nextMeta, ts: Math.max(Date.now(), maxExTs + 1) };
    } else if (!hasDone && nextMeta?.ts != null) {
      const { ts: _t, ...restMeta } = nextMeta;
      nextMeta = Object.keys(restMeta).length ? restMeta : undefined;
    }
    const { meta: _prevMeta, ...itemBase } = item;
    return {
      ...itemBase,
      sets: nextSets,
      done: hasDone,
      ...(nextMeta ? { meta: nextMeta } : {}),
    };
  });

  workingLive = { ...workingLive, exercises: nextExercises };
  let advanced = false;

  if (nextDone) {
    try {
      if (typeof navigator !== 'undefined') navigator.vibrate?.(15);
    } catch {
      /* vibración opcional según navegador */
    }

    const nextSet = nextExercises[ei].sets[si + 1];
    const hasPendingDrop = nextSet?.kind === 'D' && !isCompletedSet(nextSet);
    const hasMore = nextExercises.some((e) => e.sets.some((x) => !isCompletedSet(x)));
    if (hasPendingDrop) {
      workingLive = clearRestFields(workingLive);
      toast('Sin descanso → pasa directa a la Drop.');
    } else if (hasMore) {
      const restStartedAt = Date.now();
      const restDur = Math.max(15, exerciseRestSec ?? workingLive.targetRestSec);
      const { restPausedRemSec: _p, ...cleanLive } = workingLive;
      workingLive = {
        ...cleanLive,
        restStartedAt,
        restUntil: restStartedAt + restDur * 1000,
        restRef: { ei, si },
      };
    } else {
      workingLive = clearRestFields(workingLive);
    }

    const exDone = nextExercises[ei].sets.every(isCompletedSet);
    const nextIdx = exDone ? nextPendingExIdx(workingLive, ei) : -1;
    if (exDone) {
      advanced = nextIdx >= 0;
      workingLive = {
        ...workingLive,
        lastCompletedExIdx: ei,
        ...(nextIdx >= 0 ? { curIdx: nextIdx, exMenuOpen: undefined, pickerMode: undefined } : {}),
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
