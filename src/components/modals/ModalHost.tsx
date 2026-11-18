import { useAppStore } from '../../store/appStore';
import { resolveActiveModal } from '../../store/types';
import type { State } from '../../ui/shared';
import { ConfirmModal } from './ConfirmModal';
import { NoteModal } from './NoteModal';
import { WorkoutSummaryModal } from './WorkoutSummaryModal';

interface ModalHostProps {
  /** Estado explícito opcional (útil en `renderToString` durante tests). */
  state?: State;
  /** Generador HTML temporal para modales pendientes del Bloque B. */
  renderLegacyModalHtml?: (state: State) => string;
}

/**
 * Renderiza declarativamente el modal activo definido por la unión discriminada `ActiveModal`.
 */
export function ModalHost({ state: propState, renderLegacyModalHtml }: ModalHostProps) {
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
    default: {
      const html = (renderLegacyModalHtml ?? store.renderLegacyModalHtml)?.(state) ?? '';
      return html ? <div data-legacy-modal="true" dangerouslySetInnerHTML={{ __html: html }} /> : null;
    }
  }
}
