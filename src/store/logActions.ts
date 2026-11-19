import { isValidIsoDate, norm } from '../lib/seed';
import type { DayName, LogDraft, LogExDraft } from '../types';
import { routineNames, todayIso, type State } from '../ui/shared';
import { defaultSetsForEx, manualSessionId } from './exerciseCatalog';
import { createLogHistoryActions } from './logHistoryActions';
import { createLogInputActions } from './logInputActions';
import { initLogDraft } from './logSelectors';
import { createLogSetActions } from './logSetActions';
import type { ConfirmModalOpts, ToastAction } from './types';

/** Dependencias necesarias para ejecutar acciones en `Registrar hecho`. */
export interface LogActionDeps {
  getState: () => State;
  saveDraftOnly: (draft?: LogDraft) => void;
  commitDraft: (draft?: LogDraft) => void;
  reload: () => Promise<void>;
  setTab: (tab: string) => void;
  queueSync: () => void;
  toast: (msg: string, action?: ToastAction) => void;
  askConfirm: (opts: ConfirmModalOpts) => Promise<boolean>;
  openNoteModal: (exName: string) => void;
  onSearchChange: (q: string) => void;
  onStartLiveTab: () => void;
  onOpenNewExerciseModal: () => void;
}

/** Tipo de retorno completo de las acciones de `Registrar hecho`. */
export type LogWorkoutActions = ReturnType<typeof createLogWorkoutActions>;

/**
 * Crea el conjunto de acciones reactivas e inmutables para `Registrar hecho`.
 *
 * @param deps - Puentes al estado, persistencia, confirmaciones y navegación.
 * @returns Métodos tipados para editar borradores históricos sin temporizadores activos.
 */
export function createLogWorkoutActions(deps: LogActionDeps) {
  const ensureDraft = (): LogDraft => {
    const state = deps.getState();
    return state.logDraft ?? initLogDraft(state, routineNames(state.settings)[0] ?? 'Libre', todayIso());
  };

  async function confirmSwitchDraft(nextDay: DayName | 'Libre', nextDate: string, nextSessionId?: string): Promise<boolean> {
    const cur = deps.getState().logDraft;
    if (!cur?.dirty) return true;
    const targetSid = nextSessionId ?? manualSessionId(nextDate, nextDay);
    if (cur.day === nextDay && cur.date === nextDate && (cur.sessionId ?? manualSessionId(cur.date, cur.day)) === targetSid) {
      return true;
    }
    return deps.askConfirm({
      title: 'Cambiar de sesión sin guardar',
      message: 'Tienes series o cambios sin guardar en el entrenamiento actual. Si cambias ahora se descartarán.',
      confirmLabel: 'Descartar cambios',
      danger: true,
    });
  }

  return {
    ...createLogSetActions(ensureDraft, deps.commitDraft, deps.toast),
    ...createLogInputActions(ensureDraft, deps.saveDraftOnly, deps.commitDraft),
    ...createLogHistoryActions(deps, ensureDraft, confirmSwitchDraft),
    openLiveWorkoutTab: () => deps.onStartLiveTab(),
    openNewExerciseModal: () => deps.onOpenNewExerciseModal(),
    openFixedNote: (exName: string) => deps.openNoteModal(exName),
    setAddQuery: (q: string) => deps.onSearchChange(q),

    async changeDate(rawDate: string) {
      const state = deps.getState();
      if (!isValidIsoDate(rawDate)) {
        deps.toast('Introduce una fecha válida.');
        deps.commitDraft(state.logDraft);
        return;
      }
      const day = ensureDraft().day;
      if (!(await confirmSwitchDraft(day, rawDate))) {
        deps.commitDraft(state.logDraft);
        return;
      }
      deps.commitDraft(initLogDraft(state, day, rawDate));
    },

    async selectDay(day: DayName | 'Libre') {
      const state = deps.getState();
      const date = ensureDraft().date;
      if (!(await confirmSwitchDraft(day, date))) return;
      deps.commitDraft(initLogDraft(state, day, date));
    },

    async resetDraft() {
      const confirmed = await deps.askConfirm({
        title: 'Reiniciar borrador',
        message: 'Se restaurarán los ejercicios y series por defecto de la rutina actual.',
        confirmLabel: 'Reiniciar',
        danger: true,
      });
      if (!confirmed) return;
      const cur = ensureDraft();
      deps.commitDraft(initLogDraft(deps.getState(), cur.day, cur.date, cur.sessionId));
    },

    addExerciseByName(rawName: string, fallbackSets?: number, fallbackReps?: number) {
      const clean = rawName.trim();
      if (!clean) return;
      const state = deps.getState();
      const draft = ensureDraft();
      deps.onSearchChange('');
      if (draft.exercises.some((e) => norm(e.name) === norm(clean))) {
        deps.toast(`${clean} ya está en esta sesión.`);
        return;
      }
      const nextEx: LogExDraft = {
        name: clean,
        done: false,
        sets: defaultSetsForEx(state, clean, fallbackSets, fallbackReps, false),
        note: '',
      };
      deps.commitDraft({ ...draft, dirty: true, exercises: [...draft.exercises, nextEx] });
    },
  };
}
