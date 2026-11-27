import { SegmentedControl } from '../components/common/SegmentedControl';
import { PhaseAnalyticsPanel } from '../components/plan/PhaseAnalyticsPanel';
import { PlanExercisesTab } from '../components/plan/PlanExercisesTab';
import { PlanPhasesSection } from '../components/plan/PlanPhasesSection';
import { PlanRoutinesTab } from '../components/plan/PlanRoutinesTab';
import { useAppStore } from '../store/appStore';
import { allExerciseNames } from '../store/exerciseCatalog';
import { PLAN_TABS } from '../store/navigation';
import type { State } from '../ui/shared';

interface PlanViewProps {
  /** Estado explícito opcional para renderizado SSR aislado en tests. */
  state?: State;
}

/**
 * Vista `Planificación`: catálogo muscular, mapeos y fases nutricionales y de entrenamiento.
 */
export function PlanView({ state: propState }: PlanViewProps) {
  const { state: storeState, lastRoutine, plan: actions, setTab } = useAppStore();
  const state = propState ?? storeState;
  const tab = state.planTab ?? 'exercises';
  const allNames = allExerciseNames(state);
  const unmappedCount = state.analysis.unmapped.length;

  const planTabOptions = PLAN_TABS.map((t) => ({
    id: t.id,
    label: t.shortLabel,
    badge: t.id === 'exercises' && unmappedCount > 0 ? (
      <span class="rounded-full bg-amberGold/20 px-1.5 py-0.5 tabular-nums text-[11px] font-bold text-amberGold">{unmappedCount}</span>
    ) : undefined,
  }));

  return (
    <div class="space-y-5">
      <div class="flex items-center justify-between gap-2 pb-2 border-b border-white/10 lg:border-b-0 lg:pb-0">
        <button
          type="button"
          class="inline-flex min-h-[44px] sm:min-h-[34px] items-center rounded-lg px-2 text-xs font-semibold text-gray-300 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue"
          onClick={() => setTab(lastRoutine)}
        >
          ← Volver a rutinas
        </button>
      </div>

      <div class="sr-only lg:not-sr-only lg:flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div>
          <h1 class="text-lg font-extrabold text-white">Planificación</h1>
          <p class="text-xs text-gray-400">Gestiona los músculos del catálogo, resuelve mapeos pendientes y define las fases del bloque.</p>
        </div>
        <SegmentedControl
          role="tablist"
          options={planTabOptions}
          value={tab}
          ariaLabel="Secciones de planificación"
          className="inline-flex rounded-xl border border-white/10 bg-gray-900/70 p-1 gap-1"
          buttonClassName="min-h-[44px] sm:min-h-[34px] px-3 py-1.5 text-xs"
          onChange={actions.setPlanTab}
        />
      </div>

      {tab === 'exercises' ? (
        <PlanExercisesTab state={state} allNames={allNames} actions={actions} />
      ) : tab === 'phases' ? (
        <div class="space-y-6">
          <PhaseAnalyticsPanel state={state} />
          <div class="pt-4 border-t border-white/10">
            <PlanPhasesSection phases={state.settings.phases} onAddPhase={actions.addPhase} onDeletePhase={actions.deletePhase} />
          </div>
        </div>
      ) : (
        <PlanRoutinesTab state={state} actions={actions} onOpenRoutineTab={setTab} />
      )}
    </div>
  );
}
