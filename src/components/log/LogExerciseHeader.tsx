import type { exerciseContext } from '../../store/exerciseCatalog';
import type { LogExDraft } from '../../types';
import { Icon } from '../common/Icon';

interface LogExerciseHeaderProps {
  /** Índice base 0 del ejercicio dentro del borrador. */
  ei: number;
  /** Número total de ejercicios en el borrador. */
  total: number;
  /** Datos del ejercicio editable. */
  exercise: LogExDraft;
  /** Contexto histórico, prescripción y contadores. */
  ctx: ReturnType<typeof exerciseContext>;
  /** Marca o desmarca todas las series válidas del ejercicio. */
  onToggleExercise: () => void;
  /** Sube o baja el ejercicio en la lista. */
  onMoveExercise: (dir: number) => void;
  /** Quita el ejercicio del borrador. */
  onRemoveExercise: () => void;
}

/** Cabecera interactiva con asa de arrastre, check maestro y botones de reordenamiento. */
export function LogExerciseHeader({
  ei,
  total,
  exercise: ex,
  ctx,
  onToggleExercise,
  onMoveExercise,
  onRemoveExercise,
}: LogExerciseHeaderProps) {
  return (
    <div class="flex flex-wrap sm:flex-nowrap items-start justify-between gap-2">
      <div class="flex flex-1 min-w-[190px] items-start gap-2">
        <button type="button" data-sort-handle class="flex h-11 w-11 shrink-0 touch-none cursor-grab active:cursor-grabbing select-none items-center justify-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" aria-label={`Arrastrar para reordenar ${ex.name}`} title="Arrastrar para reordenar">
          <Icon name="grip" className="h-4 w-4" />
        </button>
        <button type="button" aria-pressed={ctx.allDoneInEx ? 'true' : 'false'} class="flex flex-1 min-w-0 min-h-[44px] items-start gap-2.5 text-left rounded-lg py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" onClick={onToggleExercise}>
          <span class={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${ctx.allDoneInEx ? 'border-emeraldGreen bg-emeraldGreen/20 text-emeraldGreen' : ctx.doneInEx > 0 ? 'border-electricBlue bg-electricBlue/20 text-blue-300' : 'border-gray-600 text-transparent'}`}>
            <Icon name="check" className="h-4 w-4" />
          </span>
          <div class="min-w-0">
            <div class="font-bold text-white leading-snug">
              {ex.name}{' '}
              {ctx.tgt && <span class="ml-1 tabular-nums text-[13px] font-normal text-gray-400">({ctx.tgt.sets}×{ctx.tgt.reps})</span>}{' '}
              <span class={`ml-1 tabular-nums text-xs font-semibold ${ctx.allDoneInEx ? 'text-emerald-300' : 'text-gray-400'}`}>
                {ctx.doneInEx}/{ex.sets.length}
              </span>
            </div>
            <div class="tabular-nums text-xs sm:text-[13px] text-gray-300">{ctx.lastRef}</div>
          </div>
        </button>
      </div>

      <div class="ml-auto flex shrink-0 items-center gap-0.5">
        <button type="button" class="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-25 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" disabled={ei === 0} aria-label={`Subir ${ex.name}`} title="Subir" onClick={() => onMoveExercise(-1)}>
          <Icon name="caretUp" className="h-3.5 w-3.5" />
        </button>
        <button type="button" class="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-25 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" disabled={ei === total - 1} aria-label={`Bajar ${ex.name}`} title="Bajar" onClick={() => onMoveExercise(1)}>
          <Icon name="caretDown" className="h-3.5 w-3.5" />
        </button>
        <button type="button" class="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:text-coralRed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" aria-label={`Quitar ${ex.name} de la sesión`} onClick={onRemoveExercise}>
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
