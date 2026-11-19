import type { SetRec } from '../../types';
import { Icon } from '../common/Icon';
import { StepperInput } from '../common/StepperInput';

interface SetRowProps {
  /** Índice base 0 de esta serie dentro del ejercicio. */
  setIndex: number;
  /** Datos de peso, repeticiones, RIR, descanso y estado de la serie. */
  set: SetRec;
  /** Descanso objetivo mostrado como placeholder si no hay valor registrado. */
  targetRestSec: number;
  /** Incrementa o decrementa el peso mediante botones `−` / `+`. */
  onStepWeight: (delta: number) => void;
  /** Actualiza el peso al escribir o perder el foco. */
  onWeightChange: (raw: string, finalize: boolean) => void;
  /** Incrementa o decrementa las repeticiones mediante botones `−` / `+`. */
  onStepReps: (delta: number) => void;
  /** Actualiza las repeticiones al escribir o perder el foco. */
  onRepsChange: (raw: string, finalize: boolean) => void;
  /** Marca o desmarca la serie como completada. */
  onToggleDone: () => void;
  /** Guarda el RIR opcional de la serie. */
  onRirChange: (raw: string) => void;
  /** Guarda el descanso real opcional en segundos. */
  onRestChange: (raw: string) => void;
}

const STEP_BTN = 'flex h-12 sm:h-11 w-11 shrink-0 items-center justify-center border border-white/15 bg-white/5 text-base font-bold text-gray-200 hover:border-electricBlue active:scale-95';

/**
 * Fila interactiva de una serie individual en `En vivo` con peso, reps, RIR y descanso.
 */
export function SetRow({
  setIndex,
  set: s,
  targetRestSec,
  onStepWeight,
  onWeightChange,
  onStepReps,
  onRepsChange,
  onToggleDone,
  onRirChange,
  onRestChange,
}: SetRowProps) {
  const n = setIndex + 1;

  return (
    <div class={`py-3 space-y-2 transition-colors ${s.done ? 'bg-emeraldGreen/10 -mx-2 px-2 rounded-lg' : ''}`}>
      <div class="flex items-center justify-between gap-2 text-xs">
        <span class={`font-bold tabular-nums ${s.done ? 'text-emerald-300' : 'text-gray-300'}`}>
          Serie {n}{s.done ? ' · Hecha' : ''}
        </span>
        <label class="inline-flex min-h-[44px] sm:min-h-0 items-center gap-1.5 text-gray-400">
          <span title="Repeticiones en reserva">RIR</span>
          <input
            class="w-12 min-h-[44px] sm:min-h-0 rounded-lg border border-white/15 bg-transparent py-1.5 sm:py-1 text-center text-base sm:text-xs font-semibold tabular-nums text-white focus:border-electricBlue focus:outline-none"
            type="number"
            step="1"
            min="0"
            max="10"
            inputMode="numeric"
            value={s.rir ?? ''}
            placeholder="—"
            aria-label={`RIR de serie ${n}`}
            onInput={(e) => onRirChange(e.currentTarget.value)}
          />
        </label>
        <label class="inline-flex min-h-[44px] sm:min-h-0 items-center gap-1.5 text-gray-400">
          <span title="Descanso real en esta serie (se rellena solo al usar el reloj)">Desc. real</span>
          <input
            class="w-16 min-h-[44px] sm:min-h-0 rounded-lg border border-white/15 bg-transparent py-1.5 sm:py-1 text-center text-base sm:text-xs font-semibold tabular-nums text-white focus:border-electricBlue focus:outline-none"
            type="number"
            step="5"
            min="0"
            max="1800"
            inputMode="numeric"
            value={s.restSec ?? ''}
            placeholder={String(targetRestSec)}
            aria-label={`Descanso en segundos serie ${n}`}
            onInput={(e) => onRestChange(e.currentTarget.value)}
          />
          <span>s</span>
        </label>
      </div>

      <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
        <StepperInput
          label="Peso (kg)"
          wrapClass="min-w-0"
          value={s.w}
          step="0.5"
          inputMode="decimal"
          inputAria={`Peso kg serie ${n}`}
          delta={2.5}
          decAria={`Restar 2,5 kg serie ${n}`}
          incAria={`Sumar 2,5 kg serie ${n}`}
          btnClass={STEP_BTN}
          inputClass="inp-stepper border-white/15 bg-transparent text-base h-12 sm:h-11"
          onStep={onStepWeight}
          onInputValue={(raw) => onWeightChange(raw, false)}
          onBlurValue={(raw) => onWeightChange(raw, true)}
        />
        <StepperInput
          label="Reps"
          wrapClass="min-w-0"
          value={s.r}
          step="1"
          inputMode="numeric"
          inputAria={`Repeticiones serie ${n}`}
          delta={1}
          decAria={`Restar 1 repetición serie ${n}`}
          incAria={`Sumar 1 repetición serie ${n}`}
          btnClass={STEP_BTN}
          inputClass="inp-stepper border-white/15 bg-transparent text-base h-12 sm:h-11"
          onStep={onStepReps}
          onInputValue={(raw) => onRepsChange(raw, false)}
          onBlurValue={(raw) => onRepsChange(raw, true)}
        />
        <button
          type="button"
          aria-pressed={s.done ? 'true' : 'false'}
          aria-label={`${s.done ? 'Desmarcar' : 'Marcar'} serie ${n}`}
          class={`flex h-12 w-12 sm:h-11 sm:w-20 items-center justify-center gap-1 rounded-xl border text-xs font-bold transition-colors active:scale-95 ${s.done ? 'border-emeraldGreen bg-emeraldGreen text-gray-950' : 'border-white/15 bg-white/5 text-gray-200 hover:border-emeraldGreen/60'}`}
          style={{ touchAction: 'manipulation' }}
          onClick={onToggleDone}
        >
          <Icon name="check" className="h-4 w-4" />
          <span class="hidden sm:inline">{s.done ? 'Hecha' : 'Listo'}</span>
        </button>
      </div>
    </div>
  );
}
