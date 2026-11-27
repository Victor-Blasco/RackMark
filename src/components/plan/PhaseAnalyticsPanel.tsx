import { useEffect, useMemo, useState } from 'preact/hooks';
import { buildMonthGrid, formatMonthTitle, type CalendarGridDay } from '../../store/adherenceCalendar';
import { buildPhaseAnalytics } from '../../store/phaseSelectors';
import type { DateBounds, State } from '../../ui/shared';
import { Icon } from '../common/Icon';
import { MonthCalendarGrid } from '../common/MonthCalendarGrid';
import { PhaseKpiRow } from './PhaseKpiRow';

interface PhaseAnalyticsPanelProps {
  /** Estado global con fases, fuerza, cardio y medidas. */
  state: State;
}

const EMPTY_BOUNDS: DateBounds = { key: 'Todo', from: null, to: null, label: 'Todo' };

/**
 * Análisis visual de fases: chips con color sobrio, calendario *lowkey* con bandas translúcidas y 4 KPIs neutros.
 */
export function PhaseAnalyticsPanel({ state }: PhaseAnalyticsPanelProps) {
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const vm = useMemo(() => buildPhaseAnalytics(state, selectedId), [state, selectedId]);
  const [monthIdx, setMonthIdx] = useState(vm.defaultMonthIdx);

  useEffect(() => {
    setMonthIdx(vm.defaultMonthIdx);
  }, [vm.active.id, vm.defaultMonthIdx]);

  const activeYm = vm.months[Math.min(monthIdx, Math.max(0, vm.months.length - 1))] ?? vm.today.slice(0, 7);
  const prevYm = monthIdx > 0 ? vm.months[monthIdx - 1] : undefined;

  const renderPhaseDay = (c: CalendarGridDay, colIdx: number) => {
    const phase = vm.phaseForDate(c.iso);
    const isSel = phase?.id === vm.active.id;
    const prevPhase = vm.phaseForDate(new Date(Date.parse(`${c.iso}T00:00:00Z`) - 864e5).toISOString().slice(0, 10));
    const nextPhase = vm.phaseForDate(new Date(Date.parse(`${c.iso}T00:00:00Z`) + 864e5).toISOString().slice(0, 10));
    const isStart = Boolean(phase) && (phase?.id !== prevPhase?.id || colIdx === 0);
    const isEnd = Boolean(phase) && (phase?.id !== nextPhase?.id || colIdx === 6);
    const trained = vm.trainedDates.has(c.iso);
    const roundCls = `${isStart ? 'rounded-l-lg' : ''} ${isEnd ? 'rounded-r-lg' : ''}`;
    const bgStyle = phase
      ? {
          backgroundColor: isSel ? `${phase.color}2e` : `${phase.color}12`,
          boxShadow: isSel ? `inset 0 1px 0 ${phase.color}66, inset 0 -1px 0 ${phase.color}66` : undefined,
        }
      : undefined;

    return (
      <button
        key={c.iso}
        type="button"
        disabled={!phase}
        aria-label={`${c.iso}${phase ? ` · ${phase.name}` : ''}${trained ? ' · Entrenado' : ''}`}
        onClick={() => phase && setSelectedId(phase.id)}
        style={bgStyle}
        class={`flex min-h-[38px] flex-col items-center justify-center gap-0.5 text-xs tabular-nums transition-colors ${roundCls} ${c.inMonth ? (phase ? 'text-white font-semibold' : 'text-gray-300') : 'text-gray-400/50'} ${c.isToday ? 'underline decoration-electricBlue underline-offset-2' : ''}`}
      >
        <span>{c.dayNum}</span>
        <span class={`h-1 w-1 rounded-full ${trained ? 'bg-white/80' : 'bg-transparent'}`} aria-hidden="true" />
      </button>
    );
  };

  return (
    <section class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div>
          <h2 class="text-base font-bold text-white">Fases del entrenamiento</h2>
          <p class="text-xs text-gray-400">{vm.active.name} · {vm.rangeLabel}</p>
        </div>
        <div class="flex flex-wrap gap-1.5" role="tablist" aria-label="Fases configuradas">
          {vm.blocks.map((b) => {
            const on = b.id === vm.active.id;
            return (
              <button
                key={b.id}
                type="button"
                role="tab"
                aria-selected={on ? 'true' : 'false'}
                onClick={() => setSelectedId(b.id)}
                class={`inline-flex min-h-[44px] sm:min-h-[34px] items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${on ? 'border-white/30 bg-cardDark text-white' : 'border-white/10 text-gray-400 hover:text-white'}`}
              >
                <span class="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} aria-hidden="true" />
                <span>{b.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div class="pb-4 border-b border-white/10 space-y-3">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs text-gray-400">Toca cualquier día de una etapa para seleccionarla</span>
          <div class="flex items-center gap-1">
            <button type="button" class="icon-btn border border-white/10 bg-white/[0.03]" disabled={monthIdx <= 0} aria-label="Mes anterior en fases" onClick={() => setMonthIdx((i) => Math.max(0, i - 1))}>
              <Icon name="caretLeft" className="h-4 w-4" />
            </button>
            <button type="button" class="icon-btn border border-white/10 bg-white/[0.03]" disabled={monthIdx >= vm.months.length - 1} aria-label="Mes siguiente en fases" onClick={() => setMonthIdx((i) => Math.min(vm.months.length - 1, i + 1))}>
              <Icon name="caretRight" className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div class="lg:hidden">
          <MonthCalendarGrid title={formatMonthTitle(activeYm)} cells={buildMonthGrid(activeYm, vm.today, EMPTY_BOUNDS, {})} renderDay={renderPhaseDay} />
        </div>
        <div class={`hidden lg:grid gap-6 ${prevYm ? 'lg:grid-cols-2' : 'lg:grid-cols-1 max-w-md'}`}>
          {prevYm && <MonthCalendarGrid title={formatMonthTitle(prevYm)} cells={buildMonthGrid(prevYm, vm.today, EMPTY_BOUNDS, {})} renderDay={renderPhaseDay} />}
          <MonthCalendarGrid title={formatMonthTitle(activeYm)} cells={buildMonthGrid(activeYm, vm.today, EMPTY_BOUNDS, {})} renderDay={renderPhaseDay} />
        </div>
      </div>

      <PhaseKpiRow vm={vm} />
    </section>
  );
}
