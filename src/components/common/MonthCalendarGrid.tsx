import type { ComponentChildren } from 'preact';
import { WEEKDAYS, type CalendarGridDay } from '../../store/adherenceCalendar';
import { Icon } from './Icon';

interface MonthCalendarGridProps {
  /** Título del mes (p. ej. `"Noviembre 2026"`). */
  title: string;
  /** Subtítulo opcional bajo el título del mes. */
  subtitle?: string;
  /** Celdas generadas por `buildMonthGrid`. */
  cells: CalendarGridDay[];
  /** Si se muestran flechas de navegación mensual (`onPrev` / `onNext`). */
  showNav?: boolean;
  /** Habilita el botón de mes anterior. */
  canPrev?: boolean;
  /** Habilita el botón de mes siguiente. */
  canNext?: boolean;
  /** Callback al pulsar mes anterior. */
  onPrev?: () => void;
  /** Callback al pulsar mes siguiente. */
  onNext?: () => void;
  /** Renderizador personalizado para cada celda diaria. */
  renderDay: (cell: CalendarGridDay, colIdx: number, idx: number) => ComponentChildren;
}

/**
 * Cuadrícula mensual reutilizable (Lunes a Domingo) compartida entre `Adherencia` y `Fases`.
 */
export function MonthCalendarGrid({
  title,
  subtitle,
  cells,
  showNav = false,
  canPrev = false,
  canNext = false,
  onPrev,
  onNext,
  renderDay,
}: MonthCalendarGridProps) {
  return (
    <div class="space-y-3">
      {showNav ? (
        <div class="flex items-center justify-between gap-2">
          <button type="button" class="icon-btn border border-white/10 bg-white/[0.03]" disabled={!canPrev} aria-label="Mes anterior" onClick={onPrev}>
            <Icon name="caretLeft" className="h-4 w-4" />
          </button>
          <div class="text-center">
            <h2 class="text-sm sm:text-base font-extrabold text-white">{title}</h2>
            {subtitle && <p class="text-[11px] text-gray-400 tabular-nums">{subtitle}</p>}
          </div>
          <button type="button" class="icon-btn border border-white/10 bg-white/[0.03]" disabled={!canNext} aria-label="Mes siguiente" onClick={onNext}>
            <Icon name="caretRight" className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div class="text-center">
          <h3 class="text-xs sm:text-sm font-bold text-white">{title}</h3>
          {subtitle && <p class="text-[11px] text-gray-400 tabular-nums">{subtitle}</p>}
        </div>
      )}

      <div class="grid grid-cols-7 border-b border-white/10 pb-2 text-center text-[11px] font-bold text-gray-400">
        {WEEKDAYS.map((d, i) => <span key={d} class={i === 6 ? 'text-blue-300/80' : ''}>{d}</span>)}
      </div>

      <div class="grid grid-cols-7 gap-y-1">
        {cells.map((cell, idx) => renderDay(cell, idx % 7, idx))}
      </div>
    </div>
  );
}
