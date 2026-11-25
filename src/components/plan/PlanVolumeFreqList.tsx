import { useState } from 'preact/hooks';
import { routineFreq } from '../../store/planSelectors';
import { routineColor, type State } from '../../ui/shared';
import { Collapsible } from '../common/Collapsible';
import { Icon } from '../common/Icon';

interface PlanVolumeFreqListProps {
  /** Estado global con rutinas y metadatos. */
  state: State;
  /** Lista ordenada de rutinas definidas. */
  routines: string[];
  /** Suma total de sesiones semanales entre todas las rutinas. */
  totalSessions: number;
  /** Actualiza la frecuencia semanal (`0..7`) de una rutina. */
  onChangeFreq: (day: string, freq: number) => void;
}

const STEP_BTN_CLS =
  'inline-flex min-h-[44px] min-w-[44px] sm:min-h-[30px] sm:min-w-[30px] items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-sm font-bold text-gray-200 hover:border-white/25 hover:text-white disabled:opacity-35 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue';

/**
 * Selector de frecuencia semanal por rutina (`0×..7×`) mediante stepper táctil.
 */
export function PlanVolumeFreqList({ state, routines, totalSessions, onChangeFreq }: PlanVolumeFreqListProps) {
  const collapsible = routines.length > 4;
  const [open, setOpen] = useState(!collapsible);
  const s = state.settings;

  const listNode = (
    <div class="space-y-1.5 pt-1">
      {routines.map((d, idx) => {
        const freq = routineFreq(s, d);
        const col = routineColor(d, s, idx);
        return (
          <div key={d} class="flex items-center justify-between gap-2 text-xs">
            <div class="flex min-w-0 items-center gap-2">
              <span class="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: col }} aria-hidden="true" />
              <span class={`truncate font-medium ${freq === 0 ? 'text-gray-400 line-through' : 'text-gray-200'}`}>
                {d}
              </span>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <button
                type="button"
                class={STEP_BTN_CLS}
                disabled={freq <= 0}
                aria-label={`Reducir frecuencia semanal de ${d}`}
                onClick={() => onChangeFreq(d, freq - 1)}
              >
                −
              </button>
              <span class="min-w-[2.25rem] text-center tabular-nums font-bold text-white" aria-live="polite">
                {freq}×
              </span>
              <button
                type="button"
                class={STEP_BTN_CLS}
                disabled={freq >= 7}
                aria-label={`Aumentar frecuencia semanal de ${d}`}
                onClick={() => onChangeFreq(d, freq + 1)}
              >
                +
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div class="border-t border-white/10 pt-2.5 space-y-1.5">
      {collapsible ? (
        <button
          type="button"
          class="flex w-full min-h-[44px] sm:min-h-[32px] items-center justify-between gap-2 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue rounded"
          aria-expanded={open ? 'true' : 'false'}
          onClick={() => setOpen((v) => !v)}
        >
          <span>Frecuencia semanal · {totalSessions} d/sem</span>
          <Icon name="caretDown" className={`h-3.5 w-3.5 transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
        </button>
      ) : (
        <p class="text-[11px] font-bold uppercase tracking-wider text-gray-400">
          Frecuencia semanal · {totalSessions} d/sem
        </p>
      )}
      <Collapsible open={open}>{listNode}</Collapsible>
    </div>
  );
}
