import { PlanExercisesTab } from '../components/plan/PlanExercisesTab';
import { PlanRoutinesTab } from '../components/plan/PlanRoutinesTab';
import { useAppStore } from '../store/appStore';
import { allExerciseNames } from '../store/exerciseCatalog';
import type { State } from '../ui/shared';

interface PlanViewProps {
  /** Estado explícito opcional para renderizado SSR aislado en tests. */
  state?: State;
}

/**
 * Vista `Plan y rutinas`: edita días, objetivos de volumen, fases y mapa muscular.
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
      <div class="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div>
          <h2 class="text-lg font-extrabold text-white">Planificación y catálogo</h2>
          <p class="text-xs text-gray-400">Crea tus propias rutinas o usa una plantilla, define fases del bloque y gestiona los ejercicios.</p>
        </div>
        <div role="tablist" aria-label="Secciones de planificación" class="inline-flex rounded-xl border border-white/10 bg-gray-900/70 p-1 gap-1">
          <button type="button" role="tab" aria-selected={tab === 'routines' ? 'true' : 'false'} data-act="planTab" data-arg="routines" class={`inline-flex min-h-[44px] sm:min-h-[34px] items-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${tab === 'routines' ? 'bg-electricBlue text-white' : 'text-gray-400 hover:text-white'}`} onClick={() => actions.setPlanTab('routines')}>
            Rutinas y fases
          </button>
          <button type="button" role="tab" aria-selected={tab === 'exercises' ? 'true' : 'false'} data-act="planTab" data-arg="exercises" class={`inline-flex min-h-[44px] sm:min-h-[34px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${tab === 'exercises' ? 'bg-electricBlue text-white' : 'text-gray-400 hover:text-white'}`} onClick={() => actions.setPlanTab('exercises')}>
            <span>Ejercicios y músculos</span>
            {unmappedCount > 0 && <span class="rounded-full bg-amberGold/20 px-1.5 py-0.5 tabular-nums text-[11px] font-bold text-amberGold">{unmappedCount}</span>}
          </button>
        </div>
      </div>

      {tab === 'exercises' ? (
        <PlanExercisesTab state={state} allNames={allNames} knownNames={knownNames} actions={actions} />
      ) : (
        <PlanRoutinesTab state={state} allNames={allNames} actions={actions} onOpenRoutineTab={setTab} />
      )}
    </div>
  );
}
