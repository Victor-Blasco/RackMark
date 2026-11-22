import { norm } from '../../lib/seed';
import { useAppStore } from '../../store/appStore';
import { homeExercises } from '../../store/homeChartConfigs';
import { resolveActiveModal } from '../../store/types';
import { routineNames, type State } from '../../ui/shared';
import { AddRoutineExerciseModal } from './AddRoutineExerciseModal';
import { ConfirmModal } from './ConfirmModal';
import { ExerciseModal } from './ExerciseModal';
import { NoteModal } from './NoteModal';
import { RoutineModal } from './RoutineModal';
import { WizardModal } from './WizardModal';
import { WorkoutSummaryModal } from './WorkoutSummaryModal';

interface ModalHostProps {
  /** Estado explícito opcional (útil en `renderToString` durante tests). */
  state?: State;
}

/**
 * Renderiza declarativamente todos los modales definidos en `ActiveModal`.
 */
export function ModalHost({ state: propState }: ModalHostProps) {
  const store = useAppStore();
  const state = propState ?? store.state;
  const modal = resolveActiveModal(state);
  if (!modal) return null;

  switch (modal.type) {
    case 'confirm':
      return (
        <ConfirmModal
          title={modal.title}
          message={modal.message}
          confirmLabel={modal.confirmLabel}
          danger={modal.danger}
          onConfirm={() => {
            modal.onConfirm?.();
            store.resolveConfirm(true);
          }}
          onCancel={() => store.resolveConfirm(false)}
        />
      );
    case 'note':
      return (
        <NoteModal
          exName={modal.exName}
          value={modal.value}
          onSave={(val) => store.saveNoteModal(modal.exName, val)}
          onClose={store.closeModal}
        />
      );
    case 'workoutSummary':
      return <WorkoutSummaryModal summary={modal.summary} onClose={store.closeWorkoutSummary} />;
    case 'wizard':
      return (
        <WizardModal
          draft={modal.draft}
          onboardingCompleted={state.settings.onboardingCompleted}
          onPatch={store.wizard.updateDraft}
          onBack={store.wizard.back}
          onSubmitStep={store.wizard.submitStep}
          onSkip={store.wizard.skip}
        />
      );
    case 'routine':
      return (
        <RoutineModal
          mode={modal.mode}
          initialName={modal.name}
          initialSub={modal.sub}
          initialColor={modal.color}
          onSave={store.plan.saveRoutineModal}
          onClose={store.closeModal}
        />
      );
    case 'exercise':
      return (
        <ExerciseModal
          routines={routineNames(state.settings)}
          defaultRoutine={modal.routine ?? ''}
          initialName={modal.initialName}
          fromLog={modal.fromLog}
          onSave={store.plan.saveExerciseModal}
          onClose={store.closeModal}
        />
      );
    case 'routineExercisePicker': {
      const idx = modal.replaceRowIdx;
      return (
        <AddRoutineExerciseModal
          state={state}
          routine={modal.routine}
          title={idx != null ? `Cambiar ejercicio en ${modal.routine}` : undefined}
          addLabel={idx != null ? 'Elegir' : undefined}
          onAdd={idx != null
            ? async (r, name) => { await store.plan.changeRoutineExName(r, idx, name); store.closeModal(); }
            : store.plan.quickAddToRoutine}
          onRemove={idx != null ? undefined : store.plan.removeRoutineExByName}
          onCreateExercise={(r, initialName) => store.plan.openExerciseModal({ routine: r, rowIdx: idx, initialName })}
          onClose={store.closeModal}
        />
      );
    }
    case 'logExercisePicker': {
      const draftEx = state.logDraft?.exercises ?? [];
      return (
        <AddRoutineExerciseModal
          state={state}
          routine={state.logDraft?.day ?? 'Libre'}
          title="Añadir ejercicio a la sesión"
          countLabel={`${draftEx.length} ${draftEx.length === 1 ? 'ejercicio' : 'ejercicios'} en sesión`}
          existingNames={draftEx.map((e) => e.name)}
          onAdd={(_r, name) => store.log.addExerciseByName(name)}
          onRemove={(_r, name) => {
            const idx = draftEx.findIndex((e) => norm(e.name) === norm(name));
            if (idx >= 0) store.log.removeExercise(idx);
          }}
          onCreateExercise={(_r, initialName) => store.plan.openExerciseModal({ fromLog: true, initialName })}
          onClose={store.closeModal}
        />
      );
    }
    case 'homeExercisePicker': {
      const names = homeExercises(state).map((e) => e.name);
      const cur = state.sel.home && state.analysis.exercises.has(state.sel.home) ? state.sel.home : names[0];
      return (
        <AddRoutineExerciseModal
          state={state}
          routine="home"
          title="Elegir ejercicio para gráfica"
          countLabel={`${names.length} ${names.length === 1 ? 'ejercicio disponible' : 'ejercicios disponibles'}`}
          candidates={names}
          existingNames={cur ? [cur] : []}
          addLabel="Elegir"
          addedLabel="Actual"
          onAdd={(_r, name) => { store.plan.selectHomeEx(name); store.closeModal(); }}
          onClose={store.closeModal}
        />
      );
    }
  }
}
