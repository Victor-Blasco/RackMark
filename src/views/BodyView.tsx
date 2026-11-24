import { useEffect, useMemo, useState } from 'preact/hooks';
import { AiInsightBanner } from '../components/common/AiInsightBanner';
import { RangePicker } from '../components/common/RangePicker';
import { ViewHeader } from '../components/common/ViewHeader';
import { BodyChartsSection } from '../components/body/BodyChartsSection';
import { MeasureForm } from '../components/body/MeasureForm';
import { MeasuresHistoryTable } from '../components/body/MeasuresHistoryTable';
import { useAppStore } from '../store/appStore';
import { buildBodyViewModel, buildCompChartConfig, buildPerimChartConfig } from '../store/bodySelectors';
import { short, type State } from '../ui/shared';

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
  const vm = useMemo(
    () => buildBodyViewModel(state),
    [state.measures, state.settings, state.ranges, state.customRanges, state.measureDate, state.measureDraft, state.measurePerimOpen, state.bodyMetric, state.perimeter],
  );
  const [formOpen, setFormOpen] = useState(() => vm.ms.length === 0 || Boolean(state.measureDate));

  useEffect(() => {
    if (vm.ms.length === 0 || state.measureDate || state.measureScrollTs) setFormOpen(true);
  }, [vm.ms.length, state.measureDate, state.measureScrollTs]);

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
      <ViewHeader
        title="Cuerpo y medidas"
        subtitle={`Peso con media móvil de 7 días, composición corporal y perímetros${vm.hasFilter ? ` · ${vm.bounds.label}` : ''}.`}
        right={
          <RangePicker
            active={vm.bounds.key}
            custom={state.customRanges?.body}
            onSelectRange={(key) => plan.setRange('body', key)}
            onChangeFrom={(val) => plan.setCustomRangeDate('body', 'from', val)}
            onChangeTo={(val) => plan.setCustomRangeDate('body', 'to', val)}
          />
        }
      />

      <AiInsightBanner state={state} pattern={/composici|cuerpo|antropo/i} />

      {vm.ms.length > 0 && !formOpen ? (
        <div class="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-white/10">
          <p class="text-xs text-gray-400">
            Último registro: <span class="font-semibold text-gray-200">{short(vm.measuresDesc[0]?.date ?? '')}</span>
          </p>
          <button type="button" class="btn-primary min-h-[44px]" onClick={() => setFormOpen(true)}>
            + Registrar peso / medidas de hoy
          </button>
        </div>
      ) : (
        <div class="space-y-2">
          {vm.ms.length > 0 && (
            <div class="flex justify-end">
              <button
                type="button"
                class="min-h-[44px] sm:min-h-[34px] rounded-lg px-2 text-xs font-semibold text-gray-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue"
                onClick={() => setFormOpen(false)}
              >
                Ocultar formulario
              </button>
            </div>
          )}
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
        </div>
      )}

      <BodyChartsSection
        compCount={vm.compCount}
        hasCompWeight={vm.hasCompWeight}
        hasCompMuscle={vm.hasCompMuscle}
        activeCompMode={vm.activeCompMode}
        compVerdict={vm.compVerdict}
        hasAnyPerim={vm.hasAnyPerim}
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
