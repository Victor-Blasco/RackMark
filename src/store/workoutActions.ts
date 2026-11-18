import { norm } from '../lib/seed';
import type { DayName, LiveWorkout, LogExDraft } from '../types';
import type { State, WorkoutSummary } from '../ui/shared';
import { defaultSetsForEx, manualSessionId } from './exerciseCatalog';
import { buildWorkoutSummary, persistCompletedSession } from './sessionPersistence';
import { createWorkoutRestActions } from './workoutRestActions';
import { initLiveWorkout } from './workoutSelectors';
import { createWorkoutSetActions } from './workoutSetActions';

/** Dependencias necesarias para ejecutar acciones del entrenamiento en vivo. */
export interface WorkoutActionDeps {
  getState: () => State;
  saveLiveOnly: (live?: LiveWorkout) => void;
  commitLive: (live?: LiveWorkout) => void;
  reload: () => Promise<void>;
  setTab: (tab: string) => void;
  queueSync: () => void;
  toast: (msg: string) => void;
  askConfirm: (opts: { title: string; message: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
  openNoteModal: (exName: string) => void;
  showSummary: (summary: WorkoutSummary) => void;
}

/** Tipo de retorno completo de las acciones de `En vivo`. */
export type LiveWorkoutActions = ReturnType<typeof createLiveWorkoutActions>;

/**
 * Crea el conjunto unificado de acciones reactivas e inmutables para la vista `En vivo`.
 *
 * @param deps - Puentes al estado, persistencia local, navegación y modales.
 * @returns Objeto con métodos tipados para manejar toda la sesión en vivo.
 */
export function createLiveWorkoutActions(deps: WorkoutActionDeps) {
  const getLive = () => deps.getState().liveWorkout;

  const selectExercise = (idx: number) => {
    const live = getLive();
    if (!live || !live.exercises.length) return;
    deps.commitLive({
      ...live,
      curIdx: Math.min(Math.max(0, idx), live.exercises.length - 1),
      lastCompletedExIdx: undefined,
      pickerMode: undefined,
      exMenuOpen: undefined,
    });
    window.scrollTo?.(0, 0);
  };

  return {
    ...createWorkoutRestActions(getLive, deps.commitLive),
    ...createWorkoutSetActions(getLive, deps.saveLiveOnly, deps.commitLive, deps.toast),
    selectExercise,

    start(day: DayName | 'Libre' = 'Libre') {
      deps.commitLive(initLiveWorkout(deps.getState(), day));
      window.scrollTo?.(0, 0);
    },

    async discard() {
      const live = getLive();
      if (!live) return;
      const hasDone = live.exercises.some((e) => e.sets.some((s) => s.done && s.r > 0));
      if (hasDone) {
        const confirmed = await deps.askConfirm({
          title: 'Descartar entrenamiento',
          message: '¿Descartar el entrenamiento en curso? Se perderán las series marcadas.',
          confirmLabel: 'Descartar',
          danger: true,
        });
        if (!confirmed) return;
      }
      deps.commitLive(undefined);
      deps.toast('Entreno descartado.');
    },

    async save() {
      const state = deps.getState();
      const live = state.liveWorkout;
      if (!live) return;

      const validEx = live.exercises.filter((e) => e.sets.some((s) => s.done && s.r > 0));
      const totalDurMin = Math.max(1, Math.round((Date.now() - live.startedAt) / 60000));
      const perExDur = validEx.length > 0 ? Math.max(0.2, Math.round((totalDurMin / validEx.length) * 10) / 10) : undefined;
      const baseSid = manualSessionId(live.date, live.day);
      const hasCollision = state.strength.some((r) => r.sessionId === baseSid);
      const sessionId = hasCollision
        ? `${baseSid}-${Math.floor(live.startedAt / 1000).toString(36)}`
        : baseSid;

      const saved = await persistCompletedSession(
        state,
        {
          sessionId,
          day: live.day,
          date: live.date,
          exercises: live.exercises,
          defaultDurPerEx: perExDur,
          tsBase: live.startedAt,
        },
        deps.toast,
      );
      if (!saved) return;

      const summary = buildWorkoutSummary(state, live, saved);
      deps.commitLive(undefined);
      await deps.reload();
      if (live.day !== 'Libre') {
        deps.setTab(live.day);
      }
      deps.showSummary(summary);
      deps.queueSync();
    },

    prevExercise() {
      const live = getLive();
      if (live && live.curIdx > 0) {
        selectExercise(live.curIdx - 1);
      }
    },

    nextExercise() {
      const live = getLive();
      if (live && live.curIdx < live.exercises.length - 1) {
        selectExercise(live.curIdx + 1);
      }
    },

    toggleMenu() {
      const live = getLive();
      if (!live) return;
      const exMenuOpen = !live.exMenuOpen;
      deps.commitLive({
        ...live,
        exMenuOpen,
        pickerMode: exMenuOpen ? undefined : live.pickerMode,
      });
    },

    openPicker(mode: 'add' | 'swap') {
      const live = getLive();
      if (!live) return;
      deps.commitLive({
        ...live,
        pickerMode: mode,
        pickerQuery: undefined,
        exMenuOpen: undefined,
      });
    },

    closePicker() {
      const live = getLive();
      if (!live) return;
      deps.commitLive({
        ...live,
        pickerMode: undefined,
        pickerQuery: undefined,
      });
    },

    setPickerQuery(query: string) {
      const live = getLive();
      if (!live) return;
      deps.commitLive({
        ...live,
        pickerQuery: query,
      });
    },

    pickExercise(rawName: string) {
      const state = deps.getState();
      const live = state.liveWorkout;
      const name = rawName.trim();
      if (!live || !live.pickerMode) return;
      if (!name) {
        deps.toast('Elige o escribe un ejercicio.');
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
        deps.toast(`Cambiado a ${name}.`);
      } else {
        nextIdx = live.exercises.length ? Math.min(live.curIdx + 1, live.exercises.length) : 0;
        nextExercises = [
          ...live.exercises.slice(0, nextIdx),
          exDraft,
          ...live.exercises.slice(nextIdx),
        ];
        deps.toast(`${name} añadido al entreno.`);
      }

      deps.commitLive({
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
      deps.commitLive({
        ...live,
        lastCompletedExIdx: undefined,
      });
    },

    openFixedNote(exName: string) {
      deps.openNoteModal(exName);
    },

    goLogTab() {
      deps.setTab('log');
      window.scrollTo?.(0, 0);
    },
  };
}
