import { ROUTINE_COLORS } from '../lib/seed';
import type { AiTone, DayName } from '../types';
import { routineColor, routineNames, type State } from '../ui/shared';
import { createCatalogMapActions } from './catalogMapActions';
import { createPlanFilterActions } from './planFilterActions';
import { createPlanModalActions, type SaveExercisePayload, type SaveRoutinePayload } from './planModalActions';
import { createRoutineEditActions } from './routineEditActions';
import type { ConfirmModalOpts, ToastAction } from './types';

export type { SaveExercisePayload, SaveRoutinePayload };

/** Dependencias necesarias para acciones de `Plan`, `Home`, `Rutina` y modales. */
export interface PlanActionDeps {
  getState: () => State;
  getLastRoutine: () => DayName;
  setLastRoutine: (day: DayName) => void;
  persist: () => Promise<void>;
  render: () => void;
  setTab: (tab: string) => void;
  navigateTab: (tab: string) => void;
  syncWorkoutRoutineNames: (oldName?: string, newName?: string) => void;
  addExToDraft: (name: string, fallbackSets?: number, fallbackReps?: number) => void;
  askConfirm: (opts: ConfirmModalOpts) => Promise<boolean>;
  toast: (msg: string, action?: ToastAction) => void;
  startWorkoutDay: (day?: DayName) => Promise<void>;
  openLogDay: (day?: DayName) => Promise<void>;
  runAiAnalysis: () => void;
  retryAiAnalysis: () => void;
  dismissAiJob: () => void;
  openWizard: () => void;
  closeModal: () => void;
}

/** Tipo de retorno completo de las acciones de planificación, resumen y detalle. */
export type PlanActions = ReturnType<typeof createPlanActions>;

/**
 * Crea el conjunto unificado de acciones para `Home`, `Rutina / Día`, `Plan` y modales.
 *
 * @param deps - Puentes de estado, persistencia, confirmaciones e IA.
 * @returns Acciones tipadas para todas las vistas del núcleo de entrenamiento.
 */
export function createPlanActions(deps: PlanActionDeps) {
  const state = () => deps.getState();

  return {
    ...createPlanModalActions(deps),
    ...createRoutineEditActions(deps),
    ...createCatalogMapActions(deps),
    ...createPlanFilterActions(state, deps.render, deps.navigateTab),
    openWizard: () => deps.openWizard(),
    startWorkout: (day?: DayName) => void deps.startWorkoutDay(day),
    openLog: (day?: DayName) => void deps.openLogDay(day),
    runAi: () => deps.runAiAnalysis(),
    retryAi: () => deps.retryAiAnalysis(),
    dismissAi: () => deps.dismissAiJob(),

    setAiTone: async (tone: AiTone) => {
      const S = state();
      S.settings = { ...S.settings, aiTone: tone };
      await deps.persist();
    },

    setAiTab: (idx: number) => {
      state().aiTab = Math.max(0, idx || 0);
      deps.render();
    },

    openExerciseModal: (opts: { routine?: string; rowIdx?: number; fromLog?: boolean; initialName?: string } = {}) => {
      state().activeModal = { type: 'exercise', ...opts };
      deps.render();
    },

    openRoutineExercisePicker: (routine: string, replaceRowIdx?: number) => {
      if (!routine) return;
      state().activeModal = {
        type: 'routineExercisePicker',
        routine,
        ...(replaceRowIdx != null ? { replaceRowIdx } : {}),
      };
      deps.render();
    },

    openHomeExercisePicker: () => {
      state().activeModal = { type: 'homeExercisePicker' };
      deps.render();
    },

    openRoutineModalNew: () => {
      const S = state();
      const used = new Set(routineNames(S.settings).map((r) => routineColor(r, S.settings)));
      const color =
        ROUTINE_COLORS.find((c) => !used.has(c)) ??
        ROUTINE_COLORS[routineNames(S.settings).length % ROUTINE_COLORS.length];
      S.activeModal = { type: 'routine', mode: 'create', name: '', sub: '', color };
      deps.render();
    },

    openRoutineModalEdit: (name: string) => {
      const S = state();
      if (!name || !S.settings.routines[name]) return;
      S.activeModal = {
        type: 'routine',
        mode: 'edit',
        oldName: name,
        name,
        sub: S.settings.routineMeta?.[name]?.sub ?? '',
        color: routineColor(name, S.settings),
      };
      deps.render();
    },
  };
}
