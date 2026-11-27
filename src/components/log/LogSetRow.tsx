import { useDismissibleMenu } from '../../hooks/useDismissibleMenu';
import type { LogWorkoutActions } from '../../store/logActions';
import type { SetKind, SetRec } from '../../types';
import { Collapsible } from '../common/Collapsible';
import { Icon } from '../common/Icon';
import { StepperInput } from '../common/StepperInput';
import { SetTypePopover } from '../workout/SetTypePopover';

interface LogSetRowProps {
  ei: number;
  si: number;
  exName: string;
  tagLabel: string;
  nextDropNum: number;
  canDelete: boolean;
  set: SetRec;
  showMobileDetails: boolean;
  actions: LogWorkoutActions;
}

const LOG_STEP_BTN =
  'flex h-11 w-9 shrink-0 items-center justify-center border border-gray-700 bg-gray-900 text-base font-bold text-gray-200 hover:border-electricBlue active:scale-95 motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue';
const DESKTOP_NUM_INP = 'inp h-11 rounded-md px-1.5 py-0 text-center text-base sm:text-sm font-semibold tabular-nums';
const MOBILE_NUM_INP = 'inp h-11 rounded-lg px-2 py-0 text-center text-base font-semibold tabular-nums';

/**
 * Fila compacta de una serie en `Registrar hecho`: peso y reps en una línea,
 * `RIR` y `Desc (s)` en línea en escritorio y bajo acordeón en móvil.
 */
export function LogSetRow({ ei, si, exName, tagLabel, nextDropNum, canDelete, set: s, showMobileDetails, actions }: LogSetRowProps) {
  const n = si + 1;
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
          : 'border-gray-700 text-gray-300';

  return (
    <div class={`relative rounded-xl px-1 py-1.5 transition-colors ${kind === 'D' ? 'pl-2.5 border-l-2 border-electricBlue/70' : ''} ${kind === 'W' ? 'opacity-85' : ''} ${s.done ? 'bg-emeraldGreen/10' : ''}`}>
      <div class="flex items-center gap-1.5">
        <div class="relative shrink-0" ref={menuRef}>
          <button
            ref={triggerRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={open ? 'true' : 'false'}
            aria-label={`Serie ${n} (${tagLabel}) de ${exName}${s.done ? ' · completada' : ''} · Cambiar tipo`}
            class={`flex h-11 min-w-[36px] px-1 items-center justify-center rounded-lg border text-[11px] font-extrabold tabular-nums transition-colors hover:border-electricBlue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${tagCls}`}
            onClick={() => setOpen((v) => !v)}
          >
            {tagLabel}
          </button>
          {open && (
            <SetTypePopover
              kind={kind}
              nextDropNum={nextDropNum}
              onSelectKind={(k) => { setOpen(false); actions.setSetKind(ei, si, k); }}
              onAddDrop={() => { setOpen(false); actions.addDropSet(ei, si); }}
              onRemoveDrop={canDelete ? () => { setOpen(false); actions.delSet(ei, si); } : undefined}
            />
          )}
        </div>

        <StepperInput
          label="Peso (kg)" labelClass="sr-only" wrapClass="flex-1 min-w-0" btnClass={LOG_STEP_BTN}
          inputClass="inp-stepper min-h-[44px] min-w-[40px] px-0.5 text-base sm:text-sm"
          value={s.w} step="0.5" inputMode="decimal" inputAria={`Peso en kg serie ${n} de ${exName}`} delta={2.5}
          decAria={`Restar 2,5 kg a serie ${n} de ${exName}`} incAria={`Sumar 2,5 kg a serie ${n} de ${exName}`}
          onStep={(d) => actions.stepWeight(ei, si, d)}
          onInputValue={(raw) => actions.updateWeight(ei, si, raw, false)}
          onBlurValue={(raw) => actions.updateWeight(ei, si, raw, true)}
        />

        <StepperInput
          label="Reps" labelClass="sr-only" wrapClass="flex-1 min-w-0" btnClass={LOG_STEP_BTN}
          inputClass="inp-stepper min-h-[44px] min-w-[34px] px-0.5 text-base sm:text-sm"
          value={s.r} step="1" inputMode="numeric" inputAria={`Repeticiones serie ${n} de ${exName}`} delta={1}
          decAria={`Restar 1 repetición a serie ${n} de ${exName}`} incAria={`Sumar 1 repetición a serie ${n} de ${exName}`}
          onStep={(d) => actions.stepReps(ei, si, d)}
          onInputValue={(raw) => actions.updateReps(ei, si, raw, false)}
          onBlurValue={(raw) => actions.updateReps(ei, si, raw, true)}
        />

        <div class="hidden sm:block shrink-0">
          <input class={`${DESKTOP_NUM_INP} w-16`} type="number" step="5" min="0" max="1800" inputMode="numeric" enterKeyHint="done" value={s.restSec ?? ''} placeholder="—" aria-label={`Descanso en segundos serie ${n} de ${exName}`} onInput={(e) => actions.updateRest(ei, si, e.currentTarget.value)} />
        </div>

        <div class="hidden sm:block shrink-0">
          <input class={`${DESKTOP_NUM_INP} w-12`} type="number" step="1" min="0" max="10" inputMode="numeric" enterKeyHint="done" value={s.rir ?? ''} placeholder="—" aria-label={`RIR de serie ${n} de ${exName}`} onInput={(e) => actions.updateRir(ei, si, e.currentTarget.value)} />
        </div>

        <button
          type="button"
          aria-pressed={s.done ? 'true' : 'false'}
          aria-label={`${s.done ? 'Desmarcar' : 'Completar'} serie ${n} de ${exName}`}
          class={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md border transition-colors active:scale-95 motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${s.done ? 'border-emeraldGreen bg-emeraldGreen text-gray-950' : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-emeraldGreen/60 hover:text-white'}`}
          style={{ touchAction: 'manipulation' }}
          onClick={() => actions.toggleSet(ei, si)}
        >
          {s.done ? <Icon name="check" className="h-5 w-5" /> : <span class="h-4 w-4 rounded-full border-2 border-current opacity-60" aria-hidden="true" />}
        </button>
      </div>

      <Collapsible open={showMobileDetails} keepMounted className="sm:hidden">
        <div class="flex items-center gap-3 pl-6 pt-2 pb-0.5 text-xs text-gray-400">
          <label class="inline-flex items-center gap-1.5">
            <span>RIR</span>
            <input class={`${MOBILE_NUM_INP} w-14`} type="number" step="1" min="0" max="10" inputMode="numeric" enterKeyHint="done" value={s.rir ?? ''} placeholder="—" aria-label={`RIR móvil de serie ${n} de ${exName}`} onInput={(e) => actions.updateRir(ei, si, e.currentTarget.value)} />
          </label>
          <label class="inline-flex items-center gap-1.5">
            <span>Desc (s)</span>
            <input class={`${MOBILE_NUM_INP} w-20`} type="number" step="5" min="0" max="1800" inputMode="numeric" enterKeyHint="done" value={s.restSec ?? ''} placeholder="—" aria-label={`Descanso móvil en segundos serie ${n} de ${exName}`} onInput={(e) => actions.updateRest(ei, si, e.currentTarget.value)} />
          </label>
        </div>
      </Collapsible>
    </div>
  );
}
