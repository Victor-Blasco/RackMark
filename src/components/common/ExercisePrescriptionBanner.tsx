interface ExercisePrescriptionBannerProps {
  /** Texto de prescripción de carga/progresión para la sesión. */
  prescription?: string | null;
  /** Peso objetivo sugerido para aplicar con un toque (si procede). */
  targetW?: number | null;
  /** Nota fija persistente del ejercicio. */
  fixedNote?: string | null;
  /** Muestra la guía inicial cuando es la primera vez sin histórico ni peso cargado. */
  firstTimeHint?: boolean;
  /** Callback al pulsar `Aplicar {targetW} kg`. */
  onApplyTarget: (w: number) => void;
  /** Clases CSS opcionales para personalizar el botón de aplicar peso. */
  applyBtnClass?: string;
}

const DEFAULT_APPLY_BTN =
  'btn btn-s text-xs py-1.5 px-2.5 min-h-[44px] sm:min-h-[34px] border-emeraldGreen/40 text-emeraldGreen hover:bg-emeraldGreen/15';

/**
 * Banner compacto con la prescripción sugerida, botón rápido de peso objetivo y nota fija del ejercicio.
 */
export function ExercisePrescriptionBanner({
  prescription,
  targetW,
  fixedNote,
  firstTimeHint = false,
  onApplyTarget,
  applyBtnClass,
}: ExercisePrescriptionBannerProps) {
  if (!prescription && targetW == null && !fixedNote && !firstTimeHint) return null;

  return (
    <div class="space-y-1 border-l-2 border-emeraldGreen/70 pl-2.5 text-xs">
      {prescription ? (
        <div class="flex flex-wrap items-center justify-between gap-2 text-gray-200">
          <span>{prescription}</span>
          {targetW != null && (
            <button
              type="button"
              class={applyBtnClass ?? DEFAULT_APPLY_BTN}
              onClick={() => onApplyTarget(targetW)}
            >
              Aplicar {targetW} kg
            </button>
          )}
        </div>
      ) : firstTimeHint ? (
        <p class="text-gray-300">Primera vez: empieza con un peso cómodo donde controles bien todas las repeticiones.</p>
      ) : null}
      {fixedNote && (
        <p class="text-gray-300">
          <span class="font-semibold text-white">Nota fija:</span> {fixedNote}
        </p>
      )}
    </div>
  );
}
