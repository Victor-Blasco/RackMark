import { useLayoutEffect, useRef } from 'preact/hooks';
import type { ChartConfiguration } from 'chart.js';
import type { ExStats } from '../../lib/analysis';
import { norm } from '../../lib/seed';
import { STATUS_STYLE } from '../../store/homeSelectors';
import type { AiEntry, RoutineEx } from '../../types';
import { captureFlipRects, playFlipRects } from '../../ui/reorder';
import { short } from '../../ui/shared';
import { Collapsible } from '../common/Collapsible';
import { Icon } from '../common/Icon';
import { DayExerciseDetail } from './DayExerciseDetail';
import { DayOrganizeControls } from './DayOrganizeControls';
import { InlineTargetEditor } from './InlineTargetEditor';

interface DayMobileAccordionProps {
  exercises: ExStats[];
  routineRows?: RoutineEx[];
  organizeMode?: boolean;
  mobileCur?: string;
  rangeLabel: string;
  aiDate?: string;
  userNotes: Record<string, string>;
  mobileChartCfg: ChartConfiguration | null;
  aiFor: (ex: ExStats) => AiEntry | undefined;
  onSelectEx: (name: string) => void;
  onStartWorkout: () => void;
  onEditNote: (exName: string) => void;
  onUpdateTarget?: (idx: number, setsRaw: string, repsRaw: string, restSec?: number) => void;
  onMoveRow?: (idx: number, dir: number) => void;
  onDeleteRow?: (idx: number) => void;
  onAddToRoutine?: (exName: string) => void;
}

/** Acordeón móvil de ejercicios para pantallas pequeñas (`< lg`). */
export function DayMobileAccordion({
  exercises, routineRows = [], organizeMode = false, mobileCur, rangeLabel, aiDate, userNotes,
  mobileChartCfg, aiFor, onSelectEx, onStartWorkout, onEditNote, onUpdateTarget, onMoveRow, onDeleteRow, onAddToRoutine,
}: DayMobileAccordionProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const pendingFlipRef = useRef<{ rects: Map<string, DOMRect>; key: string } | null>(null);
  const orderKey = exercises.map((x) => x.name).join('\0');

  useLayoutEffect(() => {
    const pending = pendingFlipRef.current;
    if (!pending) return;
    pendingFlipRef.current = null;
    playFlipRects(listRef.current, pending.rects, pending.key);
  }, [orderKey]);

  return (
    <div ref={listRef} class="lg:hidden space-y-3">
      {exercises.map((x, idx) => {
        const open = x.name === mobileCur;
        const st = STATUS_STYLE[x.statusColor] ?? STATUS_STYLE.gray;
        const advice = aiFor(x);
        const rIdx = routineRows.findIndex((r) => norm(r.name) === norm(x.name));
        const rRow = rIdx >= 0 ? routineRows[rIdx] : undefined;
        const summary = x.last
          ? `${short(x.last.date)} · ${x.last.sets.map((s) => `${s.w}×${s.r}`).join(' · ')}`
          : x.n === 0 && x.target
            ? `Objetivo ${x.target.sets}×${x.target.reps} · Sin estrenar`
            : `Sin registros en ${rangeLabel}`;
        return (
          <div key={x.name} data-sort-item data-sort-key={x.name} class={`rounded-2xl border ${open ? 'border-electricBlue/60' : 'border-white/10'} bg-cardDark overflow-hidden`}>
            <div class="p-3.5 flex items-center justify-between gap-2">
              <button
                type="button"
                aria-expanded={open ? 'true' : 'false'}
                aria-controls={`day-mob-panel-${idx}`}
                class="min-w-0 flex-1 text-left flex items-center justify-between gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue"
                onClick={() => onSelectEx(open ? '__closed__' : x.name)}
              >
                <div class="min-w-0 space-y-0.5">
                  <p class="text-sm font-bold text-white truncate">{x.name}</p>
                  <p class="text-[13px] font-medium text-gray-300 tabular-nums truncate">{summary}</p>
                </div>
                <span class={`shrink-0 inline-flex items-center gap-1 text-[11px] font-bold ${st.text}`} title={advice?.status ?? x.status}>
                  <span class={`h-2 w-2 rounded-full ${st.dot}`} aria-hidden="true" />
                  <span aria-hidden="true">{st.glyph}</span>
                  <span class="sr-only">{advice?.status ?? x.status}</span>
                </span>
              </button>
              <div class="shrink-0 flex items-center gap-1">
                {rRow && onUpdateTarget ? (
                  <InlineTargetEditor exName={x.name} sets={rRow.sets} reps={rRow.reps} restSec={rRow.restSec} onSave={(s, r, rest) => onUpdateTarget(rIdx, s, r, rest)} />
                ) : !rRow && onAddToRoutine ? (
                  <button
                    type="button"
                    aria-label={`Añadir ${x.name} a la rutina`}
                    class="inline-flex min-h-[44px] items-center rounded-xl border border-electricBlue/40 bg-electricBlue/10 px-2.5 text-xs font-semibold text-electricBlue hover:bg-electricBlue/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue"
                    onClick={() => onAddToRoutine(x.name)}
                  >
                    + Añadir
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-label={`${open ? 'Contraer' : 'Expandir'} ${x.name}`}
                  class="flex h-11 w-9 items-center justify-center rounded-lg text-gray-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue"
                  onClick={() => onSelectEx(open ? '__closed__' : x.name)}
                >
                  <Icon name="caretDown" className={`h-4 w-4 transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180 text-white' : ''}`} />
                </button>
              </div>
            </div>
            {organizeMode && rRow && onMoveRow && onDeleteRow && (
              <div class="flex items-center justify-end gap-1.5 border-t border-white/5 px-3.5 py-2">
                <DayOrganizeControls exName={x.name} idx={rIdx} total={routineRows.length} compact onMoveRow={(i, dir) => {
                  const rects = captureFlipRects(listRef.current);
                  if (rects.size) pendingFlipRef.current = { rects, key: x.name };
                  onMoveRow(i, dir);
                }} onDeleteRow={onDeleteRow} />
              </div>
            )}
            <Collapsible open={open}>
              <div id={`day-mob-panel-${idx}`}>
                <DayExerciseDetail
                  exercise={x}
                  aiAdvice={advice}
                  userNote={userNotes[x.name]?.trim() ?? ''}
                  aiDate={aiDate}
                  canvasId={`c-day-mob-${idx}`}
                  historyLimit={8}
                  rangeLabel={rangeLabel}
                  chartConfig={mobileChartCfg}
                  embedded
                  onStartWorkout={onStartWorkout}
                  onEditNote={() => onEditNote(x.name)}
                />
              </div>
            </Collapsible>
          </div>
        );
      })}
    </div>
  );
}
