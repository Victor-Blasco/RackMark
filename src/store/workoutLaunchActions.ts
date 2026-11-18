import type { DayName, LiveWorkout, LogDraft } from '../types';
import { routineNames, todayIso, type State } from '../ui/shared';
import { manualSessionId } from './exerciseCatalog';
import { initLogDraft } from './logSelectors';
import { initLiveWorkout } from './workoutSelectors';

/** Dependencias para lanzar entrenos, limpiar borradores y sincronizar nombres de rutina. */
export interface WorkoutLaunchDeps {
  getState: () => State;
  setTab: (tab: string) => void;
  render: () => void;
  saveDraft: (draft?: LogDraft) => void;
  saveLive: (live?: LiveWorkout) => void;
  askConfirm: (opts: { title: string; message: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
}

/** Tipo de retorno del lanzador de sesiones en vivo y registro manual. */
export type WorkoutLaunchActions = ReturnType<typeof createWorkoutLaunchActions>;

/**
 * Gestiona la apertura y limpieza de sesiones (`En vivo` y `Registrar hecho`) sin depender de `workoutController`.
 *
 * @param deps - Puentes de estado, persistencia temporal en `localStorage` y confirmaciones.
 * @returns Métodos declarativos para lanzar rutinas o limpiar borradores activos.
 */
export function createWorkoutLaunchActions(deps: WorkoutLaunchDeps) {
  const state = () => deps.getState();

  async function confirmSwitchDraft(nextDay: DayName | 'Libre', nextDate: string): Promise<boolean> {
    const cur = state().logDraft;
    if (!cur?.dirty) return true;
    const targetSid = manualSessionId(nextDate, nextDay);
    const curSid = cur.sessionId ?? manualSessionId(cur.date, cur.day);
    if (cur.day === nextDay && cur.date === nextDate && curSid === targetSid) return true;
    return deps.askConfirm({
      title: 'Cambiar de sesión sin guardar',
      message: 'Tienes series o cambios sin guardar en el entrenamiento actual. Si cambias ahora se descartarán.',
      confirmLabel: 'Descartar cambios',
      danger: true,
    });
  }

  return {
    clearActiveWorkouts() {
      const S = state();
      S.logDraft = undefined;
      deps.saveDraft(undefined);
      S.liveWorkout = undefined;
      deps.saveLive(undefined);
    },

    syncWorkoutRoutineNames(oldName?: string, newName?: string) {
      const S = state();
      if (oldName && newName) {
        if (S.logDraft?.day === oldName) {
          S.logDraft = { ...S.logDraft, day: newName };
          deps.saveDraft(S.logDraft);
        }
        if (S.liveWorkout?.day === oldName) {
          S.liveWorkout = { ...S.liveWorkout, day: newName };
          deps.saveLive(S.liveWorkout);
        }
        return;
      }
      if (S.logDraft && S.logDraft.day !== 'Libre' && !S.settings.routines[S.logDraft.day]) {
        S.logDraft = { ...S.logDraft, day: routineNames(S.settings)[0] ?? 'Libre' };
        deps.saveDraft(S.logDraft);
      }
    },

    async startWorkoutDay(day?: DayName) {
      const S = state();
      if (day) {
        if (S.liveWorkout && S.liveWorkout.day !== day) {
          const hasDone = S.liveWorkout.exercises.some((e) => e.sets.some((s) => s.done && s.r > 0));
          if (hasDone) {
            const ok = await deps.askConfirm({
              title: 'Entrenamiento en curso',
              message: `Tienes un entreno en curso (${S.liveWorkout.day}). ¿Empezar uno nuevo de "${day}" y descartar el actual?`,
              confirmLabel: 'Empezar nuevo',
              danger: true,
            });
            if (!ok) {
              deps.setTab('workout');
              deps.render();
              return;
            }
          }
        }
        if (!S.liveWorkout || S.liveWorkout.day !== day) {
          S.liveWorkout = initLiveWorkout(S, day);
          deps.saveLive(S.liveWorkout);
        }
      }
      deps.setTab('workout');
      deps.render();
      if (typeof window !== 'undefined') window.scrollTo?.(0, 0);
    },

    async openLogDay(day?: DayName) {
      const S = state();
      const today = todayIso();
      if (day) {
        const sameDraft = S.logDraft && S.logDraft.day === day && S.logDraft.date === today;
        if (!sameDraft) {
          if (!(await confirmSwitchDraft(day, today))) return;
          S.logDraft = initLogDraft(S, day, today);
          deps.saveDraft(S.logDraft);
        }
      } else if (!S.logDraft) {
        S.logDraft = initLogDraft(S, routineNames(S.settings)[0] ?? 'Libre', today);
        deps.saveDraft(S.logDraft);
      }
      deps.setTab('log');
      deps.render();
      if (typeof window !== 'undefined') window.scrollTo?.(0, 0);
    },
  };
}
