import { Icon } from '../common/Icon';
import { RangePicker } from '../common/RangePicker';
import { SegmentedControl } from '../common/SegmentedControl';
import { fmtDate, type DateBounds, type RangeKey } from '../../ui/shared';

interface DayRoutineHeaderProps {
  day: string;
  dayColor: string;
  sessCount: number;
  lastSess?: { date: string; sets: number; durMin?: number; avgHr?: number; maxHr?: number; kcal?: number };
  bounds: DateBounds;
  hasFilter: boolean;
  customRange?: { from?: string; to?: string };
  unmappedCount: number;
  organizeOpen: boolean;
  simOpen: boolean;
  showingExtra: boolean;
  primaryCount: number;
  extraCount: number;
  onOpenUnmapped: () => void;
  onToggleOrganize: () => void;
  onToggleSim: () => void;
  onOpenLog: () => void;
  onStartWorkout: () => void;
  onSetScope: (scope: 'routine' | 'extra') => void;
  onSelectRange: (k: RangeKey) => void;
  onChangeFrom: (val: string) => void;
  onChangeTo: (val: string) => void;
}

/** Cabecera de `Rutina` con resumen de última sesión, botones rápidos y filtros. */
export function DayRoutineHeader({
  day, dayColor, sessCount, lastSess, bounds, hasFilter, customRange, unmappedCount,
  organizeOpen, simOpen, showingExtra, primaryCount, extraCount,
  onOpenUnmapped, onToggleOrganize, onToggleSim, onOpenLog, onStartWorkout, onSetScope,
  onSelectRange, onChangeFrom, onChangeTo,
}: DayRoutineHeaderProps) {
  return (
    <section class="pb-4 border-b border-white/10 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="space-y-0.5">
          <div class="flex items-center gap-2">
            <span class="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: dayColor }} aria-hidden="true" />
            <h1 class="text-lg font-extrabold text-white">Rutina {day}</h1>
            <span class="text-xs text-gray-400 tabular-nums">· {sessCount} {sessCount === 1 ? 'sesión' : 'sesiones'}{hasFilter ? ` (${bounds.label})` : ''}</span>
          </div>
          <p class="text-xs sm:text-sm text-gray-400 tabular-nums">
            {lastSess
              ? `Última: ${fmtDate(lastSess.date)} · ${lastSess.sets} ${lastSess.sets === 1 ? 'serie' : 'series'}${lastSess.durMin ? ` · ${Math.round(lastSess.durMin)} min` : ''}${lastSess.avgHr ? ` · Pulso ${lastSess.avgHr}${lastSess.maxHr ? `/${lastSess.maxHr}` : ''} lpm` : ''}${lastSess.kcal ? ` · ${lastSess.kcal} kcal` : ''}`
              : `Sin sesiones en ${bounds.label}`}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {unmappedCount > 0 && (
            <button type="button" class="btn-sm border-amberGold/40 text-amberGold tabular-nums" onClick={onOpenUnmapped}>
              {unmappedCount} sin nombre
            </button>
          )}
          <button
            type="button"
            aria-pressed={organizeOpen ? 'true' : 'false'}
            class={`btn-sm sm:text-sm ${organizeOpen ? 'border-electricBlue bg-electricBlue/15 text-blue-300' : ''}`}
            onClick={onToggleOrganize}
          >
            <Icon name="edit" className="h-3.5 w-3.5" /> {organizeOpen ? 'Listo ✓' : 'Organizar'}
          </button>
          <button
            type="button"
            aria-pressed={simOpen ? 'true' : 'false'}
            class={`btn-sm sm:text-sm ${simOpen ? 'border-electricBlue bg-electricBlue/15 text-blue-300' : ''}`}
            onClick={onToggleSim}
          >
            {simOpen ? 'Ocultar volumen' : 'Ver volumen'}
          </button>
          <button type="button" class="btn-sm sm:text-sm" onClick={onOpenLog}>Registrar hecho</button>
          <button type="button" class="btn-primary-sm flex-1 sm:flex-initial sm:text-sm whitespace-nowrap" onClick={onStartWorkout}>
            <Icon name="play" className="h-3.5 w-3.5" /> Iniciar {day}
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3">
        {extraCount > 0 && primaryCount > 0 ? (
          <SegmentedControl
            role="tablist"
            options={[
              { id: 'routine' as const, label: `En rutina (${primaryCount})` },
              { id: 'extra' as const, label: `Anteriores (${extraCount})` },
            ]}
            value={showingExtra ? 'extra' : 'routine'}
            ariaLabel="Filtro de ejercicios"
            className="inline-flex rounded-xl border border-white/10 bg-gray-900/70 p-1 gap-1"
            buttonClassName="min-h-[44px] sm:min-h-[34px] px-3 py-1.5 text-xs tabular-nums"
            onChange={onSetScope}
          />
        ) : <span />}
        <RangePicker
          active={bounds.key}
          custom={customRange}
          onSelectRange={onSelectRange}
          onChangeFrom={onChangeFrom}
          onChangeTo={onChangeTo}
        />
      </div>
    </section>
  );
}
