import { AiCoachPanel } from '../components/home/AiCoachPanel';
import { NoDataCard } from '../components/common/AiInsightBanner';
import { HomeChartsSection } from '../components/home/HomeChartsSection';
import { HomeHeroStrip } from '../components/home/HomeHeroStrip';
import { LoadControlSection } from '../components/home/LoadControlSection';
import { OnboardingHome } from '../components/home/OnboardingHome';
import { buildHomeViewModel } from '../store/homeSelectors';
import { useAppStore } from '../store/appStore';
import type { State } from '../ui/shared';

interface HomeViewProps {
  /** Estado explícito opcional para renderizado SSR aislado en tests. */
  state?: State;
}

/**
 * Vista principal `Resumen`: muestra bienvenida en el Día 1 o KPIs, Coach IA, gráficas y control de cargas.
 */
export function HomeView({ state: propState }: HomeViewProps) {
  const { state: storeState, plan, cloudLogin, enterDemoMode, setTab } = useAppStore();
  const state = propState ?? storeState;
  const vm = buildHomeViewModel(state);

  if (vm.isOnboarding) {
    return (
      <OnboardingHome
        state={state}
        onOpenWizard={plan.openWizard}
        onStartWorkout={(d) => plan.startWorkout(d)}
        onGoLog={() => plan.openLog()}
        onNavigateTab={setTab}
        onEnterDemo={enterDemoMode}
      />
    );
  }

  return (
    <div class="space-y-6">
      {!state.strength.length && <NoDataCard onGoLog={() => plan.openLog()} onImportData={() => setTab('data')} />}

      <HomeHeroStrip
        vm={vm}
        customRange={state.customRanges?.home}
        hasActiveWorkout={Boolean(state.liveWorkout)}
        onStartWorkout={() => plan.startWorkout()}
        onGoLog={() => plan.openLog()}
        onSelectRange={(key) => plan.setRange('home', key)}
        onChangeFrom={(val) => plan.setCustomRangeDate('home', 'from', val)}
        onChangeTo={(val) => plan.setCustomRangeDate('home', 'to', val)}
      />

      <AiCoachPanel
        state={state}
        tone={vm.tone}
        onToneChange={(t) => void plan.setAiTone(t)}
        onSelectTab={plan.setAiTab}
        onGenerate={plan.runAi}
        onRetry={plan.retryAi}
        onDismiss={plan.dismissAi}
        onCloudLogin={cloudLogin}
      />

      <HomeChartsSection
        selectedEx={vm.cur}
        rangeLabel={vm.bounds.label}
        exVerdict={vm.exVerdict}
        bodyVerdict={vm.bodyVerdict}
        exChartCfg={vm.homeExCfg}
        bodyChartCfg={vm.bodyHomeCfg}
        onOpenPicker={plan.openHomeExercisePicker}
      />

      <LoadControlSection
        rows={vm.rows}
        onOpenDetail={plan.openExDetail}
        onGoLog={() => plan.openLog()}
      />
    </div>
  );
}
