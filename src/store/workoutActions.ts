import type { DayName, LiveWorkout } from '../types';
import type { State, WorkoutSummary } from '../ui/shared';
import { manualSessionId } from './exerciseCatalog';
import { buildWorkoutSummary, persistCompletedSession } from './sessionPersistence';
import type { ConfirmModalOpts, ToastAction } from './types';
import { createWorkoutPickerActions } from './workoutPickerActions';
import { createWorkoutRestActions, finalizePendingRest } from './workoutRestActions';
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
  toast: (msg: string, action?: ToastAction) => void;
  askConfirm: (opts: ConfirmModalOpts) => Promise<boolean>;
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
    ...createWorkoutPickerActions(deps.getState, getLive, deps.commitLive, deps.toast),
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

      const doneSets = live.exercises.reduce((acc, e) => acc + e.sets.filter((s) => s.done && s.r > 0).length, 0);
      const totalSets = live.exercises.reduce((acc, e) => acc + e.sets.length, 0);
      if (doneSets > 0 && doneSets < totalSets) {
        const pending = totalSets - doneSets;
        const confirmed = await deps.askConfirm({
          title: 'Terminar entrenamiento',
          message: `Has completado ${doneSets} de ${totalSets} series (${pending === 1 ? 'queda 1 sin marcar' : `quedan ${pending} sin marcar`}). ¿Guardar el entreno igualmente?`,
          confirmLabel: 'Guardar entreno',
        });
        if (!confirmed) return;
      }

      const curLive = finalizePendingRest(deps.getState().liveWorkout ?? live);
      const validEx = curLive.exercises.filter((e) => e.sets.some((s) => s.done && s.r > 0));
      const totalDurMin = Math.max(1, Math.round((Date.now() - curLive.startedAt) / 60000));
      const perExDur = validEx.length > 0 ? Math.max(0.2, Math.round((totalDurMin / validEx.length) * 10) / 10) : undefined;
      const baseSid = manualSessionId(curLive.date, curLive.day);
      const hasCollision = state.strength.some((r) => r.sessionId === baseSid);
      const sessionId = hasCollision
        ? `${baseSid}-${Math.floor(curLive.startedAt / 1000).toString(36)}`
        : baseSid;

      const saved = await persistCompletedSession(
        state,
        {
          sessionId,
          day: curLive.day,
          date: curLive.date,
          exercises: curLive.exercises,
          defaultDurPerEx: perExDur,
          tsBase: curLive.startedAt,
        },
        deps.toast,
      );
      if (!saved) return;

      const summary = buildWorkoutSummary(state, curLive, saved);
      deps.commitLive(undefined);
      await deps.reload();
      if (curLive.day !== 'Libre') {
        deps.setTab(curLive.day);
      }
      deps.showSummary(summary);
      deps.queueSync();
    },

    prevExercise() {
      const live = getLive();
      if (live && live.curIdx > 0) selectExercise(live.curIdx - 1);
    },

    nextExercise() {
      const live = getLive();
      if (live && live.curIdx < live.exercises.length - 1) selectExercise(live.curIdx + 1);
    },

    openFixedNote: (exName: string) => deps.openNoteModal(exName),

    goLogTab() {
      deps.setTab('log');
      window.scrollTo?.(0, 0);
    },
  };
}
