import { norm } from '../lib/seed';
import type { LiveWorkout, LogExDraft } from '../types';
import type { State } from '../ui/shared';
import { defaultSetsForEx } from './exerciseCatalog';

/**
 * Crea las acciones inmutables del menú hamburguesa y selector de ejercicios en `En vivo`.
 *
 * @param getState - Lee el estado global actual.
 * @param getLive - Obtiene la sesión en vivo activa.
 * @param commitLive - Persiste en `localStorage` y notifica a Preact.
 * @param toast - Muestra avisos breves al añadir o cambiar de ejercicio.
 * @returns Manejadores de apertura, búsqueda y selección de ejercicios en vivo.
 */
export function createWorkoutPickerActions(
  getState: () => State,
  getLive: () => LiveWorkout | undefined,
  commitLive: (live?: LiveWorkout) => void,
  toast: (msg: string) => void,
) {
  return {
    toggleMenu() {
      const live = getLive();
      if (!live) return;
      const exMenuOpen = !live.exMenuOpen;
      commitLive({
        ...live,
        exMenuOpen,
        pickerMode: exMenuOpen ? undefined : live.pickerMode,
      });
    },

    openPicker(mode: 'add' | 'swap') {
      const live = getLive();
      if (!live) return;
      commitLive({
        ...live,
        pickerMode: mode,
        pickerQuery: undefined,
        exMenuOpen: undefined,
      });
    },

    closePicker() {
      const live = getLive();
      if (!live) return;
      commitLive({
        ...live,
        pickerMode: undefined,
        pickerQuery: undefined,
      });
    },

    setPickerQuery(query: string) {
      const live = getLive();
      if (!live) return;
      commitLive({
        ...live,
        pickerQuery: query,
      });
    },

    pickExercise(rawName: string) {
      const state = getState();
      const live = state.liveWorkout;
      const name = rawName.trim();
      if (!live || !live.pickerMode) return;
      if (!name) {
        toast('Elige o escribe un ejercicio.');
        return;
      }

      const planned = live.day !== 'Libre'
        ? state.settings.routines[live.day]?.find((x) => norm(x.name) === norm(name))
        : undefined;
      const exDraft: LogExDraft = {
        name,
        done: false,
        sets: defaultSetsForEx(state, name, planned?.sets ?? 3, planned?.reps ?? 10, false),
        note: '',
      };

      let nextExercises: LogExDraft[];
      let nextIdx = live.curIdx;
      if (live.pickerMode === 'swap' && live.exercises[live.curIdx]) {
        nextExercises = live.exercises.map((ex, i) => (i === live.curIdx ? exDraft : ex));
        toast(`Cambiado a ${name}.`);
      } else {
        nextIdx = live.exercises.length ? Math.min(live.curIdx + 1, live.exercises.length) : 0;
        nextExercises = [
          ...live.exercises.slice(0, nextIdx),
          exDraft,
          ...live.exercises.slice(nextIdx),
        ];
        toast(`${name} añadido al entreno.`);
      }

      commitLive({
        ...live,
        exercises: nextExercises,
        curIdx: nextIdx,
        lastCompletedExIdx: undefined,
        pickerMode: undefined,
        pickerQuery: undefined,
        exMenuOpen: undefined,
      });
    },

    clearPrevBanner() {
      const live = getLive();
      if (!live) return;
      commitLive({
        ...live,
        lastCompletedExIdx: undefined,
      });
    },
  };
}
