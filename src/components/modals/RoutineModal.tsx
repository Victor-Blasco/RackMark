import { useEffect, useState } from 'preact/hooks';
import { ROUTINE_COLORS, ROUTINE_COLOR_NAMES } from '../../lib/seed';
import type { SaveRoutinePayload } from '../../store/planActions';
import { Icon } from '../common/Icon';
import { ModalShell } from '../common/ModalShell';

interface RoutineModalProps {
  /** Modo de operación: crear nueva rutina o editar una existente. */
  mode: 'create' | 'edit';
  /** Nombre inicial mostrado en el campo de texto. */
  initialName: string;
  /** Subtítulo opcional inicial. */
  initialSub: string;
  /** Color hexadecimal identificativo seleccionado. */
  initialColor: string;
  /** Persiste la creación o actualización de la rutina; devuelve mensaje si hay error de validación. */
  onSave: (payload: SaveRoutinePayload) => string | undefined | void | Promise<string | undefined | void>;
  /** Cierra el modal sin guardar cambios. */
  onClose: () => void;
}

/**
 * Modal de creación y edición de nombre, subtítulo y color de una rutina.
 */
export function RoutineModal({ mode, initialName, initialSub, initialColor, onSave, onClose }: RoutineModalProps) {
  const [name, setName] = useState(initialName);
  const [sub, setSub] = useState(initialSub);
  const [color, setColor] = useState(initialColor);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(initialName);
    setSub(initialSub);
    setColor(initialColor);
    setError(null);
  }, [mode, initialName, initialSub, initialColor]);

  const isEdit = mode === 'edit';

  return (
    <ModalShell id="rt-modal" labelledBy="rtModalTitle" panelClass="max-w-md border-white/10" onClose={onClose}>
      <form
        id="f-routine-meta"
        class="p-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          void Promise.resolve(onSave({ name, sub, color }))
            .then((err) => { if (typeof err === 'string' && err) setError(err); })
            .catch(() => setError('No se pudo guardar la rutina. Inténtalo de nuevo.'));
        }}
      >
        <div class="flex items-center justify-between gap-2">
          <div>
            <h3 id="rtModalTitle" class="text-base font-extrabold text-white">{isEdit ? 'Editar rutina' : 'Nueva rutina personalizada'}</h3>
            <p class="text-xs text-gray-400">
              {isEdit ? 'Cambia el nombre, subtítulo o color identificativo.' : 'Crea un día o bloque propio (ej. Torso A, Full Body, Brazo…).'}
            </p>
          </div>
          <button type="button" aria-label="Cerrar modal" class="icon-btn" onClick={onClose}>
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <p role="alert" class="rounded-xl border border-coralRed/40 bg-coralRed/10 px-3 py-2 text-xs font-medium text-rose-200">{error}</p>
        )}

        <label class="block">
          <span class="lbl">Nombre de la rutina</span>
          <input id="rtModalName" class="inp" name="name" enterKeyHint="next" maxLength={40} value={name} placeholder="Ej. Torso A" required onInput={(e) => { setName(e.currentTarget.value); setError(null); }} />
        </label>

        <label class="block">
          <span class="lbl">Subtítulo corto (opcional)</span>
          <input class="inp" name="sub" enterKeyHint="done" maxLength={40} value={sub} placeholder="Ej. Empuje, Fuerza, Cadena post." onInput={(e) => setSub(e.currentTarget.value)} />
        </label>

        <fieldset class="space-y-2">
          <legend class="lbl">Color</legend>
          <div class="flex flex-wrap gap-1.5 sm:gap-2.5">
            {ROUTINE_COLORS.map((c) => (
              <label key={c} class="inline-flex h-11 w-11 sm:h-8 sm:w-8 cursor-pointer items-center justify-center rounded-full">
                <input type="radio" name="color" value={c} aria-label={`Color ${ROUTINE_COLOR_NAMES[c] ?? c}`} checked={c === color} class="sr-only peer" onChange={() => setColor(c)} />
                <span class="block h-7 w-7 rounded-full border border-white/20 transition-transform motion-reduce:transform-none peer-checked:scale-110 peer-checked:ring-2 peer-checked:ring-white peer-checked:ring-offset-2 peer-checked:ring-offset-modalDark peer-focus-visible:ring-2 peer-focus-visible:ring-electricBlue peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-modalDark" style={{ background: c }} />
              </label>
            ))}
          </div>
        </fieldset>

        <div class="flex items-center justify-end gap-2 border-t border-white/10 pt-3">
          <button type="button" class="btn" onClick={onClose}>Cancelar</button>
          <button type="submit" class="btn-primary">
            <Icon name="save" className="h-4 w-4" /> {isEdit ? 'Guardar cambios' : 'Crear rutina'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
