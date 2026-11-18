import { putMany, saveSettings } from '../lib/db';
import { ROUTINE_TEMPLATES } from '../lib/seed';
import { markBucketUpserts, markSettingsDirty } from '../lib/sync';
import type { Measure } from '../types';
import { routineNames, todayIso, type State } from '../ui/shared';
import { isRoutineTab } from './navigation';
import {
  createWizardDraft,
  daysActivityFactor,
  goalCalorieDelta,
  goalPhaseName,
  type WizardDraft,
} from './wizardSelectors';

/** Dependencias para controlar el asistente de configuración inicial. */
export interface WizardActionDeps {
  getState: () => State;
  getLastRoutine: () => string;
  setLastRoutine: (day: string) => void;
  persist: () => Promise<void>;
  reload: () => Promise<void>;
  render: () => void;
  syncWorkoutRoutineNames: (oldName?: string, newName?: string) => void;
  queueSync: () => void;
  toast: (msg: string) => void;
  openWizardModal: (draft: WizardDraft) => void;
  closeWizardModal: () => void;
}

/** Tipo de retorno completo de las acciones del asistente inicial. */
export type WizardActions = ReturnType<typeof createWizardActions>;

/**
 * Aplica una plantilla predefinida sobre `state.settings` actualizando rutinas y metadatos.
 *
 * @param state - Estado global actual.
 * @param tplKey - Clave de plantilla dentro de `ROUTINE_TEMPLATES`.
 * @param getLastRoutine - Lee la última rutina visitada en móvil.
 * @param setLastRoutine - Actualiza la última rutina visitada si fue eliminada.
 * @param syncWorkoutRoutineNames - Sincroniza borradores activos con el nuevo esquema.
 * @returns Etiqueta de la plantilla aplicada o `undefined` si no existe.
 */
export function applyRoutineTemplateToState(
  state: State,
  tplKey: string,
  getLastRoutine: () => string,
  setLastRoutine: (day: string) => void,
  syncWorkoutRoutineNames: (oldName?: string, newName?: string) => void,
): string | undefined {
  const tpl = ROUTINE_TEMPLATES[tplKey];
  if (!tpl) return undefined;
  state.settings.routines = structuredClone(tpl.routines);
  state.settings.routineMeta = structuredClone(tpl.meta);
  const remaining = routineNames(state.settings);
  if (!isRoutineTab(state, getLastRoutine())) setLastRoutine(remaining[0] ?? 'Push');
  if (state.sel.home && !state.settings.routines[state.sel.home]) delete state.sel.home;
  syncWorkoutRoutineNames();
  return tpl.label;
}

const parseNum = (v: string): number | undefined => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Crea las acciones inmutables paso a paso del asistente de bienvenida.
 *
 * @param deps - Puentes de persistencia, sincronización y apertura/cierre de modal.
 * @returns Acciones para abrir, editar pasos, retroceder, omitir y finalizar el wizard.
 */
export function createWizardActions(deps: WizardActionDeps) {
  const commitDraft = (draft: WizardDraft) => {
    const state = deps.getState();
    state.wizard = draft;
    state.activeModal = { type: 'wizard', draft };
    deps.render();
  };

  return {
    open() {
      const draft = createWizardDraft(deps.getState());
      commitDraft(draft);
    },

    async skip() {
      const state = deps.getState();
      state.wizard = undefined;
      if (state.activeModal?.type === 'wizard') state.activeModal = null;
      deps.closeWizardModal();
      if (!state.settings.onboardingCompleted) {
        state.settings.onboardingCompleted = true;
        await deps.persist();
        return;
      }
      deps.render();
    },

    back() {
      const w = deps.getState().wizard;
      if (!w || w.step <= 1) return;
      commitDraft({
        ...w,
        step: (w.step - 1) as 1 | 2,
        anim: 'prev',
      });
    },

    updateDraft(patch: Partial<WizardDraft>) {
      const w = deps.getState().wizard;
      if (!w) return;
      commitDraft({ ...w, ...patch, anim: undefined });
    },

    async submitStep() {
      const state = deps.getState();
      const w = state.wizard;
      if (!w) return;

      if (w.step === 1) {
        const age = parseNum(w.age);
        const height = parseNum(w.height);
        if (age == null || age < 12 || age > 110) {
          deps.toast('Introduce una edad válida (12–110 años).');
          return;
        }
        if (height == null || height < 100 || height > 250) {
          deps.toast('Introduce una altura válida (100–250 cm).');
          return;
        }
        const weight = w.weight.trim() ? parseNum(w.weight) : undefined;
        if (weight !== undefined && (weight < 25 || weight > 300)) {
          deps.toast('Introduce un peso válido (25–300 kg).');
          return;
        }
        commitDraft({ ...w, step: 2, anim: 'next' });
        return;
      }

      if (w.step === 2) {
        commitDraft({ ...w, step: 3, anim: 'next' });
        return;
      }

      const wasOnboarded = Boolean(state.settings.onboardingCompleted);
      const today = todayIso();
      state.settings.profile = {
        sex: w.sex,
        age: Math.round(parseNum(w.age) || state.settings.profile.age || 25),
        height: Math.round(parseNum(w.height) || state.settings.profile.height || 170),
        goal: w.goal,
        experience: w.experience,
        daysPerWeek: w.daysPerWeek,
      };
      state.settings.aiTone = w.aiTone;
      state.settings.onboardingCompleted = true;

      if (w.templateKey !== 'keep') {
        applyRoutineTemplateToState(
          state,
          w.templateKey,
          deps.getLastRoutine,
          deps.setLastRoutine,
          deps.syncWorkoutRoutineNames,
        );
      }

      const phaseName = goalPhaseName(w.goal);
      if (!wasOnboarded && !state.strength.length && state.settings.phases.length === 0) {
        state.settings.phases = [{ name: phaseName, start: today }];
      } else {
        const existingPhase = state.settings.phases.find((p) => p.start === today);
        if (existingPhase) existingPhase.name = phaseName;
        else state.settings.phases.push({ name: phaseName, start: today });
      }

      state.calcDraft = {
        ...state.calcDraft,
        act: daysActivityFactor(w.daysPerWeek),
        goal: goalCalorieDelta(w.goal),
      };

      const weightVal = parseNum(w.weight);
      const bfVal = parseNum(w.bf);
      const waistVal = parseNum(w.waist);
      if (weightVal != null || bfVal != null || waistVal != null) {
        const existingMeasure = state.measures.find((x) => x.date === today);
        const m: Measure = { ...(existingMeasure ?? { date: today }) };
        if (weightVal != null && weightVal >= 20 && weightVal <= 350) m.weight = weightVal;
        if (bfVal != null && bfVal >= 2 && bfVal <= 70) m.bf = bfVal;
        if (waistVal != null && waistVal >= 35 && waistVal <= 220) m.waist = waistVal;
        await putMany('measures', [m]);
        markBucketUpserts('measures', [m]);
      }

      state.wizard = undefined;
      if (state.activeModal?.type === 'wizard') state.activeModal = null;
      await saveSettings(state.settings);
      markSettingsDirty();
      await deps.reload();
      deps.render();
      deps.queueSync();
      deps.toast('Perfil y plan inicial configurados.');
    },
  };
}
