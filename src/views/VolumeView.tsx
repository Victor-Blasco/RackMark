import { useEffect, useRef } from 'preact/hooks';
import { AiInsightBanner, NoDataCard } from '../components/common/AiInsightBanner';
import { ChartCanvas } from '../components/common/ChartCanvas';
import { RangePicker } from '../components/common/RangePicker';
import { useAppStore } from '../store/appStore';
import { buildVolumeViewModel } from '../store/volumeSelectors';
import { r1, short, type State } from '../ui/shared';

interface VolumeViewProps {
  /** Estado explícito opcional para renderizado SSR aislado en tests. */
  state?: State;
}

const MUSCLE_BTN_BASE =
  'inline-flex min-h-[44px] sm:min-h-0 items-center rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue';

function cellColor(v: number): string {
  if (v === 0) return 'text-gray-400';
  if (v < 8) return 'text-coralRed';
  if (v <= 20) return 'text-emeraldGreen';
  return 'text-amberGold';
}

/**
 * Vista `Volumen semanal`: series efectivas por músculo y tendencia histórica.
 */
export function VolumeView({ state: propState }: VolumeViewProps) {
  const { state: storeState, plan, analytics, setTab } = useAppStore();
  const state = propState ?? storeState;
  const vm = buildVolumeViewModel(state);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, [vm.weeks.length, vm.bounds.key, vm.bounds.from, vm.bounds.to]);

  if (!vm.hasStrength) {
    return <NoDataCard onGoLog={() => plan.openLog()} onImportData={() => setTab('data')} />;
  }

  return (
    <div class="space-y-5">
      <div class="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div>
          <h1 class="text-lg font-extrabold text-white">Volumen semanal</h1>
          <p class="text-xs text-gray-400">
            Series efectivas por grupo muscular · {vm.weeks.length} semanas ({vm.bounds.label}).
          </p>
        </div>
        <RangePicker
          active={vm.bounds.key}
          custom={state.customRanges?.volume}
          onSelectRange={(key) => plan.setRange('volume', key)}
          onChangeFrom={(val) => plan.setCustomRangeDate('volume', 'from', val)}
          onChangeTo={(val) => plan.setCustomRangeDate('volume', 'to', val)}
        />
      </div>

      <AiInsightBanner state={state} pattern={/rendimiento|fuerza|sobrecarga|ppl|volumen/i} />

      <div class="pb-5 border-b border-white/10 space-y-2">
        <h2 class="mb-1 font-bold text-white">Series efectivas por músculo y semana</h2>
        <p class="mb-2 text-xs text-gray-400">
          Músculo principal = 1 serie, secundario = 0,5. <span class="text-coralRed">&lt;8↓ bajo</span> ·{' '}
          <span class="text-emeraldGreen">8–20 óptimo</span> · <span class="text-amberGold">&gt;20↑ alto</span>. Toca un músculo para ver su tendencia.
          {vm.weeks.length > 5 && ` · Desliza para ver las ${vm.weeks.length} semanas.`}
        </p>
        <div
          ref={scrollRef}
          tabIndex={0}
          aria-label="Series efectivas por músculo y semana"
          class="relative overflow-x-auto pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue rounded-lg"
        >
          <table class="w-full text-center text-xs sm:text-sm border-collapse">
            <thead class="text-xs text-gray-400">
              <tr>
                <th scope="col" class="sticky left-0 z-10 bg-bgDark py-2 pr-3 text-left whitespace-nowrap border-r border-white/10">
                  Músculo
                </th>
                {vm.weeks.map((w) => (
                  <th key={w} scope="col" class="min-w-[3.25rem] sm:min-w-[3.75rem] px-2 py-2 tabular-nums font-medium whitespace-nowrap">
                    {short(w)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vm.muscles.map((m) => {
                const active = m === vm.sel;
                const activeCls = active
                  ? 'border-electricBlue bg-electricBlue/15 text-blue-300'
                  : 'border-white/10 bg-white/[0.03] text-gray-200 hover:border-white/25 hover:text-white';
                return (
                  <tr key={m} class="border-t border-gray-800">
                    <td class="sticky left-0 z-10 bg-bgDark py-2 pr-3 text-left whitespace-nowrap border-r border-white/10">
                      <button
                        type="button"
                        aria-pressed={active ? 'true' : 'false'}
                        class={`${MUSCLE_BTN_BASE} ${activeCls}`}
                        onClick={() => analytics.selectMuscle(m)}
                      >
                        {m}
                      </button>
                    </td>
                    {vm.weeks.map((w) => {
                      const v = vm.vol.get(m)?.get(w) ?? 0;
                      return (
                        <td key={w} class={`min-w-[3.25rem] sm:min-w-[3.75rem] px-2 tabular-nums font-bold whitespace-nowrap ${cellColor(v)}`}>
                          {v ? (
                            <>
                              {r1(v)}
                              {v < 8 && (
                                <>
                                  <span class="sr-only"> (bajo)</span>
                                  <span aria-hidden="true">↓</span>
                                </>
                              )}
                              {v > 20 && (
                                <>
                                  <span class="sr-only"> (alto)</span>
                                  <span aria-hidden="true">↑</span>
                                </>
                              )}
                            </>
                          ) : (
                            '·'
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div class="space-y-2">
        <h2 class="mb-2 font-bold text-white">Tendencia · {vm.sel}</h2>
        <div class="chart-box"><ChartCanvas id="c-vol" config={vm.volChartCfg} /></div>
      </div>
    </div>
  );
}
