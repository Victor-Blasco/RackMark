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
 * Vista `Planificación`: edita rutinas de una en una, catálogo muscular y fases del bloque.
 */
export function PlanView({ state: propState }: PlanViewProps) {
  const { state: storeState, plan: actions, setTab } = useAppStore();
  const state = propState ?? storeState;
  const tab = state.planTab ?? 'routines';
  const allNames = allExerciseNames(state);
  const knownNames = [...new Set([...allNames, ...state.analysis.exercises.keys()])].sort((a, b) => a.localeCompare(b, 'es'));
  const unmappedCount = state.analysis.unmapped.length;

  return (
    <div class="space-y-5">
      <div class="hidden lg:flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div>
          <h1 class="text-lg font-extrabold text-white">Planificación</h1>
          <p class="text-xs text-gray-400">Edita tus rutinas de una en una, gestiona los músculos del catálogo y define las fases del bloque.</p>
        </div>
        <div role="tablist" aria-label="Secciones de planificación" class="inline-flex rounded-xl border border-white/10 bg-gray-900/70 p-1 gap-1">
          {PLAN_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id ? 'true' : 'false'}
              class={`inline-flex min-h-[44px] sm:min-h-[34px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${tab === t.id ? 'bg-electricBlue text-white' : 'text-gray-400 hover:text-white'}`}
              onClick={() => actions.setPlanTab(t.id)}
            >
              <span>{t.shortLabel}</span>
              {t.id === 'exercises' && unmappedCount > 0 && (
                <span class="rounded-full bg-amberGold/20 px-1.5 py-0.5 tabular-nums text-[11px] font-bold text-amberGold">{unmappedCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === 'exercises' ? (
        <PlanExercisesTab state={state} allNames={allNames} knownNames={knownNames} actions={actions} />
      ) : tab === 'phases' ? (
        <PlanPhasesSection phases={state.settings.phases} onAddPhase={actions.addPhase} onDeletePhase={actions.deletePhase} />
      ) : (
        <PlanRoutinesTab state={state} allNames={allNames} actions={actions} onOpenRoutineTab={setTab} />
      )}
    </div>
  );
}
