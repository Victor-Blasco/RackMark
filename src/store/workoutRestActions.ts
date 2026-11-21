import type { LiveWorkout } from '../types';

/**
 * Devuelve una copia de la sesión en vivo registrando el descanso real transcurrido
 * en la serie vinculada y limpiando los campos del temporizador activo.
 *
 * @param live - Sesión en vivo actual.
 * @returns Nueva referencia de `LiveWorkout` sin temporizador pendiente.
 */
export function finalizePendingRest(live: LiveWorkout): LiveWorkout {
  const { restStartedAt, restUntil: _until, restRef, ...restClean } = live;
  if (restStartedAt == null) {
    return live;
  }

  const elapsedSec = Math.min(1800, Math.max(1, Math.round((Date.now() - restStartedAt) / 1000)));
  if (!restRef) {
    return restClean;
  }

  const nextExercises = live.exercises.map((ex, ei) => {
    if (ei !== restRef.ei) return ex;
    const nextSets = ex.sets.map((s, si) => {
      if (si !== restRef.si) return s;
      const shouldFill = s.restSec == null || s.restSec === live.targetRestSec;
      return shouldFill ? { ...s, restSec: elapsedSec } : s;
    });
    return { ...ex, sets: nextSets };
  });

  return {
    ...restClean,
    exercises: nextExercises,
  };
}

/**
 * Crea el conjunto de acciones de temporizador de descanso para el entrenamiento en vivo.
 *
 * @param getLive - Obtiene la sesión en vivo actual.
 * @param commit - Persiste en `localStorage` y notifica a Preact.
 * @returns Acciones inmutables `startRest`, `adjustRest`, `stopRest` y `setRestPreset`.
 */
export function createWorkoutRestActions(
  getLive: () => LiveWorkout | undefined,
  commit: (live?: LiveWorkout) => void,
) {
  return {
    startRest(sec: number) {
      const live = getLive();
      if (!live) return;
      const base = finalizePendingRest(live);
      const targetRestSec = Math.max(15, sec || 90);
      const restStartedAt = Date.now();
      commit({
        ...base,
        targetRestSec,
        restStartedAt,
        restUntil: restStartedAt + targetRestSec * 1000,
      });
    },

    adjustRest(deltaSec: number) {
      const live = getLive();
      if (!live) return;
      const now = Date.now();
      const base = Math.max(now, live.restUntil ?? now);
      commit({
        ...live,
        restStartedAt: live.restStartedAt ?? now,
        restUntil: Math.max(now + 1000, base + (deltaSec || 0) * 1000),
      });
    },

    stopRest() {
      const live = getLive();
      if (!live) return;
      commit(finalizePendingRest(live));
    },

    setRestPreset(sec: number) {
      const live = getLive();
      if (!live) return;
      commit({
        ...live,
        targetRestSec: Math.max(15, sec || 90),
      });
    },
  };
}
