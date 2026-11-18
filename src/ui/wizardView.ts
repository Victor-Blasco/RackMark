import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { WizardModal } from '../components/modals/WizardModal';
import {
  type WizardDraft,
  createWizardDraft,
  daysActivityFactor,
  goalCalorieDelta,
  goalPhaseName,
  recommendTemplate,
} from '../store/wizardSelectors';
import type { State } from './shared';

export {
  type WizardDraft,
  createWizardDraft,
  daysActivityFactor,
  goalCalorieDelta,
  goalPhaseName,
  recommendTemplate,
};

const noop = () => {};
const noopAsync = async () => {};

/** Renderiza el asistente de onboarding en 3 pasos delegando en `<WizardModal />`. */
export function renderWizardModal(S: State): string {
  if (!S.wizard) return '';
  return renderToString(
    h(WizardModal, {
      draft: S.wizard,
      onboardingCompleted: S.settings.onboardingCompleted,
      onPatch: noop,
      onBack: noop,
      onSubmitStep: noopAsync,
      onSkip: noopAsync,
    }),
  );
}
