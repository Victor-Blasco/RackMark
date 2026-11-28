import { norm } from '../lib/seed';
import type { LiveWorkout, LogExDraft } from '../types';
import type { State } from '../ui/shared';
import { allExerciseNames, defaultSetsForEx } from './exerciseCatalog';
import type { ConfirmModalOpts } from './types';

/**
 * Crea las acciones inmutables del menú hamburguesa y selector de ejercicios en `En vivo`.
 *
 * @param getState - Lee el estado global actual.
 * @param getLive - Obtiene la sesión en vivo activa.
 * @param commitLive - Persiste en `localStorage` y notifica a Preact.
 * @param toast - Muestra avisos breves al añadir o cambiar de ejercicio.
 * @param askConfirm - Diálogo opcional para confirmar sustitución con series ya marcadas.
 * @returns Manejadores de apertura, búsqueda y selección de ejercicios en vivo.
 */
export function createWorkoutPickerActions(
  getState: () => State,
  getLive: () => LiveWorkout | undefined,
  commitLive: (live?: LiveWorkout) => void,
  toast: (msg: string) => void,
  askConfirm?: (opts: ConfirmModalOpts) => Promise<boolean>,
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

    async pickExercise(rawName: string) {
      const state = getState();
      const live = state.liveWorkout;
      const trimmed = rawName.trim();
      if (!live?.pickerMode) return;
      if (!trimmed) {
        toast('Elige o escribe un ejercicio.');
        return;
      }
      const name = allExerciseNames(state).find((x) => norm(x) === norm(trimmed)) ?? trimmed;

      const curEx = live.exercises[live.curIdx];
      const curDone = curEx ? curEx.sets.filter((s) => s.done && s.r > 0).length : 0;
      if (live.pickerMode === 'swap' && curEx && curDone > 0 && askConfirm) {
        const ok = await askConfirm({
          title: 'Cambiar ejercicio con series marcadas',
          message: `Ya marcaste ${curDone} ${curDone === 1 ? 'serie' : 'series'} en «${curEx.name}». Si cambias ahora por «${name}», esas series de hoy se sustituirán (tu rutina base no cambiará).`,
          confirmLabel: 'Cambiar solo hoy',
        });
        if (!ok) return;
      }

      const latestLive = getLive() ?? live;
      const latestState = getState();
      const planned = latestLive.day !== 'Libre'
        ? latestState.settings.routines[latestLive.day]?.find((x) => norm(x.name) === norm(name))
        : undefined;
      const exDraft: LogExDraft = {
        name,
        done: false,
        sets: defaultSetsForEx(latestState, name, planned?.sets ?? 3, planned?.reps ?? 10, false),
        note: '',
      };

      let nextExercises: LogExDraft[];
      let nextIdx = latestLive.curIdx;
      let nextRestRef = latestLive.restRef;
      if (latestLive.pickerMode === 'swap' && latestLive.exercises[latestLive.curIdx]) {
        nextExercises = latestLive.exercises.map((ex, i) => (i === latestLive.curIdx ? exDraft : ex));
        if (nextRestRef?.ei === latestLive.curIdx) nextRestRef = undefined;
        toast(latestLive.day !== 'Libre' ? `Cambiado a ${name} (solo hoy).` : `Cambiado a ${name}.`);
      } else {
        nextIdx = latestLive.exercises.length ? Math.min(latestLive.curIdx + 1, latestLive.exercises.length) : 0;
        nextExercises = [
          ...latestLive.exercises.slice(0, nextIdx),
          exDraft,
          ...latestLive.exercises.slice(nextIdx),
        ];
        if (nextRestRef && nextRestRef.ei >= nextIdx) nextRestRef = { ...nextRestRef, ei: nextRestRef.ei + 1 };
        toast(latestLive.day !== 'Libre' ? `${name} añadido solo a la sesión de hoy.` : `${name} añadido al entreno.`);
      }

      commitLive({
        ...latestLive,
        exercises: nextExercises,
        curIdx: nextIdx,
        restRef: nextRestRef,
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
