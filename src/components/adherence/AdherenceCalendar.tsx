import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  CARDIO_CALENDAR_COLOR,
  OTHER_CALENDAR_COLOR,
  buildMonthGrid,
  formatDayHeading,
  formatMonthTitle,
  type AdherenceCalendarData,
} from '../../store/adherenceCalendar';
import type { Settings } from '../../types';
import { routineColor, type DateBounds } from '../../ui/shared';
import { MonthCalendarGrid } from '../common/MonthCalendarGrid';
import { AdherenceDayDetail } from './AdherenceSections';

interface AdherenceCalendarProps {
  /** Datos mensuales y actividades agrupadas por fecha. */
  calendar: AdherenceCalendarData;
  /** Rango temporal activo para atenuar días fuera de ventana. */
  bounds: DateBounds;
  /** Rutinas activas para la leyenda inferior. */
  routines: string[];
  /** Ajustes globales con metadatos de color. */
  settings: Settings;
}

const pickInitialDay = (ym: string, cal: AdherenceCalendarData): string => {
  const active = Object.keys(cal.byDate).filter((iso) => iso.startsWith(ym)).sort();
  if (active.length) return active[active.length - 1];
  return cal.today.startsWith(ym) ? cal.today : `${ym}-01`;
};

/**
 * Calendario mensual interactivo de adherencia con navegación por meses dentro del periodo y detalle diario.
 */
export function AdherenceCalendar({ calendar, bounds, routines, settings }: AdherenceCalendarProps) {
  const [monthYm, setMonthYm] = useState(calendar.defaultMonth);
  const [selectedIso, setSelectedIso] = useState(() => pickInitialDay(calendar.defaultMonth, calendar));
  const monthsKey = calendar.months.join(',');

  useEffect(() => {
    setMonthYm(calendar.defaultMonth);
    setSelectedIso(pickInitialDay(calendar.defaultMonth, calendar));
  }, [calendar.defaultMonth, monthsKey]);

  const monthIdx = Math.max(0, calendar.months.indexOf(monthYm));
  const activeYm = calendar.months[monthIdx] ?? calendar.defaultMonth;
  const { cells, monthActs, monthTotalCount } = useMemo(() => {
    const grid = buildMonthGrid(activeYm, calendar.today, bounds, calendar.byDate);
    const acts = Object.values(calendar.byDate).filter((a) => a.iso.startsWith(activeYm));
    const total = acts.reduce((acc, a) => acc + a.strength.length + a.cardio.length, 0);
    return { cells: grid, monthActs: acts, monthTotalCount: total };
  }, [activeYm, calendar.today, calendar.byDate, bounds]);

  const stepMonth = (delta: number) => {
    const nextYm = calendar.months[monthIdx + delta];
    if (!nextYm) return;
    setMonthYm(nextYm);
    setSelectedIso(pickInitialDay(nextYm, calendar));
  };

  return (
    <section class="pb-5 border-b border-white/10">
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        <div class="lg:col-span-7 space-y-3">
          <MonthCalendarGrid
            title={formatMonthTitle(activeYm)}
            subtitle={`${monthTotalCount} ${monthTotalCount === 1 ? 'sesión' : 'sesiones'} · ${monthActs.length} ${monthActs.length === 1 ? 'día activo' : 'días activos'}`}
            cells={cells}
            showNav
            canPrev={monthIdx > 0}
            canNext={monthIdx < calendar.months.length - 1}
            onPrev={() => stepMonth(-1)}
            onNext={() => stepMonth(1)}
            renderDay={(c) => {
              const isSelected = c.iso === selectedIso;
              const act = c.activity;
              const inWindow = Boolean(act?.primaryColor) && c.inMonth && c.inBounds;
              const faded = Boolean(act?.primaryColor) && (!c.inMonth || !c.inBounds);
              const circleCls = inWindow
                ? 'border-2 text-white font-extrabold'
                : faded
                  ? 'border text-white/80 opacity-45 font-bold'
                  : c.inMonth
                    ? 'text-gray-200 hover:bg-white/[0.06]'
                    : 'text-gray-400/60';
              return (
                <button
                  key={c.iso}
                  type="button"
                  aria-label={`${formatDayHeading(c.iso)}: ${act ? act.primaryLabel : 'Sin sesiones'}`}
                  aria-pressed={isSelected ? 'true' : 'false'}
                  onClick={() => setSelectedIso(c.iso)}
                  class="relative flex min-h-[44px] flex-col items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue"
                >
                  <span
                    class={`flex h-9 w-9 items-center justify-center rounded-full text-xs sm:text-sm tabular-nums transition-transform ${circleCls} ${c.isToday && !isSelected ? 'ring-1 ring-white/40' : ''} ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-bgDark' : ''}`}
                    style={act?.primaryColor ? { backgroundColor: `${act.primaryColor}2b`, borderColor: act.primaryColor } : undefined}
                  >
                    {c.dayNum}
                  </span>
                  {act?.multi && <span class="mt-0.5 h-1 w-1 rounded-full bg-white/80" aria-hidden="true" />}
                </button>
              );
            }}
          />

          <div class="flex flex-wrap gap-3 pt-1 text-xs text-gray-400">
            {routines.map((d, idx) => (
              <span key={d} class="inline-flex items-center gap-1.5">
                <span class="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: routineColor(d, settings, idx) }} aria-hidden="true" />
                {d}
              </span>
            ))}
            {calendar.hasCardio && (
              <span class="inline-flex items-center gap-1.5">
                <span class="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CARDIO_CALENDAR_COLOR }} aria-hidden="true" />
                Cardio
              </span>
            )}
            <span class="inline-flex items-center gap-1.5">
              <span class="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: OTHER_CALENDAR_COLOR }} aria-hidden="true" />
              Otro
            </span>
          </div>
        </div>

        <AdherenceDayDetail selectedIso={selectedIso} dayAct={calendar.byDate[selectedIso]} />
      </div>
    </section>
  );
}
