import type { buildHomeViewModel } from '../../store/homeSelectors';
import type { RangeKey } from '../../store/types';
import { fmtDate, r1, short } from '../../ui/shared';
import { Icon } from '../common/Icon';
import { RangePicker } from '../common/RangePicker';

interface HomeHeroStripProps {
  /** Modelo derivado de `buildHomeViewModel` con KPIs y última sesión. */
  vm: ReturnType<typeof buildHomeViewModel>;
  /** Fechas personalizadas actuales para el filtro `home`. */
  customRange?: { from?: string; to?: string };
  /** Inicia el entreno en vivo. */
  onStartWorkout: () => void;
  /** Navega a `Registrar hecho`. */
  onGoLog: () => void;
  /** Cambia el periodo de análisis. */
  onSelectRange: (key: RangeKey) => void;
  /** Actualiza la fecha inicial personalizada. */
  onChangeFrom: (val: string) => void;
  /** Actualiza la fecha final personalizada. */
  onChangeTo: (val: string) => void;
}

/**
 * Cabecera de `Resumen` con última sesión, accesos directos, 4 KPIs y filtro temporal.
 */
export function HomeHeroStrip({
  vm,
  customRange,
  onStartWorkout,
  onGoLog,
  onSelectRange,
  onChangeFrom,
  onChangeTo,
}: HomeHeroStripProps) {
  const { lastS, hasFilter, bounds, activeDays, weeks, phase, lastDayHex, lastBadge, mWeight, wDelta, wDeltaCls, mBf, bfDelta, mMuscle, mWaist, fourthMetric } = vm;

  return (
    <section class="pb-5 border-b border-white/10 space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex min-w-0 items-center gap-3">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-sm font-extrabold tabular-nums" style={{ background: `${lastDayHex}1A`, borderColor: `${lastDayHex}4D`, color: lastDayHex }}>
            {lastBadge}
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2 text-xs text-gray-400 tabular-nums">
              <span class="font-semibold uppercase tracking-wider">Último entreno</span>
              <span>· {lastS ? fmtDate(lastS.date) : `Sin sesiones${hasFilter ? ` (${bounds.label})` : ''}`}</span>
            </div>
            <p class="flex flex-wrap items-baseline gap-x-1.5 text-lg sm:text-xl font-extrabold text-white">
              <span>{lastS ? (lastS.day ?? 'Sesión') : '—'}</span>
              <span class="text-xs sm:text-sm font-normal text-gray-400 tabular-nums">
                · {activeDays} días activos ({r1(activeDays / weeks)}/sem){phase ? ` · ${phase.name}` : ''}{lastS?.durMin ? ` · ${Math.round(lastS.durMin)} min` : ''}{lastS?.avgHr ? ` · ${lastS.avgHr} lpm` : ''}
              </span>
            </p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="btn-primary min-h-[44px] px-4 py-2 text-xs sm:text-sm" onClick={onStartWorkout}>
            <Icon name="play" className="h-3.5 w-3.5" /> Iniciar entreno
          </button>
          <button type="button" class="btn min-h-[44px] px-3 py-2 text-xs sm:text-sm" onClick={onGoLog}>
            <Icon name="edit" className="h-3.5 w-3.5" /> Registrar hecho
          </button>
        </div>
      </div>

      <div class="pt-3 border-t border-white/10 space-y-4">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 text-xs">
          <div class="min-w-0">
            <span class="text-gray-400 block">Peso</span>
            <div class="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
              <span class="whitespace-nowrap tabular-nums text-base sm:text-lg font-extrabold text-white">{mWeight.val != null ? `${r1(mWeight.val)} kg` : '—'}</span>
              {wDelta ? <span class={`whitespace-nowrap tabular-nums font-semibold ${wDeltaCls}`}>{wDelta}</span> : mWeight.date ? <span class="whitespace-nowrap tabular-nums text-gray-400">{short(mWeight.date)}</span> : null}
            </div>
          </div>
          <div class="min-w-0">
            <span class="text-gray-400 block">% Grasa</span>
            <div class="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
              <span class="whitespace-nowrap tabular-nums text-base sm:text-lg font-extrabold text-amberGold">{mBf.val != null ? `${r1(mBf.val)}%` : '—'}</span>
              {bfDelta ? <span class="whitespace-nowrap tabular-nums text-gray-400">{bfDelta}</span> : mBf.date ? <span class="whitespace-nowrap tabular-nums text-gray-400">{short(mBf.date)}</span> : null}
            </div>
          </div>
          <div class="min-w-0">
            <span class="text-gray-400 block">Músculo / Cintura</span>
            <div class="mt-0.5 flex flex-wrap items-baseline gap-x-1">
              <span class="whitespace-nowrap tabular-nums text-base sm:text-lg font-extrabold text-emeraldGreen">{mMuscle.val != null ? `${r1(mMuscle.val)} kg` : '—'}</span>
              <span class="whitespace-nowrap tabular-nums text-sm font-semibold text-gray-300">/ {mWaist.val != null ? `${r1(mWaist.val)} cm` : '—'}</span>
            </div>
          </div>
          <div class="min-w-0">
            <span class="text-gray-400 block truncate">{fourthMetric.lbl}</span>
            <div class="mt-0.5 flex flex-wrap items-baseline gap-x-1">
              <span class={`whitespace-nowrap tabular-nums text-base sm:text-lg font-extrabold ${fourthMetric.cls}`}>{fourthMetric.val}</span>
              {fourthMetric.sub && <span class="whitespace-nowrap tabular-nums text-xs sm:text-sm text-gray-300">{fourthMetric.sub}</span>}
            </div>
          </div>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
          <span class="text-xs font-medium text-gray-400">Periodo de análisis</span>
          <RangePicker
            scope="home"
            active={bounds.key}
            custom={customRange}
            onSelectRange={onSelectRange}
            onChangeFrom={onChangeFrom}
            onChangeTo={onChangeTo}
          />
        </div>
      </div>
    </section>
  );
}
