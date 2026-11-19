import type { ChartConfiguration } from 'chart.js';
import type { ExStats } from '../../lib/analysis';
import type { ExMetric } from '../../store/homeSelectors';
import type { AiEntry } from '../../types';
import { fmtDate, r1, short } from '../../ui/shared';
import { ChartCanvas } from '../common/ChartCanvas';
import { Icon } from '../common/Icon';
import { ExMetricToggle, StatusInline } from '../common/StatusBadge';

interface DayExerciseDetailProps {
  /** Estadísticas del ejercicio seleccionado. */
  exercise: ExStats;
  /** Consejo IA vigente (si existe y no hay filtro temporal activo). */
  aiAdvice?: AiEntry;
  /** Nota biomecánica permanente guardada por el usuario. */
  userNote: string;
  /** Fecha de emisión del informe IA (para etiquetar la prescripción). */
  aiDate?: string;
  /** Identificador DOM del `<canvas>` de gráfica. */
  canvasId: string;
  /** Máximo de sesiones recientes mostradas en la lista inferior. */
  historyLimit: number;
  /** Etiqueta del periodo temporal activo. */
  rangeLabel: string;
  /** Métrica de gráfica activa (`top`, `e1rm` o `volume`). */
  metric: ExMetric;
  /** Configuración Chart.js ya construida para este ejercicio. */
  chartConfig: ChartConfiguration | null;
  /** Indica si se muestra embebido dentro del acordeón móvil (`true`) o en tarjeta derecha (`false`). */
  embedded?: boolean;
  /** Inicia el entrenamiento en vivo de la rutina asociada. */
  onStartWorkout: () => void;
  /** Abre el modal de nota permanente para este ejercicio. */
  onEditNote: () => void;
  /** Cambia la métrica visualizada en la gráfica. */
  onChangeMetric: (metric: ExMetric) => void;
}

/** Panel maestro-detalle de un ejercicio concreto dentro de una rutina. */
export function DayExerciseDetail(props: DayExerciseDetailProps) {
  const { exercise: e, aiAdvice, userNote, aiDate, canvasId, historyLimit, rangeLabel, metric, chartConfig, embedded = false, onStartWorkout, onEditNote, onChangeMetric } = props;
  const aiBiomech = aiAdvice?.biomech?.trim() ?? '';
  const recent = [...e.sessions].reverse().slice(0, historyLimit);
  const prescLabel = aiAdvice?.prescription && aiDate ? `Próxima sesión · IA (${short(aiDate)})` : 'Próxima sesión';
  const kpis = [
    { lbl: 'Peso máx', val: e.n ? `${e.maxWeight} kg` : '—', cls: 'text-white' },
    { lbl: 'e1RM pico', val: e.n ? `${r1(e.maxE1rm)} kg` : '—', cls: 'text-white' },
    { lbl: 'FC media', val: e.avgHr ? `${e.avgHr} lpm` : '—', cls: 'text-cyan-300' },
  ];

  return (
    <div class={embedded ? 'border-t border-white/10 bg-embedDark p-4 space-y-4' : 'rounded-2xl border border-white/10 bg-cardDark p-4 sm:p-5 space-y-5'}>
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          {!embedded && <h3 class="text-lg font-extrabold text-white">{e.name}</h3>}
          <div class={`flex flex-wrap items-center gap-x-3 gap-y-1 ${embedded ? '' : 'mt-1'}`}>
            <StatusInline stats={e} aiStatus={aiAdvice?.status} />
            <span class="text-xs text-gray-400 tabular-nums">Objetivo {e.target ? `${e.target.sets}×${e.target.reps}` : '—'} · {e.n} sesiones</span>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="btn-primary-sm" onClick={onStartWorkout}>Entrenar hoy</button>
          <button type="button" class="btn-sm" onClick={onEditNote}><Icon name="edit" className="h-3.5 w-3.5" /> Nota</button>
        </div>
      </div>

      <div class="border-l-2 border-emeraldGreen pl-3.5 py-0.5">
        <p class="text-xs font-semibold uppercase tracking-wider text-emerald-400">{prescLabel}</p>
        <p class="mt-1 text-sm sm:text-[15px] text-gray-100 leading-relaxed">{aiAdvice?.prescription ?? e.prescription}</p>
      </div>

      <div class="grid grid-cols-3 gap-3 border-y border-white/5 py-3">
        {kpis.map((k) => (
          <div key={k.lbl}>
            <span class="block text-xs text-gray-400">{k.lbl}</span>
            <span class={`mt-0.5 block text-base sm:text-lg font-bold tabular-nums ${k.cls}`}>{k.val}</span>
          </div>
        ))}
      </div>

      <div class="space-y-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-xs font-semibold text-gray-400">Progresión · toca un punto para ver repes, e1RM y pulso</p>
          <ExMetricToggle active={metric} onChange={onChangeMetric} />
        </div>
        {chartConfig
          ? <div class="chart-box"><ChartCanvas id={canvasId} config={chartConfig} /></div>
          : <p class="py-8 text-center text-sm text-gray-400">Sin registros para este ejercicio en {rangeLabel}.</p>}
      </div>

      {e.last?.note && (
        <p class="flex items-start gap-2 text-xs sm:text-sm text-amberGold">
          <Icon name="note" className="h-4 w-4 mt-0.5" />
          <span>Última nota: {e.last.note}</span>
        </p>
      )}
      {userNote && (
        <p class="text-xs sm:text-sm text-gray-200 leading-relaxed"><span class="font-semibold text-white">Nota fija:</span> {userNote}</p>
      )}
      {aiBiomech && aiBiomech !== userNote && (
        <p class="text-xs sm:text-sm text-gray-300 leading-relaxed"><span class="font-semibold text-gray-200">Biomecánica (IA):</span> {aiBiomech}</p>
      )}

      {recent.length > 0 && (
        <div class="space-y-2 pt-2 border-t border-white/10">
          <p class="text-xs font-semibold uppercase tracking-wider text-gray-400">Últimas sesiones</p>
          <div class="divide-y divide-white/10">
            {recent.map((x) => (
              <div key={`${x.date}-${x.sets.length}`} class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 text-sm">
                <span class="font-medium text-gray-300 tabular-nums">{fmtDate(x.date)}</span>
                <span class="font-semibold text-gray-100 tabular-nums">{x.sets.map((s) => `${s.w}×${s.r}`).join(' · ')}</span>
                {(x.avgHr != null || x.durMin != null) && (
                  <span class="text-[13px] text-gray-400 tabular-nums">
                    {x.avgHr ? <span class="text-cyan-300">{Math.round(x.avgHr)}{x.maxHr ? `/${Math.round(x.maxHr)}` : ''} lpm</span> : null}
                    {x.avgHr && x.durMin ? ' · ' : ''}
                    {x.durMin ? `${Math.round(x.durMin)}m` : ''}
                  </span>
                )}
                {x.note && <span class="w-full text-xs text-amberGold">{x.note}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
