import { useDismissibleMenu } from '../../hooks/useDismissibleMenu';
import type { SetKind, SetRec } from '../../types';
import { Collapsible } from '../common/Collapsible';
import { Icon } from '../common/Icon';
import { StepperInput } from '../common/StepperInput';
import { SetTypePopover } from './SetTypePopover';

interface SetRowProps {
  setIndex: number;
  tagLabel: string;
  nextDropNum: number;
  canDelete: boolean;
  set: SetRec;
  targetRestSec: number;
  showDetails: boolean;
  onStepWeight: (delta: number) => void;
  onWeightChange: (raw: string, finalize: boolean) => void;
  onStepReps: (delta: number) => void;
  onRepsChange: (raw: string, finalize: boolean) => void;
  onToggleDone: () => void;
  onRirChange: (raw: string) => void;
  onRestChange: (raw: string) => void;
  onSelectKind: (kind: SetKind) => void;
  onAddDrop: () => void;
  onRemoveDrop: () => void;
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
  tagLabel,
  nextDropNum,
  canDelete,
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
  onSelectKind,
  onAddDrop,
  onRemoveDrop,
}: SetRowProps) {
  const n = setIndex + 1;
  const kind: SetKind = s.kind ?? 'S';
  const { open, setOpen, triggerRef, menuRef } = useDismissibleMenu();
  const tagCls = kind === 'W'
    ? 'border-amberGold/50 text-amberGold bg-amberGold/10'
    : kind === 'D'
      ? 'border-electricBlue/50 text-blue-300 bg-electricBlue/10'
      : kind === 'F'
        ? 'border-coralRed/50 text-rose-300 bg-coralRed/10'
        : s.done
          ? 'border-emeraldGreen/50 text-emerald-300'
          : 'border-white/15 text-gray-300';

  return (
    <div class={`relative py-2 transition-colors ${kind === 'D' ? 'pl-2.5 border-l-2 border-electricBlue/70' : ''} ${kind === 'W' ? 'opacity-85' : ''} ${s.done ? 'bg-emeraldGreen/10 -mx-2 px-2 rounded-lg' : ''}`}>
      <div class="flex items-center gap-1.5">
        <div class="relative shrink-0" ref={menuRef}>
          <button
            ref={triggerRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={open ? 'true' : 'false'}
            aria-label={`Serie ${n} (${tagLabel})${s.done ? ' · Hecha' : ''} · Cambiar tipo`}
            class={`flex min-h-[48px] sm:min-h-[44px] min-w-[36px] px-1 items-center justify-center rounded-lg border text-[11px] font-extrabold tabular-nums transition-colors hover:border-electricBlue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${tagCls}`}
            onClick={() => setOpen((v) => !v)}
          >
            {tagLabel}
          </button>
          {open && (
            <SetTypePopover
              kind={kind}
              nextDropNum={nextDropNum}
              onSelectKind={(k) => { setOpen(false); onSelectKind(k); }}
              onAddDrop={() => { setOpen(false); onAddDrop(); }}
              onRemoveDrop={canDelete ? () => { setOpen(false); onRemoveDrop(); } : undefined}
            />
          )}
        </div>

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
