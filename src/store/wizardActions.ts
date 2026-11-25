import { putMany, saveSettings } from '../lib/db';
import { markBucketUpserts, markSettingsDirty } from '../lib/sync';
import type { Measure } from '../types';
import { todayIso, type State } from '../ui/shared';
import { applyRoutineTemplateToState } from './routineTemplate';
import {
  createWizardDraft,
  daysActivityFactor,
  goalCalorieDelta,
  goalPhaseName,
  parseWizardNum,
  resolveWizardPhases,
  type WizardDraft,
} from './wizardSelectors';

export { applyRoutineTemplateToState };

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
 * Crea las acciones inmutables paso a paso del asistente de bienvenida.
 *
 * @param deps - Puentes de persistencia, sincronización y apertura/cierre de modal.
 * @returns Acciones para abrir, editar pasos, retroceder, omitir y finalizar el wizard.
 */
export function createWizardActions(deps: WizardActionDeps) {
  const getDraft = (): WizardDraft | undefined => {
    const modal = deps.getState().activeModal;
    return modal?.type === 'wizard' ? modal.draft : undefined;
  };

  return {
    open: () => deps.openWizardModal(createWizardDraft(deps.getState())),

    async skip() {
      const state = deps.getState();
      deps.closeWizardModal();
      if (!state.settings.onboardingCompleted) {
        state.settings = { ...state.settings, onboardingCompleted: true };
        await deps.persist();
        return;
      }
      deps.render();
    },

    back() {
      const w = getDraft();
      if (!w || w.step <= 1) return;
      deps.openWizardModal({ ...w, step: (w.step - 1) as 1 | 2, anim: 'prev', error: undefined });
    },

    updateDraft(patch: Partial<WizardDraft>) {
      const w = getDraft();
      if (!w) return;
      deps.openWizardModal({ ...w, ...patch, anim: undefined, error: undefined });
    },

    async submitStep() {
      const state = deps.getState();
      const w = getDraft();
      if (!w) return;

      if (w.step === 1) {
        const age = parseWizardNum(w.age);
        const height = parseWizardNum(w.height);
        if (age == null || age < 12 || age > 110) {
          deps.openWizardModal({ ...w, error: 'Introduce una edad válida (12–110 años).' });
          return;
        }
        if (height == null || height < 100 || height > 250) {
          deps.openWizardModal({ ...w, error: 'Introduce una altura válida (100–250 cm).' });
          return;
        }
        const weight = w.weight.trim() ? parseWizardNum(w.weight) : undefined;
        if (weight !== undefined && (weight < 25 || weight > 300)) {
          deps.openWizardModal({ ...w, error: 'Introduce un peso válido (25–300 kg).' });
          return;
        }
        deps.openWizardModal({ ...w, step: 2, anim: 'next', error: undefined });
        return;
      }
      if (w.step === 2) {
        deps.openWizardModal({ ...w, step: 3, anim: 'next', error: undefined });
        return;
      }

      const wasOnboarded = Boolean(state.settings.onboardingCompleted);
      const today = todayIso();
      if (w.templateKey !== 'keep') {
        applyRoutineTemplateToState(state, w.templateKey, deps.getLastRoutine, deps.setLastRoutine, deps.syncWorkoutRoutineNames, w.daysPerWeek);
      }

      state.settings = {
        ...state.settings,
        profile: {
          sex: w.sex,
          age: Math.round(parseWizardNum(w.age) || state.settings.profile.age || 25),
          height: Math.round(parseWizardNum(w.height) || state.settings.profile.height || 170),
          goal: w.goal,
          experience: w.experience,
          daysPerWeek: w.daysPerWeek,
        },
        aiTone: w.aiTone,
        onboardingCompleted: true,
        phases: resolveWizardPhases(state.settings.phases, wasOnboarded, state.strength.length > 0, goalPhaseName(w.goal), today),
      };
      state.calcDraft = { ...state.calcDraft, act: daysActivityFactor(w.daysPerWeek), goal: goalCalorieDelta(w.goal) };

      const weightVal = parseWizardNum(w.weight);
      const bfVal = parseWizardNum(w.bf);
      const waistVal = parseWizardNum(w.waist);
      if (weightVal != null || bfVal != null || waistVal != null) {
        const m: Measure = { ...(state.measures.find((x) => x.date === today) ?? { date: today }) };
        if (weightVal != null && weightVal >= 20 && weightVal <= 350) m.weight = weightVal;
        if (bfVal != null && bfVal >= 2 && bfVal <= 70) m.bf = bfVal;
        if (waistVal != null && waistVal >= 35 && waistVal <= 220) m.waist = waistVal;
        await putMany('measures', [m]);
        markBucketUpserts('measures', [m]);
      }

      state.activeModal = null;
      await saveSettings(state.settings);
      markSettingsDirty();
      await deps.reload();
      deps.render();
      deps.queueSync();
      deps.toast('Perfil y plan inicial configurados.');
    },
  };
}
