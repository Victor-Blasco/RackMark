import { AiCoachPanel } from '../components/home/AiCoachPanel';
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
  const { state: storeState, plan, setTab } = useAppStore();
  const state = propState ?? storeState;
  const vm = buildHomeViewModel(state);

  if (vm.isOnboarding) {
    return (
      <OnboardingHome
        state={state}
        onOpenWizard={plan.openWizard}
        onStartWorkout={(d) => plan.startWorkout(d)}
        onGoLog={() => plan.openLog()}
        onApplyTemplate={(k) => void plan.applyTemplate(k)}
        onNavigateTab={setTab}
      />
    );
  }

  return (
    <div class="space-y-6">
      {!state.strength.length && (
        <div class="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-gray-300">
          <p>Aún no hay entrenamientos guardados. Registra tu primera sesión o importa tus datos previos.</p>
          <div class="flex shrink-0 flex-wrap gap-2">
            <button type="button" class="btn-sm btn-accent" onClick={() => plan.openLog()}>+ Registrar entreno</button>
            <button type="button" class="btn-sm" onClick={() => setTab('data')}>Importar datos</button>
          </div>
        </div>
      )}

      <HomeHeroStrip
        vm={vm}
        customRange={state.customRanges?.home}
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
      />

      <HomeChartsSection
        selectedEx={vm.cur}
        rangeLabel={vm.bounds.label}
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
