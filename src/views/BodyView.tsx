import { useMemo } from 'preact/hooks';
import { AiInsightBanner } from '../components/common/AiInsightBanner';
import { RangePicker } from '../components/common/RangePicker';
import { BodyChartsSection } from '../components/body/BodyChartsSection';
import { MeasureForm } from '../components/body/MeasureForm';
import { MeasuresHistoryTable } from '../components/body/MeasuresHistoryTable';
import { useAppStore } from '../store/appStore';
import { buildBodyViewModel, buildCompChartConfig, buildPerimChartConfig } from '../store/bodySelectors';
import type { State } from '../ui/shared';

interface BodyViewProps {
  /** Estado explícito opcional para renderizado SSR aislado en tests. */
  state?: State;
}

/**
 * Vista `Cuerpo y medidas`: composición corporal, perímetros, formulario incremental e historial.
 */
export function BodyView({ state: propState }: BodyViewProps) {
  const { state: storeState, plan, analytics } = useAppStore();
  const state = propState ?? storeState;
  const vm = buildBodyViewModel(state);

  const compCfg = useMemo(
    () => buildCompChartConfig(vm.msInRange, vm.activeCompMode, state.measures),
    [state.measures, vm.bounds.from, vm.bounds.to, vm.activeCompMode],
  );
  const perimCfg = useMemo(
    () => buildPerimChartConfig(state, vm.msInRange),
    [state.measures, vm.bounds.from, vm.bounds.to, state.perimeter],
  );

  return (
    <div class="space-y-5">
      <div class="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div>
          <h1 class="text-lg font-extrabold text-white">Cuerpo y medidas</h1>
          <p class="text-xs text-gray-400">
            Peso con media móvil de 7 días, composición corporal y perímetros{vm.hasFilter ? ` · ${vm.bounds.label}` : ''}.
          </p>
        </div>
        <RangePicker
          scope="body"
          active={vm.bounds.key}
          custom={state.customRanges?.body}
          onSelectRange={(key) => plan.setRange('body', key)}
          onChangeFrom={(val) => plan.setCustomRangeDate('body', 'from', val)}
          onChangeTo={(val) => plan.setCustomRangeDate('body', 'to', val)}
        />
      </div>

      <AiInsightBanner state={state} pattern={/composici|cuerpo|antropo/i} />

      <BodyChartsSection
        compCount={vm.compCount}
        hasCompWeight={vm.hasCompWeight}
        hasCompMuscle={vm.hasCompMuscle}
        activeCompMode={vm.activeCompMode}
        compCfg={compCfg}
        perimCfg={perimCfg}
        activePerimeter={state.perimeter}
        perimeterLabel={vm.pk.label}
        totalMeasures={vm.ms.length}
        hasFilter={vm.hasFilter}
        rangeLabel={vm.bounds.label}
        onChangeCompMode={analytics.setBodyMetric}
        onChangePerimeter={analytics.setPerimeter}
      />

      <MeasureForm
        activeDate={vm.activeDate}
        today={vm.today}
        currentEntry={vm.currentEntry}
        basicFields={vm.basicFields}
        perimOpen={vm.perimOpen}
        perimGroups={vm.perimGroups}
        noteValue={vm.noteValue}
        scrollSignal={state.measureScrollTs}
        getFieldInputMeta={vm.getFieldInputMeta}
        onChangeDate={analytics.setMeasureDate}
        onClearDate={analytics.clearMeasureDate}
        onTogglePerim={analytics.toggleMeasurePerim}
        onUpdateDraft={analytics.updateMeasureDraft}
        onSubmitMeasure={analytics.saveMeasure}
      />

      <MeasuresHistoryTable
        measuresDesc={vm.measuresDesc}
        totalMeasures={vm.ms.length}
        hasFilter={vm.hasFilter}
        rangeLabel={vm.bounds.label}
        tableCols={vm.tableCols}
        activeDate={vm.activeDate}
        onEditMeasure={analytics.editMeasure}
        onDeleteMeasure={(date) => void analytics.deleteMeasure(date)}
      />
    </div>
  );
}
