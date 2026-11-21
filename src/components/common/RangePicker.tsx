import { RANGES, type RangeKey } from '../../store/types';
import { Collapsible } from './Collapsible';

interface RangePickerProps {
  /** Rango actualmente seleccionado. */
  active: RangeKey;
  /** Fechas inicio/fin personalizadas cuando `active === 'Custom'`. */
  custom?: { from?: string; to?: string };
  /** Selecciona uno de los rangos predefinidos o `'Custom'`. */
  onSelectRange?: (key: RangeKey) => void;
  /** Actualiza la fecha `Desde` del rango personalizado. */
  onChangeFrom?: (date: string) => void;
  /** Actualiza la fecha `Hasta` del rango personalizado. */
  onChangeTo?: (date: string) => void;
}

/**
 * Selector temporal unificado (`1M`, `3M`, `6M`, `1A`, `Todo` o rango personalizado de fechas).
 */
export function RangePicker({
  active,
  custom,
  onSelectRange,
  onChangeFrom,
  onChangeTo,
}: RangePickerProps) {
  return (
    <div class="flex flex-wrap items-center justify-start sm:justify-end gap-2">
      <div role="group" aria-label="Filtro temporal" class="inline-flex flex-wrap rounded-xl border border-white/10 bg-gray-900/70 p-1 gap-0.5">
        {RANGES.map((r) => {
          const isSelected = active === r.key;
          return (
            <button
              key={r.key}
              type="button"
              aria-pressed={isSelected ? 'true' : 'false'}
              class={`inline-flex min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-0 items-center justify-center rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${isSelected ? 'bg-electricBlue text-white' : 'text-gray-400 hover:text-white'}`}
              onClick={() => onSelectRange?.(r.key)}
            >
              {r.label}
            </button>
          );
        })}
      </div>

      <Collapsible open={active === 'Custom'}>
        <div class="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-gray-900/70 px-2.5 py-1.5 text-xs">
          <label class="inline-flex items-center gap-1.5 text-gray-400">
            <span>Desde</span>
            <input
              type="date"
              class="inp w-auto py-1 px-2 tabular-nums"
              value={custom?.from ?? ''}
              aria-label="Fecha de inicio"
              onChange={(e) => onChangeFrom?.(e.currentTarget.value)}
            />
          </label>
          <label class="inline-flex items-center gap-1.5 text-gray-400">
            <span>Hasta</span>
            <input
              type="date"
              class="inp w-auto py-1 px-2 tabular-nums"
              value={custom?.to ?? ''}
              aria-label="Fecha de fin"
              onChange={(e) => onChangeTo?.(e.currentTarget.value)}
            />
          </label>
        </div>
      </Collapsible>
    </div>
  );
}
