import { PhaseAnalyticsPanel } from '../components/plan/PhaseAnalyticsPanel';
import { PlanExercisesTab } from '../components/plan/PlanExercisesTab';
import { PlanPhasesSection } from '../components/plan/PlanPhasesSection';
import { PlanRoutinesTab } from '../components/plan/PlanRoutinesTab';
import { useAppStore } from '../store/appStore';
import { allExerciseNames } from '../store/exerciseCatalog';
import type { PlanTab, State } from '../ui/shared';

interface PlanViewProps {
  /** Estado explícito opcional para renderizado SSR aislado en tests. */
  state?: State;
  /** Subvista forzada (`phases` o `exercises`) al entrar desde Análisis o Rutinas. */
  forcedTab?: PlanTab;
}

const HEADER_META: Record<PlanTab, { title: string; desc: string }> = {
  exercises: {
    title: 'Catálogo y músculos',
    desc: 'Gestiona los músculos del catálogo, fusiona variantes y resuelve ejercicios pendientes.',
  },
  phases: {
    title: 'Fases del bloque',
    desc: 'Analiza peso, constancia, volumen y fuerza por etapa de volumen, definición o mantenimiento.',
  },
  routines: {
    title: 'Editar rutina',
    desc: 'Ajusta series, repeticiones objetivo, descanso y orden de ejercicios.',
  },
};

/**
 * Vista compartida para Catálogo muscular, Fases del bloque y editor de rutinas.
 */
export function PlanView({ state: propState, forcedTab }: PlanViewProps) {
  const { state: storeState, lastRoutine, plan: actions, setTab } = useAppStore();
  const state = propState ?? storeState;
  const tab = forcedTab ?? state.planTab ?? 'exercises';
  const allNames = allExerciseNames(state);
  const meta = HEADER_META[tab];

  return (
    <div class="space-y-5">
      {tab === 'routines' && (
        <div class="flex items-center justify-between gap-2 pb-2 border-b border-white/10 lg:border-b-0 lg:pb-0">
          <button
            type="button"
            class="inline-flex min-h-[44px] sm:min-h-[34px] items-center rounded-lg px-2 text-xs font-semibold text-gray-300 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue"
            onClick={() => setTab(lastRoutine)}
          >
            ← Volver a rutinas
          </button>
        </div>
      )}

      <div class="sr-only lg:not-sr-only lg:block pb-4 border-b border-white/10">
        <h1 class="text-lg font-extrabold text-white">{meta.title}</h1>
        <p class="text-xs text-gray-400">{meta.desc}</p>
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
