import { useEffect } from 'preact/hooks';
import type { ExerciseCompletionSummary } from '../../store/workoutSelectors';
import { Icon } from '../common/Icon';

interface PrevCompletedBannerProps {
  /** Índice del ejercicio recién completado (reinicia el temporizador al cambiar). */
  prevIdx?: number;
  /** Nombre del ejercicio recién terminado. */
  prevName: string;
  /** Resumen de hoy y comparativa frente a la sesión previa del ejercicio. */
  summary?: ExerciseCompletionSummary;
  /** Regresa al ejercicio anterior. */
  onGoBack: () => void;
  /** Añade una serie extra al ejercicio terminado y vuelve a él. */
  onAddExtraSet: () => void;
  /** Oculta el aviso contextual. */
  onDismiss: () => void;
}

const TONE_CLS: Record<ExerciseCompletionSummary['tone'], string> = {
  emerald: 'text-emeraldGreen',
  amber: 'text-amberGold',
  blue: 'text-blue-300',
};

/** Pop-up flotante con resumen y comparativa que se cierra automáticamente a los 5 segundos. */
export function PrevCompletedBanner({ prevIdx, prevName, summary, onGoBack, onAddExtraSet, onDismiss }: PrevCompletedBannerProps) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(t);
  }, [prevIdx, prevName, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      class="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] sm:bottom-6 sm:left-auto sm:right-6 sm:w-[24rem] z-40 rounded-2xl border border-emeraldGreen/45 bg-modalDark p-4 shadow-2xl space-y-2.5"
    >
      <div class="flex items-start justify-between gap-2">
        <div class="flex min-w-0 items-center gap-2">
          <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emeraldGreen/20 text-emeraldGreen">
            <Icon name="check" className="h-4 w-4" />
          </span>
          <div class="min-w-0">
            <p class="truncate text-sm font-extrabold text-white">{prevName} completado</p>
            <p class="text-[11px] text-gray-400">Resumen automático · se oculta en 5 s</p>
          </div>
        </div>
        <button
          type="button"
          class="flex h-11 w-11 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg text-gray-300 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue"
          aria-label="Cerrar resumen"
          onClick={onDismiss}
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>

      {summary && (
        <div class="space-y-0.5 rounded-xl bg-white/[0.04] px-3 py-2 text-xs">
          <p class="text-gray-200 num-col">
            {summary.setsCount} {summary.setsCount === 1 ? 'serie' : 'series'} · máx {summary.topWeight} kg · {summary.totalReps} reps · {summary.totalVolume} kg vol.
          </p>
          <p class={`font-bold num-col ${TONE_CLS[summary.tone]}`}>{summary.comparisonText}</p>
        </div>
      )}

      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="btn min-h-[44px] sm:min-h-[36px] px-3 text-xs font-semibold" onClick={onGoBack}>
          Volver
        </button>
        <button
          type="button"
          class="min-h-[44px] sm:min-h-[36px] flex-1 rounded-xl border border-emeraldGreen/40 px-3 text-xs font-bold text-emerald-200 hover:bg-emeraldGreen/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue"
          onClick={onAddExtraSet}
        >
          + Serie extra
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
        <h2 class="text-sm font-extrabold text-emerald-200">¡Todos los ejercicios completados!</h2>
        <p class="text-xs text-gray-300 tabular-nums">
          {doneExCount} {doneExCount === 1 ? 'ejercicio' : 'ejercicios'} · {doneSetsCount} {doneSetsCount === 1 ? 'serie' : 'series'} · {elapsedLabel}
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn-primary min-h-[44px] flex-1 sm:flex-initial" onClick={onSave}>
          <Icon name="save" className="h-4 w-4" /> Guardar entrenamiento
        </button>
        <button type="button" class="btn min-h-[44px]" onClick={onAddExercise}>
          + Añadir ejercicio
        </button>
      </div>
    </div>
  );
}
