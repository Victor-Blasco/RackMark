import type { DayPickerRoutineItem } from '../../store/workoutSelectors';
import { Icon } from '../common/Icon';

interface RoutineDayPickerProps {
  /** Lista preparada de rutinas disponibles con su sugerencia diaria. */
  items: DayPickerRoutineItem[];
  /** Inicia la sesión en vivo con la rutina o en modo `'Libre'`. */
  onStartWorkout: (day: string) => void;
  /** Redirige a la vista de registro histórico (`Registrar hecho`). */
  onGoToLog: () => void;
}

const fmtDate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/**
 * Pantalla inicial de `En vivo` para elegir la rutina del día o comenzar un entreno libre.
 */
export function RoutineDayPicker({ items, onStartWorkout, onGoToLog }: RoutineDayPickerProps) {
  return (
    <div class="mx-auto max-w-xl space-y-5 py-1">
      <div class="space-y-1">
        <h2 class="text-xl font-extrabold text-white">Iniciar entrenamiento</h2>
        <p class="text-sm text-gray-400">Elige qué toca hoy. Verás un ejercicio cada vez con peso, reps y descanso.</p>
      </div>

      <div class="divide-y divide-white/10 border-y border-white/10">
        {items.map((item) => (
          <button
            key={item.day}
            type="button"
            data-act="liveStart"
            data-arg={item.day}
            class={`flex min-h-[68px] w-full items-center justify-between gap-3 py-3.5 px-1 text-left transition-colors active:bg-white/5 ${item.isSuggested ? 'bg-electricBlue/[0.06]' : 'hover:bg-white/[0.03]'}`}
            onClick={() => onStartWorkout(item.day)}
          >
            <div class="min-w-0 flex-1 space-y-0.5">
              <div class="flex flex-wrap items-center gap-2">
                <span class="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
                <span class="text-base font-extrabold text-white">{item.day}</span>
                {item.sub && <span class="text-xs text-gray-400">· {item.sub}</span>}
                {item.isSuggested && <span class="rounded-full bg-electricBlue px-2 py-0.5 text-[10px] font-bold text-white">Toca hoy</span>}
              </div>
              <p class="text-xs text-gray-400 tabular-nums">
                {item.exerciseCount} ejercicios · {item.totalSets} series{item.lastDate ? ` · Última ${fmtDate(item.lastDate)}` : ''}
              </p>
            </div>
            <Icon name="play" className={`h-4 w-4 shrink-0 ${item.isSuggested ? 'text-blue-300' : 'text-gray-400'}`} />
          </button>
        ))}

        <button
          type="button"
          data-act="liveStart"
          data-arg="Libre"
          class="flex min-h-[64px] w-full items-center justify-between gap-3 py-3.5 px-1 text-left transition-colors hover:bg-white/[0.03] active:bg-white/5"
          onClick={() => onStartWorkout('Libre')}
        >
          <div class="space-y-0.5">
            <p class="text-sm font-bold text-white">Entreno libre</p>
            <p class="text-xs text-gray-400">Empieza vacío y añade ejercicios sobre la marcha.</p>
          </div>
          <Icon name="plus" className="h-5 w-5 shrink-0 text-blue-300" />
        </button>
      </div>

      <div class="pt-1 text-center">
        <button
          type="button"
          data-act="tab"
          data-arg="log"
          class="inline-flex min-h-[44px] items-center gap-1.5 px-3 text-xs font-semibold text-gray-300 hover:text-white"
          onClick={onGoToLog}
        >
          <Icon name="edit" className="h-3.5 w-3.5" /> ¿Ya terminaste? Registrar un entreno ya hecho
        </button>
      </div>
    </div>
  );
}
