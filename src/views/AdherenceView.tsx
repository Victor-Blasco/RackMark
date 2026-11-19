import { AdherenceCalendar, CardioSessionsTable } from '../components/adherence/AdherenceSections';
import { AiInsightBanner, NoDataCard } from '../components/common/AiInsightBanner';
import { ChartCanvas } from '../components/common/ChartCanvas';
import { RangePicker } from '../components/common/RangePicker';
import { buildAdherenceViewModel } from '../store/adherenceSelectors';
import { useAppStore } from '../store/appStore';
import { r1, routineShort, type State } from '../ui/shared';

interface AdherenceViewProps {
  /** Estado explícito opcional para renderizado SSR aislado en tests. */
  state?: State;
}

/**
 * Vista `Adherencia y bienestar`: constancia semanal, cardio, sueño, HRV y pasos diarios.
 */
export function AdherenceView({ state: propState }: AdherenceViewProps) {
  const { state: storeState, plan, setTab } = useAppStore();
  const state = propState ?? storeState;
  const vm = buildAdherenceViewModel(state);

  if (vm.isEmpty) {
    return <NoDataCard onGoLog={() => plan.openLog()} onImportData={() => setTab('data')} />;
  }

  return (
    <div class="space-y-5">
      {!vm.hasStrength && <NoDataCard onGoLog={() => plan.openLog()} onImportData={() => setTab('data')} />}

      <div class="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div>
          <h1 class="text-lg font-extrabold text-white">Adherencia y bienestar</h1>
          <p class="text-xs text-gray-400">Constancia semanal, cardio, sueño y actividad diaria ({vm.bounds.label}).</p>
        </div>
        <RangePicker
          scope="adherence"
          active={vm.bounds.key}
          custom={state.customRanges?.adherence}
          onSelectRange={(key) => plan.setRange('adherence', key)}
          onChangeFrom={(val) => plan.setCustomRangeDate('adherence', 'from', val)}
          onChangeTo={(val) => plan.setCustomRangeDate('adherence', 'to', val)}
        />
      </div>

      <AiInsightBanner state={state} pattern={/recuperaci|sueñ|suen|neat|card/i} />

      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4 pb-5 border-b border-white/10">
        <div>
          <span class="block text-xs text-gray-400">Media semanal ({vm.bounds.label})</span>
          <span class="tabular-nums text-xl font-extrabold text-white">{r1(vm.avg)}</span>
          <span class="block text-xs text-gray-400">días entrenados</span>
        </div>
        <div>
          <span class="block text-xs text-gray-400">Racha ≥3 días/sem.</span>
          <span class="tabular-nums text-xl font-extrabold text-white">{vm.streak}</span>
          <span class="block text-xs text-gray-400">semanas completas</span>
        </div>
        <div>
          <span class="block text-xs text-gray-400">Reparto ({vm.bounds.label})</span>
          <span class="tabular-nums text-xl font-extrabold text-white">
            {vm.routines.map((r) => vm.counts[r] ?? 0).join('/')}
          </span>
          <span class="block text-xs text-gray-400">{vm.routines.map((r) => routineShort(r)).join(' / ')}</span>
        </div>
        <div>
          <span class="block text-xs text-gray-400">Cardio ({vm.bounds.label})</span>
          <span class="tabular-nums text-xl font-extrabold text-white">{vm.cardioCount}</span>
          <span class="block text-xs tabular-nums text-gray-400">
            {r1(vm.cardioDistKm)} km · {Math.round(vm.cardioDurMin)} min
          </span>
        </div>
      </div>

      <AdherenceCalendar
        cols={vm.cols}
        mobCols={vm.mobCols}
        routines={vm.routines}
        settings={state.settings}
        buildCell={vm.buildCell}
      />

      {(vm.sleepChartCfg || vm.stepsChartCfg) && (
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2 pb-5 border-b border-white/10">
          {vm.sleepChartCfg && (
            <div class="min-w-0 space-y-2">
              <h3 class="mb-2 font-bold text-white">Sueño y recuperación · HRV ({vm.bounds.label})</h3>
              <div class="chart-box"><ChartCanvas id="c-well-sleep" config={vm.sleepChartCfg} /></div>
            </div>
          )}
          {vm.stepsChartCfg && (
            <div class="min-w-0 space-y-2">
              <h3 class="mb-2 font-bold text-white">Pasos diarios ({vm.bounds.label})</h3>
              <div class="chart-box"><ChartCanvas id="c-well-steps" config={vm.stepsChartCfg} /></div>
            </div>
          )}
        </div>
      )}

      <CardioSessionsTable totalCount={vm.cardioCount} recentCardio={vm.recentCardio} />
    </div>
  );
}
