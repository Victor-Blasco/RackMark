import { useEffect, useRef, useState } from 'preact/hooks';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { Icon } from '../common/Icon';

interface NoteModalProps {
  /** Nombre del ejercicio cuya nota permanente se está editando. */
  exName: string;
  /** Contenido inicial guardado para el ejercicio. */
  value: string;
  /** Persiste el texto de la nota al enviar el formulario. */
  onSave: (note: string) => void | Promise<void>;
  /** Cierra el modal sin guardar cambios. */
  onClose: () => void;
}

/**
 * Modal de edición de la nota técnica permanente de un ejercicio (asiento, agarre, postura).
 */
export function NoteModal({ exName, value, onSave, onClose }: NoteModalProps) {
  const [draft, setDraft] = useState(value);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true, onClose);

  useEffect(() => {
    setDraft(value);
  }, [exName, value]);

  return (
    <div id="note-modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="noteModalTitle" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-black/80" data-act="closeModal" aria-hidden="true" onClick={onClose} />
      <form
        id="f-note-modal"
        class="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-modalDark p-5 shadow-2xl space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave(draft);
        }}
      >
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0">
            <h3 id="noteModalTitle" class="text-base font-extrabold text-white">Nota fija del ejercicio</h3>
            <p class="text-xs text-gray-400 truncate" title={exName}>{exName}</p>
          </div>
          <button type="button" data-act="closeModal" aria-label="Cerrar modal" class="icon-btn" onClick={onClose}>
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
        <label class="block">
          <span class="lbl">Ajustes de máquina, asiento, agarre o consejos de técnica</span>
          <textarea
            id="noteModalInput"
            class="inp min-h-[96px] resize-y"
            name="note"
            maxLength={400}
            value={draft}
            placeholder="Ej. Asiento en 4, agarre neutro, pausa 1s abajo…"
            onInput={(e) => setDraft(e.currentTarget.value)}
          />
        </label>
        <div class="flex items-center justify-end gap-2 border-t border-white/10 pt-3">
          <button type="button" class="btn" data-act="closeModal" onClick={onClose}>Cancelar</button>
          <button type="submit" class="btn-primary">
            <Icon name="save" className="h-4 w-4" /> Guardar nota
          </button>
        </div>
      </form>
    </div>
  );
}
