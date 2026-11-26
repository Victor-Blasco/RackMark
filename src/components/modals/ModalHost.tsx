import { useAppStore } from '../../store/appStore';
import { resolveActiveModal } from '../../store/types';
import { routineNames, type State } from '../../ui/shared';
import { AuthModal } from './AuthModal';
import { ConfirmModal } from './ConfirmModal';
import { ExerciseModal } from './ExerciseModal';
import { ExercisePickerModals } from './ExercisePickerModals';
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
    case 'auth':
      return (
        <AuthModal
          initialMode={modal.mode}
          disabled={state.syncing}
          onGoogleLogin={store.dataSync.cloudLogin}
          onEmailLogin={store.dataSync.cloudEmailLogin}
          onEmailSignUp={store.dataSync.cloudEmailSignUp}
          onResetPassword={store.dataSync.cloudResetPassword}
          onClose={store.closeModal}
        />
      );
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
      return (
        <WorkoutSummaryModal
          summary={modal.summary}
          routineExNames={modal.summary.day !== 'Libre' ? (state.settings.routines[modal.summary.day] ?? []).map((r) => r.name) : []}
          onAddExtraToRoutine={(day, name, sets, reps) => void store.plan.quickAddToRoutine(day, name, sets, reps)}
          onClose={store.closeWorkoutSummary}
        />
      );
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
    default:
      return <ExercisePickerModals state={state} modal={modal} store={store} />;
  }
}
