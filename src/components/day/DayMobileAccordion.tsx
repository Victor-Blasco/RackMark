import type { ChartConfiguration } from 'chart.js';
import type { ExStats } from '../../lib/analysis';
import { STATUS_STYLE } from '../../store/homeSelectors';
import type { AiEntry } from '../../types';
import { short } from '../../ui/shared';
import { Collapsible } from '../common/Collapsible';
import { Icon } from '../common/Icon';
import { DayExerciseDetail } from './DayExerciseDetail';

interface DayMobileAccordionProps {
  /** Lista de ejercicios visibles en la vista móvil. */
  exercises: ExStats[];
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
}

/** Acordeón móvil de ejercicios para pantallas pequeñas (`< lg`). */
export function DayMobileAccordion({
  exercises,
  mobileCur,
  rangeLabel,
  aiDate,
  userNotes,
  mobileChartCfg,
  aiFor,
  onSelectEx,
  onStartWorkout,
  onEditNote,
}: DayMobileAccordionProps) {
  return (
    <div class="lg:hidden space-y-3">
      {exercises.map((x) => {
        const open = x.name === mobileCur;
        const st = STATUS_STYLE[x.statusColor] ?? STATUS_STYLE.gray;
        const advice = aiFor(x);
        const summary = x.last
          ? `${short(x.last.date)} · ${x.last.sets.map((s) => `${s.w}×${s.r}`).join(' · ')}`
          : x.n === 0 && x.target
            ? `Objetivo ${x.target.sets}×${x.target.reps} · Sin estrenar`
            : `Sin registros en ${rangeLabel}`;
        return (
          <div key={x.name} class={`rounded-2xl border ${open ? 'border-electricBlue/60' : 'border-white/10'} bg-cardDark overflow-hidden`}>
            <button
              type="button"
              aria-expanded={open ? 'true' : 'false'}
              class="w-full p-4 text-left flex items-center justify-between gap-3 transition-colors hover:bg-white/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue"
              onClick={() => onSelectEx(open ? '__closed__' : x.name)}
            >
              <div class="min-w-0 space-y-1">
                <p class="text-sm font-bold text-white truncate">{x.name}</p>
                <p class="text-[13px] font-medium text-gray-300 tabular-nums truncate">{summary}</p>
              </div>
              <div class="shrink-0 flex items-center gap-2.5">
                <span class={`inline-flex items-center gap-1 text-[11px] font-bold ${st.text}`} title={advice?.status ?? x.status}>
                  <span class={`h-2 w-2 rounded-full ${st.dot}`} aria-hidden="true" />
                  <span aria-hidden="true">{st.glyph}</span>
                  <span class="sr-only">{advice?.status ?? x.status}</span>
                </span>
                <Icon
                  name="caretDown"
                  className={`h-4 w-4 text-gray-400 transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180 text-white' : ''}`}
                />
              </div>
            </button>
            <Collapsible open={open}>
              <DayExerciseDetail
                exercise={x}
                aiAdvice={advice}
                userNote={userNotes[x.name]?.trim() ?? ''}
                aiDate={aiDate}
                canvasId="c-day-mob"
                historyLimit={8}
                rangeLabel={rangeLabel}
                chartConfig={mobileChartCfg}
                embedded
                onStartWorkout={onStartWorkout}
                onEditNote={() => onEditNote(x.name)}
              />
            </Collapsible>
          </div>
        );
      })}
    </div>
  );
}
