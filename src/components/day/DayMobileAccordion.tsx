import type { ChartConfiguration } from 'chart.js';
import type { ExStats } from '../../lib/analysis';
import { STATUS_STYLE, type ExMetric } from '../../store/homeSelectors';
import type { AiEntry } from '../../types';
import { short } from '../../ui/shared';
import { DayExerciseDetail } from './DayExerciseDetail';

interface DayMobileAccordionProps {
  /** Lista de ejercicios visibles en la vista móvil. */
  exercises: ExStats[];
  /** Nombre del ejercicio actualmente expandido. */
  mobileCur?: string;
  /** Etiqueta del rango temporal activo. */
  rangeLabel: string;
  /** Métrica seleccionada para la gráfica. */
  metric: ExMetric;
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
  /** Cambia la métrica visualizada. */
  onChangeMetric: (m: ExMetric) => void;
}

/** Acordeón móvil de ejercicios para pantallas pequeñas (`< lg`). */
export function DayMobileAccordion({
  exercises,
  mobileCur,
  rangeLabel,
  metric,
  aiDate,
  userNotes,
  mobileChartCfg,
  aiFor,
  onSelectEx,
  onStartWorkout,
  onEditNote,
  onChangeMetric,
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
              class="w-full p-4 text-left flex items-center justify-between gap-3 transition-colors hover:bg-white/[0.02]"
              onClick={() => onSelectEx(open ? '__closed__' : x.name)}
            >
              <div class="min-w-0 space-y-1">
                <p class="text-sm font-bold text-white truncate">{x.name}</p>
                <p class="text-[13px] font-medium text-gray-300 tabular-nums truncate">{summary}</p>
              </div>
              <div class="shrink-0 flex items-center gap-2.5">
                <span class={`h-2.5 w-2.5 rounded-full ${st.dot}`} title={advice?.status ?? x.status} />
                <span class="text-xs text-gray-400">{open ? '▲' : '▼'}</span>
              </div>
            </button>
            {open && (
              <DayExerciseDetail
                exercise={x}
                aiAdvice={advice}
                userNote={userNotes[x.name]?.trim() ?? ''}
                aiDate={aiDate}
                canvasId="c-day-mob"
                historyLimit={8}
                rangeLabel={rangeLabel}
                metric={metric}
                chartConfig={mobileChartCfg}
                embedded
                onStartWorkout={onStartWorkout}
                onEditNote={() => onEditNote(x.name)}
                onChangeMetric={onChangeMetric}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
