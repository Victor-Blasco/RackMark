import { useEffect, useState } from 'preact/hooks';
import { Icon } from '../common/Icon';

interface InlineTargetEditorProps {
  /** Nombre del ejercicio para etiquetas ARIA. */
  exName: string;
  /** Series objetivo actuales. */
  sets: number;
  /** Repeticiones objetivo actuales. */
  reps: number;
  /** Guarda los nuevos objetivos de series y repeticiones. */
  onSave: (setsRaw: string, repsRaw: string) => void;
}

/**
 * Chip compacto `3×8 ✎` que permite editar series y repeticiones objetivo in-situ sin cambiar de vista.
 */
export function InlineTargetEditor({ exName, sets, reps, onSave }: InlineTargetEditorProps) {
  const [editing, setEditing] = useState(false);
  const [setsVal, setSetsVal] = useState(String(sets));
  const [repsVal, setRepsVal] = useState(String(reps));

  useEffect(() => {
    setSetsVal(String(sets));
    setRepsVal(String(reps));
  }, [sets, reps]);

  if (!editing) {
    return (
      <button
        type="button"
        aria-label={`Editar series y reps objetivo de ${exName}: ${sets}×${reps}`}
        title="Editar series × reps"
        class="inline-flex min-h-[44px] sm:min-h-[30px] shrink-0 items-center gap-1 rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-1 text-xs font-bold text-gray-100 tabular-nums transition-colors hover:border-electricBlue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue"
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
      >
        <span>{sets}×{reps}</span>
        <Icon name="edit" className="h-3 w-3 text-electricBlue" />
      </button>
    );
  }

  const commit = () => {
    onSave(setsVal, repsVal);
    setEditing(false);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSetsVal(String(sets));
      setRepsVal(String(reps));
      setEditing(false);
    }
  };

  return (
    <div class="inline-flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
      <input
        type="number"
        min="1"
        max="20"
        inputMode="numeric"
        aria-label={`Series objetivo de ${exName}`}
        class="inp min-h-[44px] sm:min-h-[30px] w-12 px-1 py-0 text-center text-base sm:text-xs font-bold tabular-nums"
        value={setsVal}
        onInput={(e) => setSetsVal(e.currentTarget.value)}
      />
      <span class="text-xs text-gray-400" aria-hidden="true">×</span>
      <input
        type="number"
        min="1"
        max="60"
        inputMode="numeric"
        aria-label={`Repeticiones objetivo de ${exName}`}
        class="inp min-h-[44px] sm:min-h-[30px] w-12 px-1 py-0 text-center text-base sm:text-xs font-bold tabular-nums"
        value={repsVal}
        onInput={(e) => setRepsVal(e.currentTarget.value)}
      />
      <button
        type="button"
        aria-label={`Guardar objetivo de ${exName}`}
        class="btn-primary-sm min-h-[44px] sm:min-h-[30px] px-2.5 text-xs font-bold"
        onClick={commit}
      >
        OK
      </button>
    </div>
  );
}
