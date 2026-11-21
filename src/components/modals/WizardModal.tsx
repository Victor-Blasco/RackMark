import { useRef } from 'preact/hooks';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import type { WizardDraft } from '../../store/wizardSelectors';
import { Icon } from '../common/Icon';
import { WizardStep1, WizardStep2, WizardStep3 } from './WizardSteps';

interface WizardModalProps {
  /** Estado del asistente de configuración paso a paso. */
  draft: WizardDraft;
  /** Indica si el usuario ya completó una configuración previa. */
  onboardingCompleted?: boolean;
  /** Actualiza el borrador del paso actual. */
  onPatch: (patch: Partial<WizardDraft>) => void;
  /** Retrocede al paso anterior. */
  onBack: () => void;
  /** Valida el paso actual y avanza o guarda la configuración completa. */
  onSubmitStep: () => void | Promise<void>;
  /** Omite y cierra el asistente. */
  onSkip: () => void | Promise<void>;
}

const TITLES: Record<1 | 2 | 3, { title: string; sub: string }> = {
  1: { title: 'Tu perfil físico', sub: 'Personaliza tus calorías recomendadas y el seguimiento de tu progreso físico.' },
  2: { title: 'Objetivo y disponibilidad', sub: 'Elige tu objetivo actual y cuántos días a la semana quieres entrenar.' },
  3: { title: 'Tu rutina y Coach IA', sub: 'Elige la distribución base sugerida y cómo quieres recibir los informes.' },
};

/**
 * Modal de bienvenida e inicialización guiada en 3 pasos.
 */
export function WizardModal({
  draft,
  onboardingCompleted,
  onPatch,
  onBack,
  onSubmitStep,
  onSkip,
}: WizardModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true, () => void onSkip());

  const info = TITLES[draft.step];
  const modalAnim = draft.anim === 'open' ? 'wizard-modal-in' : '';
  const backdropAnim = draft.anim === 'open' ? 'wizard-backdrop-in' : '';
  const stepAnim = draft.anim === 'next' ? 'wizard-step-next' : draft.anim === 'prev' ? 'wizard-step-prev' : '';

  return (
    <div id="wizard-modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="wizardTitle" class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div class={`fixed inset-0 bg-black/80 ${backdropAnim}`} aria-hidden="true" onClick={() => void onSkip()} />
      <form
        id="f-wizard"
        class={`relative z-10 flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-modalDark shadow-2xl max-h-[90dvh] ${modalAnim}`}
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmitStep();
        }}
      >
        <div class="shrink-0 space-y-3 border-b border-white/10 px-4 pt-4 pb-3 sm:px-6 sm:pt-5">
          <div class="flex items-start justify-between gap-3">
            <div class={`min-w-0 ${stepAnim}`}>
              <span class="text-[11px] font-bold uppercase tracking-wider text-blue-300 tabular-nums">Paso {draft.step} de 3 · Configuración inicial</span>
              <h3 id="wizardTitle" class="text-lg font-extrabold text-white mt-0.5">{info.title}</h3>
              <p class="text-xs text-gray-400 mt-0.5">{info.sub}</p>
            </div>
            <button type="button" class="inline-flex min-h-[44px] sm:min-h-[34px] shrink-0 items-center rounded-lg px-2.5 text-xs font-semibold text-gray-400 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" onClick={() => void onSkip()}>
              Omitir
            </button>
          </div>

          <div class="grid grid-cols-3 gap-1.5" aria-hidden="true">
            {([1, 2, 3] as const).map((n) => {
              const barAnim = draft.anim === 'next' && n === draft.step ? 'wizard-bar-fill' : '';
              return (
                <div key={n} class="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div class={`h-full rounded-full ${n <= draft.step ? `bg-electricBlue ${barAnim}` : 'w-0'}`} />
                </div>
              );
            })}
          </div>
        </div>

        <div class="flex-1 overflow-y-auto overflow-x-clip px-4 py-3.5 sm:px-6 sm:py-4">
          {draft.error && (
            <p role="alert" class="mb-3 rounded-xl border border-coralRed/40 bg-coralRed/10 px-3 py-2 text-xs font-medium text-rose-200">
              {draft.error}
            </p>
          )}
          <div class={stepAnim}>
            {draft.step === 1 && <WizardStep1 draft={draft} onPatch={onPatch} />}
            {draft.step === 2 && <WizardStep2 draft={draft} onPatch={onPatch} />}
            {draft.step === 3 && <WizardStep3 draft={draft} showKeep={Boolean(onboardingCompleted)} onPatch={onPatch} />}
          </div>
        </div>

        <div class="shrink-0 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-modalDark px-4 py-3 sm:px-6">
          <div>
            {draft.step > 1 && (
              <button type="button" class="btn min-h-[44px]" onClick={onBack}>← Anterior</button>
            )}
          </div>
          <button id="wizardNext" type="submit" class="btn-primary min-h-[44px] px-5">
            {draft.step < 3 ? 'Siguiente →' : <><Icon name="save" className="h-4 w-4" /> Guardar y empezar</>}
          </button>
        </div>
      </form>
    </div>
  );
}
