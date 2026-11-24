import { useEffect, useRef } from 'preact/hooks';
import { MODAL_FOCUSABLE_SELECTOR } from '../../hooks/useFocusTrap';
import type { WizardDraft } from '../../store/wizardSelectors';
import { Icon } from '../common/Icon';
import { ModalShell } from '../common/ModalShell';
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
  const firstStepRef = useRef(true);

  useEffect(() => {
    if (firstStepRef.current) {
      firstStepRef.current = false;
      return;
    }
    const raf = window.requestAnimationFrame(() => {
      const target = dialogRef.current?.querySelector<HTMLElement>(
        `#f-wizard input:not([type="hidden"]):not([disabled]), #f-wizard ${MODAL_FOCUSABLE_SELECTOR}`,
      ) ?? document.getElementById('wizardTitle');
      target?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [draft.step]);

  const info = TITLES[draft.step];
  const modalAnim = draft.anim === 'open' ? 'wizard-modal-in' : '';
  const backdropAnim = draft.anim === 'open' ? 'wizard-backdrop-in' : '';
  const stepAnim = draft.anim === 'next' ? 'wizard-step-next' : draft.anim === 'prev' ? 'wizard-step-prev' : '';

  return (
    <ModalShell
      id="wizard-modal"
      labelledBy="wizardTitle"
      dialogRef={dialogRef}
      wrapperClass="p-3 sm:p-4"
      backdropClass={backdropAnim}
      closeOnBackdrop={false}
      panelClass={`max-w-xl border-white/10 flex flex-col overflow-hidden max-h-[90dvh] ${modalAnim}`}
      onClose={() => void onSkip()}
    >
      <form
        id="f-wizard"
        class="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmitStep();
        }}
      >
        <div class="shrink-0 space-y-3 border-b border-white/10 px-4 pt-4 pb-3 sm:px-6 sm:pt-5">
          <div class="flex items-start justify-between gap-3">
            <div class={`min-w-0 ${stepAnim}`}>
              <span class="text-[11px] font-bold uppercase tracking-wider text-blue-300 tabular-nums">Paso {draft.step} de 3 · Configuración inicial</span>
              <h3 id="wizardTitle" tabIndex={-1} class="text-lg font-extrabold text-white mt-0.5 focus:outline-none">{info.title}</h3>
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
            <p role="alert" class="mb-3 rounded-xl border border-coralRed/40 bg-coralRed/10 px-3 py-2 text-xs font-medium text-rose-200">{draft.error}</p>
          )}
          <div class={stepAnim}>
            {draft.step === 1 && <WizardStep1 draft={draft} onPatch={onPatch} />}
            {draft.step === 2 && <WizardStep2 draft={draft} onPatch={onPatch} />}
            {draft.step === 3 && <WizardStep3 draft={draft} showKeep={Boolean(onboardingCompleted)} onPatch={onPatch} />}
          </div>
        </div>

        <div class="shrink-0 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-modalDark px-4 py-3 sm:px-6">
          <div>{draft.step > 1 && <button type="button" class="btn min-h-[44px]" onClick={onBack}>← Anterior</button>}</div>
          <button id="wizardNext" type="submit" class="btn-primary min-h-[44px] px-5">
            {draft.step < 3 ? 'Siguiente →' : <><Icon name="save" className="h-4 w-4" /> Guardar y empezar</>}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
