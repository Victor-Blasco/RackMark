import { useState } from 'preact/hooks';
import { MUSCLES } from '../../lib/seed';
import { useAppStore } from '../../store/appStore';
import { plannedVolumeBreakdown, plannedWeeklyVolume } from '../../store/planSelectors';
import { volumeRangeForProfile } from '../../store/volumeSelectors';
import { routineNames, type State } from '../../ui/shared';
import { Collapsible } from '../common/Collapsible';
import { Icon } from '../common/Icon';
import { PlanVolumeFreqList } from './PlanVolumeFreqList';

interface PlanSidebarWidgetsProps {
  /** Estado global con rutinas y mapa muscular. */
  state: State;
  /** Si es `true`, omite el contenedor lateral de escritorio para embeberlo en línea. */
  inline?: boolean;
  /** Override opcional para tests aislados sin Provider. */
  onChangeFreq?: (day: string, freq: number) => void;
  /** Override opcional para abrir el catálogo de músculos. */
  onOpenCatalog?: () => void;
}

const fmtSets = (v: number): string => (v % 1 === 0 ? String(v) : v.toFixed(1).replace('.', ','));

/**
 * Panel lateral del editor de rutinas con simulador de volumen semanal, frecuencia y desglose por músculo.
 */
export function PlanSidebarWidgets({ state, inline = false, onChangeFreq, onOpenCatalog }: PlanSidebarWidgetsProps) {
  const { plan } = useAppStore();
  const [openMuscle, setOpenMuscle] = useState<string | null>(null);
  const s = state.settings;
  const routines = routineNames(s);
  const volMap = plannedWeeklyVolume(s);
  const { byMuscle, unmapped, totalWeeklySessions, totalPlannedSets } = plannedVolumeBreakdown(s);
  const { min: minSets, max: maxSets, isLightPlan } = volumeRangeForProfile(s.profile);

  const handleFreq = onChangeFreq ?? ((day: string, freq: number) => void plan.changeRoutineFreq(day, freq));
  const handleCatalog = onOpenCatalog ?? (() => plan.openPlanTab('exercises'));
  const unmappedPreview = unmapped.slice(0, 3).map((u) => u.exercise).join(', ');

  const card = (
    <div class="rounded-2xl border border-white/10 bg-cardDark p-4 space-y-3">
      <div class="flex items-baseline justify-between gap-2">
        <h3 class="text-sm font-bold text-white">Simulador de volumen semanal</h3>
        <span class="tabular-nums text-xs font-semibold text-gray-400">
          {totalWeeklySessions} d/sem · {totalPlannedSets} {totalPlannedSets === 1 ? 'serie' : 'series'}
        </span>
      </div>
      <p class="text-[11px] text-gray-400">
        Principal = 1 · Apoyo = 0,5 · <span class="text-coralRed">↓ &lt;{minSets}</span> · <span class="text-emeraldGreen">✓ {minSets}–{maxSets}</span> · <span class="text-amberGold">↑ &gt;{maxSets}</span>
        {isLightPlan && ' (plan ligero)'}. Toca un músculo para ver qué suma.
      </p>

      <PlanVolumeFreqList state={state} routines={routines} totalSessions={totalWeeklySessions} onChangeFreq={handleFreq} />

      {unmapped.length > 0 && (
        <div class="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2.5 text-xs text-amber-200">
          <p class="min-w-0 flex-1 leading-snug">
            {unmapped.length} {unmapped.length === 1 ? 'ejercicio sin músculo' : 'ejercicios sin músculo'} ({unmappedPreview}{unmapped.length > 3 ? '…' : ''}).
          </p>
          <button type="button" class="text-xs font-bold text-amberGold underline underline-offset-4 hover:text-amber-200 shrink-0" onClick={handleCatalog}>
            Asignar músculo
          </button>
        </div>
      )}

      <div class="space-y-1 border-t border-white/10 pt-2.5">
        {MUSCLES.map((m) => {
          const v = volMap.get(m) ?? 0;
          const items = byMuscle.get(m) ?? [];
          const isOpen = openMuscle === m;
          const textCol = v === 0 ? 'text-gray-400' : v < minSets ? 'text-coralRed' : v <= maxSets ? 'text-emeraldGreen' : 'text-amberGold';
          const barCol = v === 0 ? 'bg-white/10' : v < minSets ? 'bg-coralRed' : v <= maxSets ? 'bg-emeraldGreen' : 'bg-amberGold';
          const cue = v === 0 ? '' : v < minSets ? '↓ ' : v <= maxSets ? '✓ ' : '↑ ';
          const srLabel = v === 0 ? ' sin series' : v < minSets ? ' volumen bajo' : v <= maxSets ? ' volumen óptimo' : ' volumen alto';
          const pct = Math.min(100, Math.round((v / (maxSets + 2)) * 100));

          return (
            <div key={m}>
              <button
                type="button"
                aria-expanded={isOpen ? 'true' : 'false'}
                class="grid w-full min-h-[36px] sm:min-h-[28px] grid-cols-[96px_1fr_auto] items-center gap-2 rounded-lg px-1 -mx-1 text-left text-xs hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue"
                onClick={() => setOpenMuscle(isOpen ? null : m)}
              >
                <span class="truncate text-gray-200">{m}</span>
                <div class="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <div class={`h-full rounded-full ${barCol}`} style={{ width: `${pct}%` }} />
                </div>
                <span class="inline-flex items-center gap-1 tabular-nums font-bold">
                  <span class={textCol}>{cue}{fmtSets(v)}<span class="sr-only">{srLabel}</span></span>
                  <Icon name="caretDown" className={`h-3 w-3 text-gray-400 transition-transform duration-200 motion-reduce:transition-none ${isOpen ? 'rotate-180' : ''}`} />
                </span>
              </button>
              <Collapsible open={isOpen}>
                <div class="mb-1.5 mt-0.5 space-y-1 border-l border-white/10 pl-2.5 text-[11px] text-gray-300">
                  {items.length === 0 ? (
                    <p class="py-0.5 text-gray-400">Ningún ejercicio activo suma a {m}.</p>
                  ) : (
                    items.map((it, idx) => (
                      <div key={`${it.routine}-${it.exercise}-${idx}`} class="flex items-center justify-between gap-2">
                        <span class="min-w-0 truncate">
                          <span class="text-gray-400">{it.routine}{it.freq !== 1 ? ` (${it.freq}×)` : ''} ·</span>{' '}
                          {it.exercise}
                          {it.factor < 1 && <span class="text-gray-400"> · apoyo 0,5</span>}
                        </span>
                        <span class="shrink-0 tabular-nums font-semibold text-white">{fmtSets(it.effective)}</span>
                      </div>
                    ))
                  )}
                </div>
              </Collapsible>
            </div>
          );
        })}
      </div>
    </div>
  );

  return inline ? card : <aside class="lg:col-span-4 lg:sticky lg:top-6">{card}</aside>;
}
