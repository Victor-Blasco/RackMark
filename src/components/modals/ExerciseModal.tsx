import { useState } from 'preact/hooks';
import { MUSCLES } from '../../lib/seed';
import type { SaveExercisePayload } from '../../store/planActions';
import { suggestPrimaryMuscle } from '../../store/planSelectors';
import { Icon } from '../common/Icon';
import { ModalShell } from '../common/ModalShell';

interface ExerciseModalProps {
  /** Lista de rutinas disponibles para asignar directamente el nuevo ejercicio. */
  routines: string[];
  /** Rutina preseleccionada si el modal se abrió desde un día concreto. */
  defaultRoutine?: string;
  /** Nombre inicial sugerido (p. ej. heredado desde el buscador). */
  initialName?: string;
  /** Indica si se abrió desde `Registrar hecho` (oculta asignación de rutina). */
  fromLog?: boolean;
  /** Guarda el nuevo ejercicio en el catálogo y en la rutina destino; devuelve error de validación si falla. */
  onSave: (payload: SaveExercisePayload) => string | undefined | undefined | Promise<string | undefined | undefined>;
  /** Cierra el modal sin guardar cambios. */
  onClose: () => void;
}

/**
 * Modal de creación de ejercicio personalizado con asignación de músculo primario y secundarios.
 */
export function ExerciseModal({ routines, defaultRoutine = '', initialName = '', fromLog, onSave, onClose }: ExerciseModalProps) {
  const initialSuggested = initialName ? (suggestPrimaryMuscle(initialName) ?? '') : '';
  const [name, setName] = useState(initialName);
  const [primary, setPrimary] = useState<string>(initialSuggested);
  const [primaryTouched, setPrimaryTouched] = useState<boolean>(Boolean(initialSuggested));
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);
  const [secondary, setSecondary] = useState<string[]>([]);
  const [routine, setRoutine] = useState(defaultRoutine);
  const [error, setError] = useState<string | null>(null);

  const toggleSec = (m: string) =>
    setSecondary((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  return (
    <ModalShell id="ex-modal" labelledBy="exModalTitle" panelClass="max-w-lg border-white/10 max-h-[90vh] overflow-y-auto" onClose={onClose}>
      <form
        id="f-new-ex"
        class="p-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!primary) { setError('Selecciona el músculo principal del ejercicio.'); return; }
          setError(null);
          void Promise.resolve(onSave({ name, primary, secondary, sets, reps, routine }))
            .then((err) => { if (typeof err === 'string' && err) setError(err); })
            .catch(() => setError('No se pudo guardar el ejercicio. Inténtalo de nuevo.'));
        }}
      >
        <div class="flex items-center justify-between gap-2">
          <div>
            <h3 id="exModalTitle" class="text-base font-extrabold text-white">Crear nuevo ejercicio</h3>
            <p class="text-xs text-gray-400">Se añadirá a tu biblioteca muscular y podrás asignarlo a una rutina.</p>
          </div>
          <button type="button" aria-label="Cerrar modal" class="icon-btn" onClick={onClose}>
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        {error && <p role="alert" class="rounded-xl border border-coralRed/40 bg-coralRed/10 px-3 py-2 text-xs font-medium text-rose-200">{error}</p>}

        <label class="block">
          <span class="lbl">Nombre del ejercicio</span>
          <input
            id="newExName" class="inp" name="name" maxLength={80} enterKeyHint="next" value={name} placeholder="Ej. Remo en polea gironda" required
            onInput={(e) => {
              const val = e.currentTarget.value;
              setName(val);
              setError(null);
              if (!primaryTouched) {
                const sug = suggestPrimaryMuscle(val) ?? '';
                setPrimary(sug);
                if (sug) setSecondary((prev) => prev.filter((x) => x !== sug));
              }
            }}
          />
        </label>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label class="block sm:col-span-1">
            <span class="lbl">Músculo principal</span>
            <select
              class="inp" name="primary" value={primary} required
              onChange={(e) => {
                const next = e.currentTarget.value;
                setPrimary(next);
                setPrimaryTouched(true);
                setError(null);
                setSecondary((prev) => prev.filter((x) => x !== next));
              }}
            >
              <option value="">Selecciona músculo…</option>
              {MUSCLES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label class="block">
            <span class="lbl">Series objetivo</span>
            <input class="inp tabular-nums font-medium" type="number" inputMode="numeric" enterKeyHint="next" name="sets" min="1" max="20" value={sets} required onInput={(e) => setSets(Math.max(1, +e.currentTarget.value || 1))} />
          </label>
          <label class="block">
            <span class="lbl">Reps objetivo</span>
            <input class="inp tabular-nums font-medium" type="number" inputMode="numeric" enterKeyHint="done" name="reps" min="1" max="100" value={reps} required onInput={(e) => setReps(Math.max(1, +e.currentTarget.value || 1))} />
          </label>
        </div>

        <fieldset class="space-y-1.5">
          <legend class="lbl">Músculos secundarios (opcional)</legend>
          <div class="flex flex-wrap gap-1.5">
            {MUSCLES.map((m) => {
              const isPrim = m === primary;
              return (
                <label key={m} class={`select-none ${isPrim ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                  <input type="checkbox" name="secondary" value={m} disabled={isPrim} checked={!isPrim && secondary.includes(m)} class="sr-only peer" onChange={() => toggleSec(m)} />
                  <span class="inline-flex min-h-[44px] sm:min-h-[32px] items-center rounded-lg border border-white/10 bg-gray-900/70 px-2.5 py-1 text-xs font-semibold text-gray-300 transition-colors peer-checked:border-electricBlue peer-checked:bg-electricBlue/20 peer-checked:text-blue-200 peer-focus-visible:ring-2 peer-focus-visible:ring-electricBlue hover:border-white/25">{m}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {!fromLog && (
          <label class="block">
            <span class="lbl">Asignar a rutina</span>
            <select class="inp" name="routine" value={routine} onChange={(e) => setRoutine(e.currentTarget.value)}>
              <option value="">Solo guardar en catálogo</option>
              {routines.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        )}

        <div class="flex items-center justify-end gap-2 border-t border-white/10 pt-3">
          <button type="button" class="btn" onClick={onClose}>Cancelar</button>
          <button type="submit" class="btn-primary">
            <Icon name="save" className="h-4 w-4" /> Guardar ejercicio
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
