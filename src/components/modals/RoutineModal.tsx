import { useEffect, useRef, useState } from 'preact/hooks';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { ROUTINE_COLORS } from '../../lib/seed';
import type { SaveRoutinePayload } from '../../store/planActions';
import { Icon } from '../common/Icon';

interface RoutineModalProps {
  /** Modo de operación: crear nueva rutina o editar una existente. */
  mode: 'create' | 'edit';
  /** Nombre inicial mostrado en el campo de texto. */
  initialName: string;
  /** Subtítulo opcional inicial. */
  initialSub: string;
  /** Color hexadecimal identificativo seleccionado. */
  initialColor: string;
  /** Persiste la creación o actualización de la rutina. */
  onSave: (payload: SaveRoutinePayload) => void | Promise<void>;
  /** Cierra el modal sin guardar cambios. */
  onClose: () => void;
}

/**
 * Modal de creación y edición de nombre, subtítulo y color de una rutina.
 */
export function RoutineModal({
  mode,
  initialName,
  initialSub,
  initialColor,
  onSave,
  onClose,
}: RoutineModalProps) {
  const [name, setName] = useState(initialName);
  const [sub, setSub] = useState(initialSub);
  const [color, setColor] = useState(initialColor);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true, onClose);

  useEffect(() => {
    setName(initialName);
    setSub(initialSub);
    setColor(initialColor);
  }, [mode, initialName, initialSub, initialColor]);

  const isEdit = mode === 'edit';

  return (
    <div id="rt-modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="rtModalTitle" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-black/80" data-act="closeModal" aria-hidden="true" onClick={onClose} />
      <form
        id="f-routine-meta"
        class="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-modalDark p-5 shadow-2xl space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave({ name, sub, color });
        }}
      >
        <div class="flex items-center justify-between gap-2">
          <div>
            <h3 id="rtModalTitle" class="text-base font-extrabold text-white">{isEdit ? 'Editar rutina' : 'Nueva rutina personalizada'}</h3>
            <p class="text-xs text-gray-400">
              {isEdit ? 'Cambia el nombre, subtítulo o color identificativo.' : 'Crea un día o bloque propio (ej. Torso A, Full Body, Brazo…).'}
            </p>
          </div>
          <button type="button" data-act="closeModal" aria-label="Cerrar modal" class="icon-btn" onClick={onClose}>
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        <label class="block">
          <span class="lbl">Nombre de la rutina</span>
          <input id="rtModalName" class="inp" name="name" maxLength={40} value={name} placeholder="Ej. Torso A" required onInput={(e) => setName(e.currentTarget.value)} />
        </label>

        <label class="block">
          <span class="lbl">Subtítulo corto (opcional)</span>
          <input class="inp" name="sub" maxLength={40} value={sub} placeholder="Ej. Empuje, Fuerza, Cadena post." onInput={(e) => setSub(e.currentTarget.value)} />
        </label>

        <fieldset class="space-y-2">
          <legend class="lbl">Color</legend>
          <div class="flex flex-wrap gap-1.5 sm:gap-2.5">
            {ROUTINE_COLORS.map((c) => (
              <label key={c} class="inline-flex h-11 w-11 sm:h-8 sm:w-8 cursor-pointer items-center justify-center rounded-full">
                <input type="radio" name="color" value={c} checked={c === color} class="sr-only peer" onChange={() => setColor(c)} />
                <span class="block h-7 w-7 rounded-full border border-white/20 transition-transform peer-checked:scale-110 peer-checked:ring-2 peer-checked:ring-white peer-checked:ring-offset-2 peer-checked:ring-offset-modalDark" style={{ background: c }} />
              </label>
            ))}
          </div>
        </fieldset>

        <div class="flex items-center justify-end gap-2 border-t border-white/10 pt-3">
          <button type="button" class="btn" data-act="closeModal" onClick={onClose}>Cancelar</button>
          <button type="submit" class="btn-primary">
            <Icon name="save" className="h-4 w-4" /> {isEdit ? 'Guardar cambios' : 'Crear rutina'}
          </button>
        </div>
      </form>
    </div>
  );
}
