import { MUSCLES } from '../../lib/seed';
import { plannedWeeklyVolume } from '../../store/planSelectors';
import { volumeRangeForProfile } from '../../store/volumeSelectors';
import { routineNames, type State } from '../../ui/shared';

interface PlanSidebarWidgetsProps {
  /** Estado global con rutinas y mapa muscular. */
  state: State;
  /** Si es `true`, omite el contenedor lateral de escritorio para embeberlo en línea. */
  inline?: boolean;
}

/**
 * Panel lateral del editor de rutinas con el simulador de volumen semanal por músculo.
 */
export function PlanSidebarWidgets({ state, inline = false }: PlanSidebarWidgetsProps) {
  const s = state.settings;
  const routines = routineNames(s);
  const volMap = plannedWeeklyVolume(s);
  const totalPlannedSets = routines.reduce(
    (acc, d) => acc + (s.routines[d] ?? []).reduce((sum, item) => sum + (item.name ? item.sets : 0), 0),
    0,
  );
  const { min: minSets, max: maxSets, isLightPlan } = volumeRangeForProfile(s.profile);

  const card = (
    <div class="rounded-2xl border border-white/10 bg-cardDark p-4 space-y-3">
      <div class="flex items-baseline justify-between gap-2">
        <h3 class="text-sm font-bold text-white">Simulador de volumen semanal</h3>
        <span class="tabular-nums text-xs font-semibold text-gray-400">
          {totalPlannedSets} {totalPlannedSets === 1 ? 'serie' : 'series'}
        </span>
      </div>
      <p class="text-[11px] text-gray-400">
        Principal = 1 · Apoyo = 0,5 · <span class="text-coralRed">↓ &lt;{minSets}</span> · <span class="text-emeraldGreen">✓ {minSets}–{maxSets}</span> · <span class="text-amberGold">↑ &gt;{maxSets}</span>
        {isLightPlan && ' (plan ligero)'}
      </p>
      <div class="space-y-1.5">
        {MUSCLES.map((m) => {
          const v = volMap.get(m) ?? 0;
          const labelV = v % 1 === 0 ? String(v) : v.toFixed(1).replace('.', ',');
          const textCol = v === 0 ? 'text-gray-400' : v < minSets ? 'text-coralRed' : v <= maxSets ? 'text-emeraldGreen' : 'text-amberGold';
          const barCol = v === 0 ? 'bg-white/10' : v < minSets ? 'bg-coralRed' : v <= maxSets ? 'bg-emeraldGreen' : 'bg-amberGold';
          const cue = v === 0 ? '' : v < minSets ? '↓ ' : v <= maxSets ? '✓ ' : '↑ ';
          const srLabel = v === 0 ? ' sin series' : v < minSets ? ' volumen bajo' : v <= maxSets ? ' volumen óptimo' : ' volumen alto';
          const pct = Math.min(100, Math.round((v / (maxSets + 2)) * 100));
          return (
            <div key={m} class="grid grid-cols-[96px_1fr_54px] items-center gap-2 text-xs">
              <span class="truncate text-gray-200">{m}</span>
              <div class="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div class={`h-full rounded-full ${barCol}`} style={{ width: `${pct}%` }} />
              </div>
              <span class={`text-right tabular-nums font-bold ${textCol}`}>
                {cue}{labelV}<span class="sr-only">{srLabel}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  return inline ? card : <aside class="lg:col-span-4 lg:sticky lg:top-6">{card}</aside>;
}
