import { Icon } from '../common/Icon';

interface PrevCompletedBannerProps {
  /** Nombre del ejercicio recién terminado. */
  prevName: string;
  /** Índice del ejercicio recién terminado. */
  prevIdx: number;
  /** Regresa al ejercicio anterior. */
  onGoBack: () => void;
  /** Añade una serie extra al ejercicio terminado y vuelve a él. */
  onAddExtraSet: () => void;
  /** Oculta el aviso contextual. */
  onDismiss: () => void;
}

/** Aviso contextual tras avanzar automáticamente al terminar todas las series de un ejercicio. */
export function PrevCompletedBanner({ prevName, prevIdx, onGoBack, onAddExtraSet, onDismiss }: PrevCompletedBannerProps) {
  return (
    <div class="flex flex-wrap items-center justify-between gap-2 border-l-4 border-emeraldGreen bg-emeraldGreen/10 px-3 py-2 rounded-r-xl text-xs">
      <span class="font-semibold text-emerald-200">{prevName} completado · siguiente</span>
      <div class="flex flex-wrap items-center gap-1.5">
        <button type="button" class="min-h-[44px] sm:min-h-[36px] rounded-lg px-2.5 text-xs font-semibold text-gray-200 hover:bg-white/10" data-act="liveGoEx" data-arg={String(prevIdx)} onClick={onGoBack}>
          Volver
        </button>
        <button type="button" class="min-h-[44px] sm:min-h-[36px] rounded-lg border border-emeraldGreen/40 px-2.5 text-xs font-bold text-emerald-200" data-act="liveAddExtraSetPrev" onClick={onAddExtraSet}>
          + Serie extra en {prevName}
        </button>
        <button type="button" class="flex h-11 w-11 sm:h-9 sm:w-9 items-center justify-center rounded-lg text-gray-300 hover:bg-white/10" data-act="liveClearBanner" aria-label="Cerrar aviso" onClick={onDismiss}>
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

interface AllDoneBannerProps {
  /** Ejercicios totales realizados. */
  doneExCount: number;
  /** Series completadas totales. */
  doneSetsCount: number;
  /** Duración transcurrida formateada. */
  elapsedLabel: string;
  /** Guarda la sesión completada. */
  onSave: () => void;
  /** Abre el selector para añadir un ejercicio adicional. */
  onAddExercise: () => void;
}

/** Aviso destacado cuando todos los ejercicios planificados tienen todas sus series marcadas. */
export function AllDoneBanner({ doneExCount, doneSetsCount, elapsedLabel, onSave, onAddExercise }: AllDoneBannerProps) {
  return (
    <div class="border-l-4 border-emeraldGreen bg-emeraldGreen/10 px-3 py-3 rounded-r-xl space-y-2.5">
      <div>
        <h3 class="text-sm font-extrabold text-emerald-200">¡Todos los ejercicios completados!</h3>
        <p class="text-xs text-gray-300 tabular-nums">{doneExCount} ejercicios · {doneSetsCount} series · {elapsedLabel}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn-primary min-h-[44px] flex-1 sm:flex-initial" data-act="liveSave" onClick={onSave}>
          <Icon name="save" className="h-4 w-4" /> Guardar entrenamiento
        </button>
        <button type="button" class="btn min-h-[44px]" data-act="liveOpenPicker" data-arg="add" onClick={onAddExercise}>
          + Añadir ejercicio
        </button>
      </div>
    </div>
  );
}
