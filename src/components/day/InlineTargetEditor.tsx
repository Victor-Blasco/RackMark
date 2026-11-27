import { useEffect, useState } from 'preact/hooks';
import { fmtMMSS } from '../../ui/restAudio';
import { Icon } from '../common/Icon';

interface InlineTargetEditorProps {
  /** Nombre del ejercicio para etiquetas ARIA. */
  exName: string;
  /** Series objetivo actuales. */
  sets: number;
  /** Repeticiones objetivo actuales. */
  reps: number;
  /** Descanso propio del ejercicio en segundos (opcional). */
  restSec?: number;
  /** Guarda los nuevos objetivos de series, repeticiones y descanso. */
  onSave: (setsRaw: string, repsRaw: string, restSec?: number) => void;
}

/**
 * Chip compacto `3×8 ✎` que permite editar series, repeticiones y descanso objetivo in-situ sin cambiar de vista.
 */
export function InlineTargetEditor({ exName, sets, reps, restSec, onSave }: InlineTargetEditorProps) {
  const [editing, setEditing] = useState(false);
  const [setsVal, setSetsVal] = useState(String(sets));
  const [repsVal, setRepsVal] = useState(String(reps));
  const [restMin, setRestMin] = useState(restSec != null ? String(Math.floor(restSec / 60)) : '');
  const [restRem, setRestRem] = useState(restSec != null ? String(restSec % 60).padStart(2, '0') : '');

  useEffect(() => {
    setSetsVal(String(sets));
    setRepsVal(String(reps));
    setRestMin(restSec != null ? String(Math.floor(restSec / 60)) : '');
    setRestRem(restSec != null ? String(restSec % 60).padStart(2, '0') : '');
  }, [sets, reps, restSec]);

  if (!editing) {
    return (
      <button
        type="button"
        aria-label={`Editar series y reps objetivo de ${exName}: ${sets}×${reps}${restSec != null ? ` · descanso ${fmtMMSS(restSec)}` : ''}`}
        title="Editar series × reps y descanso"
        class="inline-flex min-h-[44px] sm:min-h-[30px] shrink-0 items-center gap-1 rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-1 text-xs font-bold text-gray-100 tabular-nums transition-colors hover:border-electricBlue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue"
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
      >
        <span>{sets}×{reps}{restSec != null ? ` · ${fmtMMSS(restSec)}` : ''}</span>
        <Icon name="edit" className="h-3 w-3 text-electricBlue" />
      </button>
    );
  }

  const commit = () => {
    const hasRest = restMin.trim() !== '' || restRem.trim() !== '';
    const m = Math.max(0, Math.min(15, parseInt(restMin || '0', 10) || 0));
    const s = Math.max(0, Math.min(59, parseInt(restRem || '0', 10) || 0));
    const total = m * 60 + s;
    onSave(setsVal, repsVal, hasRest && total >= 15 ? total : undefined);
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
      setRestMin(restSec != null ? String(Math.floor(restSec / 60)) : '');
      setRestRem(restSec != null ? String(restSec % 60).padStart(2, '0') : '');
      setEditing(false);
    }
  };

  return (
    <div class="inline-flex flex-wrap items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
      <input type="number" min="1" max="20" inputMode="numeric" aria-label={`Series objetivo de ${exName}`} class="inp min-h-[44px] sm:min-h-[30px] w-11 px-1 py-0 text-center text-base sm:text-xs font-bold tabular-nums" value={setsVal} onInput={(e) => setSetsVal(e.currentTarget.value)} />
      <span class="text-xs text-gray-400" aria-hidden="true">×</span>
      <input type="number" min="1" max="60" inputMode="numeric" aria-label={`Repeticiones objetivo de ${exName}`} class="inp min-h-[44px] sm:min-h-[30px] w-11 px-1 py-0 text-center text-base sm:text-xs font-bold tabular-nums" value={repsVal} onInput={(e) => setRepsVal(e.currentTarget.value)} />
      <span class="text-xs text-gray-400 ml-0.5" aria-hidden="true">·</span>
      <input type="number" min="0" max="15" inputMode="numeric" placeholder="1" aria-label={`Minutos de descanso de ${exName}`} class="inp min-h-[44px] sm:min-h-[30px] w-10 px-1 py-0 text-center text-base sm:text-xs font-semibold tabular-nums" value={restMin} onInput={(e) => setRestMin(e.currentTarget.value)} />
      <span class="text-xs text-gray-400" aria-hidden="true">:</span>
      <input type="number" min="0" max="59" step="5" inputMode="numeric" placeholder="30" aria-label={`Segundos de descanso de ${exName}`} class="inp min-h-[44px] sm:min-h-[30px] w-11 px-1 py-0 text-center text-base sm:text-xs font-semibold tabular-nums" value={restRem} onInput={(e) => setRestRem(e.currentTarget.value)} />
      <button type="button" aria-label={`Guardar objetivo de ${exName}`} class="btn-primary-sm min-h-[44px] sm:min-h-[30px] px-2.5 text-xs font-bold" onClick={commit}>OK</button>
    </div>
  );
}
