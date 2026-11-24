import { Icon } from '../common/Icon';
import { ModalShell } from '../common/ModalShell';

interface ConfirmModalProps {
  /** Título breve de la confirmación. */
  title: string;
  /** Descripción detallada de la acción pendiente. */
  message: string;
  /** Texto del botón afirmativo. */
  confirmLabel?: string;
  /** Resalta el botón afirmativo como acción destructiva. */
  danger?: boolean;
  /** Se ejecuta al confirmar la acción. */
  onConfirm: () => void;
  /** Se ejecuta al cancelar o cerrar el diálogo. */
  onCancel: () => void;
}

/**
 * Diálogo modal accesible para confirmar acciones destructivas o cambios de sesión.
 */
export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirmar',
  danger,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <ModalShell
      id="confirm-modal"
      role="alertdialog"
      labelledBy="confirmModalTitle"
      describedBy="confirmModalDesc"
      onClose={onCancel}
    >
      <div class="flex items-start gap-3">
        {danger && (
          <div class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-coralRed/15 text-coralRed">
            <Icon name="warn" className="h-5 w-5" />
          </div>
        )}
        <div class="min-w-0 flex-1">
          <h3 id="confirmModalTitle" class="text-base font-extrabold text-white">{title}</h3>
          <p id="confirmModalDesc" class="mt-1 text-sm text-gray-300 leading-relaxed">{message}</p>
        </div>
      </div>
      <div class="flex justify-end gap-2 border-t border-white/10 pt-3">
        <button type="button" class="btn" onClick={onCancel}>Cancelar</button>
        <button type="button" class={danger ? 'btn btn-danger-solid' : 'btn-primary'} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}
