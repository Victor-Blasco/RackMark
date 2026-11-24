import type { ChartConfiguration } from 'chart.js';
import type { ExStats } from '../../lib/analysis';
import { norm } from '../../lib/seed';
import { STATUS_STYLE } from '../../store/homeSelectors';
import type { AiEntry, RoutineEx } from '../../types';
import { short } from '../../ui/shared';
import { Collapsible } from '../common/Collapsible';
import { Icon } from '../common/Icon';
import { DayExerciseDetail } from './DayExerciseDetail';
import { DayOrganizeControls } from './DayOrganizeControls';
import { InlineTargetEditor } from './InlineTargetEditor';

interface DayMobileAccordionProps {
  /** Lista de ejercicios visibles en la vista móvil. */
  exercises: ExStats[];
  /** Filas planificadas reales de `settings.routines[day]` para edición directa. */
  routineRows?: RoutineEx[];
  /** Muestra botones de reordenamiento y borrado por fila. */
  organizeMode?: boolean;
  /** Nombre del ejercicio actualmente expandido. */
  mobileCur?: string;
  /** Etiqueta del rango temporal activo. */
  rangeLabel: string;
  /** Fecha del informe IA vigente. */
  aiDate?: string;
  /** Notas biomecánicas por ejercicio. */
  userNotes: Record<string, string>;
  /** Configuración Chart.js del detalle móvil abierto. */
  mobileChartCfg: ChartConfiguration | null;
  /** Resuelve consejo IA para un ejercicio. */
  aiFor: (ex: ExStats) => AiEntry | undefined;
  /** Selecciona o repliega un ejercicio en el acordeón. */
  onSelectEx: (name: string) => void;
  /** Inicia entreno en vivo de la rutina. */
  onStartWorkout: () => void;
  /** Abre el modal de nota fija. */
  onEditNote: (exName: string) => void;
  /** Guarda series × reps objetivo editadas in-situ. */
  onUpdateTarget?: (idx: number, setsRaw: string, repsRaw: string) => void;
  /** Mueve una fila arriba (`-1`) o abajo (`+1`). */
  onMoveRow?: (idx: number, dir: number) => void;
  /** Elimina una fila de la rutina. */
  onDeleteRow?: (idx: number) => void;
}

/** Acordeón móvil de ejercicios para pantallas pequeñas (`< lg`). */
export function DayMobileAccordion({
  exercises, routineRows = [], organizeMode = false, mobileCur, rangeLabel, aiDate, userNotes,
  mobileChartCfg, aiFor, onSelectEx, onStartWorkout, onEditNote, onUpdateTarget, onMoveRow, onDeleteRow,
}: DayMobileAccordionProps) {
  return (
    <div class="lg:hidden space-y-3">
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
          <div key={x.name} class={`rounded-2xl border ${open ? 'border-electricBlue/60' : 'border-white/10'} bg-cardDark overflow-hidden`}>
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
                {rRow && onUpdateTarget && (
                  <InlineTargetEditor exName={x.name} sets={rRow.sets} reps={rRow.reps} onSave={(s, r) => onUpdateTarget(rIdx, s, r)} />
                )}
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
                <DayOrganizeControls exName={x.name} idx={rIdx} total={routineRows.length} compact onMoveRow={onMoveRow} onDeleteRow={onDeleteRow} />
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
