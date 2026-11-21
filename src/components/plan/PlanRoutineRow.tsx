import type { RoutineEx } from '../../types';
import { Icon } from '../common/Icon';

interface PlanRoutineRowProps {
  /** Rutina a la que pertenece esta fila. */
  routine: string;
  /** Índice base 0 dentro de la rutina. */
  index: number;
  /** Total de ejercicios en la rutina para deshabilitar límites. */
  total: number;
  /** Clave estable para animación FLIP tras reordenar. */
  sortKey: string;
  /** Datos del ejercicio planificado (nombre, series, reps). */
  exercise: RoutineEx;
  /** Cadena resumida con músculo principal y secundarios. */
  muscleLabel: string;
  /** Abre el selector NFD para sustituir el ejercicio. */
  onOpenPicker: () => void;
  /** Actualiza las series objetivo. */
  onChangeSets: (val: string) => void;
  /** Actualiza las repeticiones objetivo. */
  onChangeReps: (val: string) => void;
  /** Desplaza la fila arriba o abajo con animación FLIP. */
  onMove: (dir: number) => void;
  /** Quita el ejercicio de la rutina. */
  onDelete: () => void;
}

/** Fila plana y compacta de un ejercicio dentro de `Planificación → Rutinas`. */
export function PlanRoutineRow({
  routine,
  index,
  total,
  sortKey,
  exercise,
  muscleLabel,
  onOpenPicker,
  onChangeSets,
  onChangeReps,
  onMove,
  onDelete,
}: PlanRoutineRowProps) {
  const exLbl = exercise.name || `ejercicio ${index + 1}`;

  return (
    <div data-sort-item data-sort-idx={index} data-sort-key={sortKey} class="py-2.5 flex min-w-0 flex-col sm:flex-row sm:items-center gap-2 transition-shadow">
      <div class="flex min-w-0 flex-1 items-start sm:items-center gap-1.5">
        <button type="button" data-sort-handle class="hidden sm:inline-flex icon-btn rounded-md touch-none cursor-grab active:cursor-grabbing select-none" aria-label={`Arrastrar ${exLbl} en ${routine}`} title="Arrastrar para reordenar">
          <Icon name="grip" className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          class="group flex min-h-[44px] sm:min-h-[38px] w-full min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-1 py-1 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue"
          aria-label={`Cambiar ejercicio ${index + 1} de ${routine}: ${exLbl}`}
          onClick={onOpenPicker}
        >
          <div class="min-w-0">
            <span class={`block text-sm font-semibold leading-snug transition-colors group-hover:text-blue-300 ${exercise.name ? 'text-white' : 'text-gray-400'}`}>
              {exercise.name || 'Elegir ejercicio…'}
            </span>
            {muscleLabel && <span class="block text-xs text-gray-400 mt-0.5 truncate">{muscleLabel}</span>}
          </div>
          <Icon name="caretDown" className="h-3.5 w-3.5 shrink-0 text-gray-400 transition-colors group-hover:text-blue-300" />
        </button>
      </div>

      <div class="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
        <div class="flex items-center gap-1.5 text-xs text-gray-400">
          <input class="inp w-12 sm:w-12 rounded-lg px-1.5 text-center font-bold tabular-nums" type="number" inputMode="numeric" enterKeyHint="done" min="1" value={exercise.sets} aria-label={`Series objetivo de ${exLbl}`} onChange={(e) => onChangeSets(e.currentTarget.value)} />
          <span aria-hidden="true">ser</span>
          <span aria-hidden="true">×</span>
          <input class="inp w-12 sm:w-12 rounded-lg px-1.5 text-center font-bold tabular-nums" type="number" inputMode="numeric" enterKeyHint="done" min="1" value={exercise.reps} aria-label={`Repeticiones objetivo de ${exLbl}`} onChange={(e) => onChangeReps(e.currentTarget.value)} />
          <span aria-hidden="true">reps</span>
        </div>
        <div class="flex shrink-0 items-center gap-0.5">
          <button type="button" class="icon-btn rounded-lg" disabled={index === 0} aria-label={`Subir ${exLbl} en ${routine}`} title="Subir" onClick={() => onMove(-1)}><Icon name="caretUp" className="h-3.5 w-3.5" /></button>
          <button type="button" class="icon-btn rounded-lg" disabled={index === total - 1} aria-label={`Bajar ${exLbl} en ${routine}`} title="Bajar" onClick={() => onMove(1)}><Icon name="caretDown" className="h-3.5 w-3.5" /></button>
          <button type="button" class="icon-btn rounded-lg text-coralRed hover:bg-coralRed/10" aria-label={`Eliminar ${exLbl} de ${routine}`} onClick={onDelete}><Icon name="close" className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}
