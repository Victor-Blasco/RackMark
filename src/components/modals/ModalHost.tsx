import { useAppStore } from '../../store/appStore';
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
    case 'routineExercisePicker':
      return (
        <AddRoutineExerciseModal
          state={state}
          routine={modal.routine}
          onAdd={store.plan.quickAddToRoutine}
          onRemove={store.plan.removeRoutineExByName}
          onCreateExercise={(r, initialName) => store.plan.openExerciseModal({ routine: r, initialName })}
          onClose={store.closeModal}
        />
      );
  }
}
