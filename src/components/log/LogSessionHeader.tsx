import type { DayName } from '../../types';
import { routineColor, type State } from '../../ui/shared';
import { Icon } from '../common/Icon';

interface LogSessionHeaderProps {
  /** Estado global con colores de rutina. */
  state: State;
  /** Rutinas ordenadas más `'Libre'`. */
  routines: string[];
  /** Rutina actualmente seleccionada en el borrador. */
  selectedDay: DayName | 'Libre';
  /** Fecha ISO de la sesión editada. */
  date: string;
  /** Total de ejercicios en el borrador. */
  exerciseCount: number;
  /** Ejercicios con al menos una serie completada. */
  doneExCount: number;
  /** Series marcadas como hechas. */
  doneSetsCount: number;
  /** Series totales en el borrador. */
  totalSetsCount: number;
  /** Indica si todas las series con repeticiones están marcadas como hechas. */
  allDone: boolean;
  /** Abre el modo `En vivo`. */
  onOpenLive: () => void;
  /** Marca o desmarca todas las series válidas de la sesión. */
  onToggleAll: () => void;
  /** Reinicia el borrador actual previa confirmación. */
  onReset: () => void;
  /** Persiste la sesión en IndexedDB. */
  onSave: () => void;
  /** Cambia la fecha del borrador. */
  onChangeDate: (date: string) => void;
  /** Cambia la rutina del borrador. */
  onSelectDay: (day: DayName | 'Libre') => void;
}

/**
 * Cabecera del registro manual con fecha, selector de rutina y guardado.
 */
export function LogSessionHeader({
  state,
  routines,
  selectedDay,
  date,
  exerciseCount,
  doneExCount,
  doneSetsCount,
  totalSetsCount,
  allDone,
  onOpenLive,
  onToggleAll,
  onReset,
  onSave,
  onChangeDate,
  onSelectDay,
}: LogSessionHeaderProps) {
  return (
    <div class="space-y-3 pb-4 border-b border-white/10">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="min-w-[200px] flex-1">
          <h1 class="text-lg font-extrabold text-white">Registrar entreno ya hecho</h1>
          <p class="hidden sm:block text-xs text-gray-400">Añade o edita una sesión completada con sus cargas, reps y tiempo de descanso exacto.</p>
          <p id="logCountSummary" class="mt-0.5 text-xs sm:text-sm text-gray-300 tabular-nums">
            {doneExCount}/{exerciseCount} {exerciseCount === 1 ? 'ejercicio' : 'ejercicios'} · {doneSetsCount}/{totalSetsCount} {totalSetsCount === 1 ? 'serie marcada' : 'series marcadas'} ✓
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="btn btn-accent hidden lg:inline-flex text-sm" onClick={onOpenLive}>
            <Icon name="play" className="h-3.5 w-3.5" /> Iniciar entreno en vivo
          </button>
          <a href="#log-add-section" class="btn hidden md:inline-flex py-1.5 text-sm">+ Añadir ejercicio</a>
          {totalSetsCount > 0 && (
            <button
              type="button"
              aria-pressed={allDone ? 'true' : 'false'}
              class="btn hidden sm:inline-flex py-1.5 text-sm shrink-0"
              onClick={onToggleAll}
            >
              {allDone ? 'Desmarcar todo' : 'Marcar todo ✓'}
            </button>
          )}
          <button type="button" class="btn hidden md:inline-flex py-1.5 text-sm" onClick={onReset}>
            <Icon name="reset" className="h-3.5 w-3.5" /> Reiniciar
          </button>
          <button type="button" class="btn-primary min-h-[44px] py-1.5 tabular-nums shrink-0" onClick={onSave}>
            <Icon name="save" className="h-4 w-4" /> Guardar ({doneSetsCount})
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div class="flex items-center justify-between gap-2">
          <label class="flex items-center gap-2 text-xs text-gray-400 shrink-0">
            <span>Fecha</span>
            <input class="inp w-auto min-h-[44px] tabular-nums" type="date" value={date} aria-label="Fecha de la sesión" onChange={(e) => onChangeDate(e.currentTarget.value)} />
          </label>
          {totalSetsCount > 0 && (
            <button
              type="button"
              aria-pressed={allDone ? 'true' : 'false'}
              class="btn sm:hidden min-h-[44px] py-1.5 text-xs shrink-0"
              onClick={onToggleAll}
            >
              {allDone ? 'Desmarcar todo' : 'Marcar todo ✓'}
            </button>
          )}
        </div>
        <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar sm:flex-wrap pb-0.5 pr-2" role="group" aria-label="Rutina de la sesión">
          {[...routines, 'Libre'].map((d, idx) => {
            const on = selectedDay === d;
            const col = d === 'Libre' ? '#9CA3AF' : routineColor(d, state.settings, idx);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on ? 'true' : 'false'}
                class={`tab shrink-0 whitespace-nowrap min-h-[44px] sm:min-h-0 ${on ? 'tab-on' : ''}`}
                style={on && d !== 'Libre' ? { borderColor: col, color: col } : undefined}
                onClick={() => onSelectDay(d)}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
