import type { SetRec } from '../../types';
import { Collapsible } from '../common/Collapsible';
import { Icon } from '../common/Icon';
import { StepperInput } from '../common/StepperInput';

interface SetRowProps {
  /** Índice base 0 de esta serie dentro del ejercicio. */
  setIndex: number;
  /** Datos de peso, repeticiones, RIR, descanso y estado de la serie. */
  set: SetRec;
  /** Descanso objetivo mostrado como placeholder si no hay valor registrado. */
  targetRestSec: number;
  /** Muestra la subfila plegable con RIR y descanso real. */
  showDetails: boolean;
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

const STEP_BTN =
  'flex min-h-[48px] sm:min-h-[44px] w-9 min-[390px]:w-11 sm:w-10 shrink-0 items-center justify-center border border-white/15 bg-white/5 text-base font-bold text-gray-200 hover:border-electricBlue active:scale-95 motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue';
const EXTRA_INP =
  'min-h-[44px] sm:min-h-0 rounded-lg border border-white/15 bg-transparent py-1.5 sm:py-1 text-center text-base sm:text-xs font-semibold tabular-nums text-white focus:border-electricBlue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue';

/**
 * Fila interactiva compacta de una serie individual en `En vivo` (altura primaria `>= 48px`)
 * con `RIR` y `Desc. real` desplegables bajo demanda.
 */
export function SetRow({
  setIndex,
  set: s,
  targetRestSec,
  showDetails,
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
    <div class={`py-2 transition-colors ${s.done ? 'bg-emeraldGreen/10 -mx-2 px-2 rounded-lg' : ''}`}>
      <div class="flex items-center gap-1.5">
        <span class={`w-5 shrink-0 text-center tabular-nums text-xs font-bold ${s.done ? 'text-emerald-300' : 'text-gray-300'}`}>
          <span class="sr-only">Serie {n}{s.done ? ' · Hecha' : ''}</span>
          <span aria-hidden="true">S{n}</span>
        </span>

        <StepperInput
          label="Peso (kg)" labelClass="sr-only" wrapClass="flex-1 min-w-0"
          value={s.w} step="0.5" inputMode="decimal" inputAria={`Peso kg serie ${n}`} delta={2.5}
          decAria={`Restar 2,5 kg serie ${n}`} incAria={`Sumar 2,5 kg serie ${n}`} btnClass={STEP_BTN}
          inputClass="inp-stepper border-white/15 bg-transparent text-base min-h-[48px] sm:min-h-[44px] min-w-[36px] min-[390px]:min-w-[40px] px-0.5"
          onStep={onStepWeight} onInputValue={(raw) => onWeightChange(raw, false)} onBlurValue={(raw) => onWeightChange(raw, true)}
        />

        <StepperInput
          label="Reps" labelClass="sr-only" wrapClass="flex-1 min-w-0"
          value={s.r} step="1" inputMode="numeric" inputAria={`Repeticiones serie ${n}`} delta={1}
          decAria={`Restar 1 repetición serie ${n}`} incAria={`Sumar 1 repetición serie ${n}`} btnClass={STEP_BTN}
          inputClass="inp-stepper border-white/15 bg-transparent text-base min-h-[48px] sm:min-h-[44px] min-w-[36px] min-[390px]:min-w-[40px] px-0.5"
          onStep={onStepReps} onInputValue={(raw) => onRepsChange(raw, false)} onBlurValue={(raw) => onRepsChange(raw, true)}
        />

        <button
          type="button"
          aria-pressed={s.done ? 'true' : 'false'}
          aria-label={`${s.done ? 'Desmarcar' : 'Marcar'} serie ${n}`}
          class={`flex min-h-[48px] min-w-[48px] sm:min-h-[44px] sm:min-w-[80px] sm:px-2.5 shrink-0 items-center justify-center gap-1 rounded-xl border text-xs font-bold transition-colors active:scale-95 motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${s.done ? 'border-emeraldGreen bg-emeraldGreen text-gray-950' : 'border-white/15 bg-white/5 text-gray-200 hover:border-emeraldGreen/60'}`}
          style={{ touchAction: 'manipulation' }}
          onClick={onToggleDone}
        >
          <Icon name="check" className="h-4 w-4" />
          <span class="hidden sm:inline">{s.done ? 'Hecha' : 'Listo'}</span>
        </button>
      </div>

      <Collapsible open={showDetails} keepMounted>
        <div class="flex flex-wrap items-center gap-4 pl-6 pt-2 pb-0.5 text-xs text-gray-400">
          <label class="inline-flex items-center gap-1.5">
            <span title="Repeticiones en reserva">RIR</span>
            <input class={`${EXTRA_INP} w-12`} type="number" step="1" min="0" max="10" inputMode="numeric" enterKeyHint="done" value={s.rir ?? ''} placeholder="—" aria-label={`RIR de serie ${n}`} onInput={(e) => onRirChange(e.currentTarget.value)} />
          </label>
          <label class="inline-flex items-center gap-1.5">
            <span title="Descanso real en esta serie (se rellena solo al usar el reloj)">Desc. real</span>
            <input class={`${EXTRA_INP} w-16`} type="number" step="5" min="0" max="1800" inputMode="numeric" enterKeyHint="done" value={s.restSec ?? ''} placeholder={String(targetRestSec)} aria-label={`Descanso en segundos serie ${n}`} onInput={(e) => onRestChange(e.currentTarget.value)} />
            <span>s</span>
          </label>
        </div>
      </Collapsible>
    </div>
  );
}
