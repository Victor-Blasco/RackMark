import { norm } from '../../lib/seed';
import type { AppStoreValue } from '../../store/appStore';
import { allExerciseNames } from '../../store/exerciseCatalog';
import { homeExercises } from '../../store/homeChartConfigs';
import type { ActiveModal } from '../../store/types';
import type { State } from '../../ui/shared';
import { AddRoutineExerciseModal } from './AddRoutineExerciseModal';

type PickerModal = Extract<
  ActiveModal,
  { type: 'routineExercisePicker' | 'logExercisePicker' | 'homeExercisePicker' | 'mergeExercisePicker' }
>;

interface ExercisePickerModalsProps {
  /** Estado global activo. */
  state: State;
  /** Variante del selector de ejercicios abierto en `ActiveModal`. */
  modal: PickerModal;
  /** Store principal para ejecutar las acciones de selección. */
  store: AppStoreValue;
}

/** Subcomponente que resuelve los 4 diálogos buscadores de ejercicios compartidos. */
export function ExercisePickerModals({ state, modal, store }: ExercisePickerModalsProps) {
  switch (modal.type) {
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
    case 'mergeExercisePicker': {
      const other = modal.slot === 'from' ? state.mergeTo : state.mergeFrom;
      const cur = modal.slot === 'from' ? state.mergeFrom : state.mergeTo;
      const known = [...new Set([...allExerciseNames(state), ...state.analysis.exercises.keys()])]
        .filter((n) => !other || norm(n) !== norm(other))
        .sort((a, b) => a.localeCompare(b, 'es'));
      return (
        <AddRoutineExerciseModal
          state={state}
          routine="merge"
          title={modal.slot === 'from' ? 'Elegir ejercicio origen a fusionar' : 'Elegir ejercicio destino'}
          countLabel={`${known.length} ejercicios disponibles`}
          candidates={known}
          existingNames={cur ? [cur] : []}
          addLabel="Elegir"
          addedLabel="Actual"
          onAdd={(_r, name) => { store.plan.selectMergeExercise(modal.slot, name); store.closeModal(); }}
          onClose={store.closeModal}
        />
      );
    }
  }
}
