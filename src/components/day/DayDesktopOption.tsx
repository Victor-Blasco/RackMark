import type { ExStats } from '../../lib/analysis';
import { STATUS_STYLE } from '../../store/homeSelectors';
import type { AiEntry, RoutineEx } from '../../types';
import { DayOrganizeControls } from './DayOrganizeControls';
import { InlineTargetEditor } from './InlineTargetEditor';

interface DayDesktopOptionProps {
  idx: number;
  exercise: ExStats;
  selected: boolean;
  summary: string;
  advice?: AiEntry;
  routineRow?: RoutineEx;
  routineIdx: number;
  routineTotal: number;
  organizeMode: boolean;
  onSelect: () => void;
  onKeyDown: (ev: KeyboardEvent) => void;
  onUpdateTarget?: (idx: number, setsRaw: string, repsRaw: string) => void;
  onMoveRow?: (idx: number, dir: number) => void;
  onDeleteRow?: (idx: number) => void;
}

/** Fila seleccionable del listbox de escritorio con edición `3×8 ✎` y controles de orden. */
export function DayDesktopOption({
  idx, exercise: x, selected: sel, summary, advice, routineRow: rRow, routineIdx: rIdx,
  routineTotal, organizeMode, onSelect, onKeyDown, onUpdateTarget, onMoveRow, onDeleteRow,
}: DayDesktopOptionProps) {
  const st = STATUS_STYLE[x.statusColor] ?? STATUS_STYLE.gray;

  return (
    <div
      id={`day-opt-${idx}`}
      role="option"
      tabIndex={sel ? 0 : -1}
      aria-selected={sel ? 'true' : 'false'}
      class={`w-full cursor-pointer rounded-2xl border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${sel ? 'border-electricBlue bg-electricBlue/10' : 'border-white/10 bg-cardDark hover:border-white/25'}`}
      onClick={onSelect}
      onKeyDown={onKeyDown}
    >
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm font-bold text-white truncate">{x.name}</span>
        <span class={`inline-flex shrink-0 items-center gap-1 text-[11px] font-bold ${st.text}`} title={advice?.status ?? x.status}>
          <span class={`h-2 w-2 rounded-full ${st.dot}`} aria-hidden="true" />
          <span aria-hidden="true">{st.glyph}</span>
          <span class="sr-only">{advice?.status ?? x.status}</span>
        </span>
      </div>
      <div class="mt-1.5 flex items-center justify-between gap-2 text-[13px] text-gray-300">
        <span class="font-medium tabular-nums truncate">{summary}</span>
        <div class="flex shrink-0 items-center gap-1">
          {rRow && onUpdateTarget ? (
            <InlineTargetEditor exName={x.name} sets={rRow.sets} reps={rRow.reps} onSave={(s, r) => onUpdateTarget(rIdx, s, r)} />
          ) : (
            <span class="shrink-0 font-semibold text-gray-200 tabular-nums">{x.target ? `${x.target.sets}×${x.target.reps}` : `${x.n} ses.`}</span>
          )}
          {organizeMode && rRow && onMoveRow && onDeleteRow && (
            <DayOrganizeControls exName={x.name} idx={rIdx} total={routineTotal} onMoveRow={onMoveRow} onDeleteRow={onDeleteRow} />
          )}
        </div>
      </div>
    </div>
  );
}
