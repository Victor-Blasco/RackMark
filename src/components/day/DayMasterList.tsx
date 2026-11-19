import type { ChartConfiguration } from 'chart.js';
import type { ExStats } from '../../lib/analysis';
import { STATUS_STYLE, type ExMetric } from '../../store/homeSelectors';
import type { AiEntry } from '../../types';
import { short } from '../../ui/shared';
import { DayExerciseDetail } from './DayExerciseDetail';
import { DayMobileAccordion } from './DayMobileAccordion';

interface DayMasterListProps {
  /** Nombre de la rutina mostrada. */
  day: string;
  /** Lista de ejercicios visibles según el ámbito seleccionado. */
  exercises: ExStats[];
  /** Ejercicio seleccionado actualmente en escritorio. */
  desktopCur?: string;
  /** Ejercicio desplegado actualmente en el acordeón móvil. */
  mobileCur?: string;
  /** Datos del ejercicio mostrado en el panel derecho de escritorio. */
  desktopEx?: ExStats;
  /** Config Chart.js para escritorio. */
  desktopChartCfg: ChartConfiguration | null;
  /** Config Chart.js para móvil. */
  mobileChartCfg: ChartConfiguration | null;
  /** Etiqueta del filtro temporal activo. */
  rangeLabel: string;
  /** Métrica de progresión seleccionada. */
  metric: ExMetric;
  /** Fecha de informe IA vigente. */
  aiDate?: string;
  /** Notas fijas del usuario por nombre de ejercicio. */
  userNotes: Record<string, string>;
  /** Resuelve consejo IA para cada ejercicio si aplica. */
  aiFor: (ex: ExStats) => AiEntry | undefined;
  /** Selecciona o repliega un ejercicio en lista o acordeón. */
  onSelectEx: (name: string) => void;
  /** Inicia entrenamiento en vivo de esta rutina. */
  onStartWorkout: () => void;
  /** Abre el modal de nota permanente. */
  onEditNote: (exName: string) => void;
  /** Cambia la métrica visualizada. */
  onChangeMetric: (m: ExMetric) => void;
}

const lastSummary = (x: ExStats, rangeLabel: string) => {
  if (x.last) return `${short(x.last.date)} · ${x.last.sets.map((s) => `${s.w}×${s.r}`).join(' · ')}`;
  if (x.n === 0 && x.target) return `Objetivo ${x.target.sets}×${x.target.reps} · Sin estrenar`;
  return `Sin registros en ${rangeLabel}`;
};

/**
 * Maestro-detalle adaptable: acordeón vertical en móvil y `role="listbox"` + panel fijo en escritorio.
 */
export function DayMasterList(props: DayMasterListProps) {
  const { day, exercises, desktopCur, desktopEx, desktopChartCfg, rangeLabel, metric, aiDate, userNotes, aiFor, onSelectEx, onStartWorkout, onEditNote, onChangeMetric } = props;

  const onOptionKeyDown = (e: KeyboardEvent, idx: number) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key) || !exercises.length) return;
    e.preventDefault();
    e.stopPropagation();
    const nextIdx = e.key === 'ArrowDown'
      ? (idx + 1) % exercises.length
      : e.key === 'ArrowUp'
        ? (idx - 1 + exercises.length) % exercises.length
        : e.key === 'Home' ? 0 : exercises.length - 1;
    const next = exercises[nextIdx];
    if (!next) return;
    onSelectEx(next.name);
    const el = document.getElementById(`day-opt-${nextIdx}`);
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: 'nearest' });
  };

  return (
    <>
      <DayMobileAccordion {...props} />

      <div class="hidden lg:grid lg:grid-cols-12 lg:gap-5 xl:gap-6 lg:items-start">
        <div
          class="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-6 space-y-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue rounded-2xl"
          role="listbox"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label={`Ejercicios de ${day}`}
          onKeyDown={(ev) => onOptionKeyDown(ev, Math.max(0, exercises.findIndex((x) => x.name === desktopCur)))}
        >
          {exercises.map((x, idx) => {
            const sel = x.name === desktopCur;
            const st = STATUS_STYLE[x.statusColor] ?? STATUS_STYLE.gray;
            const advice = aiFor(x);
            const rightMeta = x.target ? `${x.target.sets}×${x.target.reps}` : `${x.n} ses.`;
            return (
              <button
                type="button"
                key={x.name}
                id={`day-opt-${idx}`}
                role="option"
                tabIndex={sel ? 0 : -1}
                aria-selected={sel ? 'true' : 'false'}
                class={`w-full rounded-2xl border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${sel ? 'border-electricBlue bg-electricBlue/10' : 'border-white/10 bg-cardDark hover:border-white/25'}`}
                onClick={() => onSelectEx(x.name)}
                onKeyDown={(ev) => onOptionKeyDown(ev, idx)}
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="text-sm font-bold text-white truncate">{x.name}</span>
                  <span class={`inline-flex shrink-0 items-center gap-1 text-[11px] font-bold ${st.text}`} title={advice?.status ?? x.status}>
                    <span class={`h-2 w-2 rounded-full ${st.dot}`} aria-hidden="true" />
                    <span aria-hidden="true">{st.glyph}</span>
                    <span class="sr-only">{advice?.status ?? x.status}</span>
                  </span>
                </div>
                <div class="mt-1 flex items-center justify-between gap-2 text-[13px] text-gray-300">
                  <span class="font-medium tabular-nums truncate">{lastSummary(x, rangeLabel)}</span>
                  <span class="shrink-0 font-semibold text-gray-200 tabular-nums">{rightMeta}</span>
                </div>
              </button>
            );
          })}
        </div>
        <div class="lg:col-span-7 xl:col-span-8 lg:sticky lg:top-6">
          {desktopEx && (
            <DayExerciseDetail
              exercise={desktopEx}
              aiAdvice={aiFor(desktopEx)}
              userNote={userNotes[desktopEx.name]?.trim() ?? ''}
              aiDate={aiDate}
              canvasId="c-day"
              historyLimit={20}
              rangeLabel={rangeLabel}
              metric={metric}
              chartConfig={desktopChartCfg}
              onStartWorkout={onStartWorkout}
              onEditNote={() => onEditNote(desktopEx.name)}
              onChangeMetric={onChangeMetric}
            />
          )}
        </div>
      </div>
    </>
  );
}
