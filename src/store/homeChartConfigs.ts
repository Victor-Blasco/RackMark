import type { ChartConfiguration } from 'chart.js';
import { judge, type ExSession, type ExStats } from '../lib/analysis';
import type { Measure } from '../types';
import {
  inRange,
  movingAverage7dFor,
  r1,
  resolveRange,
  short,
  type DateBounds,
  type State,
} from '../ui/shared';
import { chartAccentColor } from '../ui/theme';

export const STATUS_STYLE: Record<ExStats['statusColor'], { dot: string; text: string; glyph: string }> = {
  emeraldGreen: { dot: 'bg-emeraldGreen', text: 'text-emerald-300', glyph: '↑' },
  electricBlue: { dot: 'bg-electricBlue', text: 'text-blue-300', glyph: '★' },
  amberGold: { dot: 'bg-amberGold', text: 'text-amber-300', glyph: '=' },
  coralRed: { dot: 'bg-coralRed', text: 'text-rose-300', glyph: '↓' },
  gray: { dot: 'bg-gray-500', text: 'text-gray-400', glyph: '—' },
};

/** Reduce el título largo de una sección del informe IA a una etiqueta corta de pestaña. */
export function aiStepLabel(title: string): string {
  if (/composici|cuerpo|antropo|peso|forma\s+f[ií]sica/i.test(title)) return 'Cuerpo';
  if (/rendimiento|fuerza|sobrecarga|ppl|progreso/i.test(title)) return 'Fuerza';
  if (/recuperaci|sueñ|suen|neat|card|descanso|pasos|energ[ií]a/i.test(title)) return 'Sueño y FC';
  if (/estrategia|mesociclo|próxim|proxim|plan/i.test(title)) return 'Plan';
  return title.split(/\s+/).slice(0, 2).join(' ');
}

/** Filtra las sesiones y recalcula máximos de un ejercicio dentro de `bounds`. */
export function filterExByRange(e: ExStats, bounds: DateBounds): ExStats {
  if (!bounds.from && !bounds.to) return e;
  const sessions = e.sessions.filter((s) => inRange(s.date, bounds));
  if (sessions.length === e.sessions.length) return e;
  const hrs = sessions.map((s) => s.avgHr).filter((h): h is number => h != null);
  const maxHrs = sessions.map((s) => s.maxHr).filter((h): h is number => h != null);
  const verdict = sessions.length ? judge(e.name, sessions, e.target) : { status: 'Sin datos', statusColor: 'gray' as const, prescription: 'Sin registros en este periodo.' };
  return {
    ...e,
    sessions,
    n: sessions.length,
    last: sessions[sessions.length - 1],
    maxWeight: sessions.length ? Math.max(...sessions.map((s) => s.top)) : 0,
    maxE1rm: sessions.length ? Math.max(...sessions.map((s) => s.e1rm)) : 0,
    avgHr: hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : undefined,
    maxHr: maxHrs.length ? Math.max(...maxHrs) : undefined,
    ...verdict,
  };
}

/** Obtiene el último valor y el anterior comparable para una métrica corporal. */
export function lastMetric(ms: Measure[], hasFilter: boolean, key: keyof Measure) {
  const vals = ms.filter((m) => typeof m[key] === 'number');
  const cur = vals[vals.length - 1];
  const prev = hasFilter ? (vals.length > 1 ? vals[0] : undefined) : vals[vals.length - 2];
  return {
    val: cur?.[key] as number | undefined,
    prev: prev?.[key] as number | undefined,
    date: cur?.date,
  };
}

/** Configura la gráfica de carga (o repeticiones si es de peso corporal `0 kg`). */
export function exerciseChartConfig(sessions: ExSession[], color: string): ChartConfiguration<'line'> {
  const allBw = sessions.length > 0 && sessions.every((x) => x.top === 0);
  return {
    type: 'line',
    data: {
      labels: sessions.map((x) => short(x.date)),
      datasets: [
        { label: allBw ? 'Reps máx' : 'Peso máx (kg)', data: sessions.map((x) => (allBw ? x.repsAtTop : x.top)), borderColor: color, backgroundColor: color, borderWidth: 2.5, tension: 0.25, yAxisID: 'y' },
        { label: allBw ? 'Reps totales' : 'Kilos totales (kg)', data: sessions.map((x) => (allBw ? x.sets.reduce((a, s) => a + s.r, 0) : Math.round(x.volume))), borderColor: '#94A3A8', backgroundColor: '#94A3A8', borderDash: [4, 3], borderWidth: 1.75, tension: 0.25, yAxisID: 'y1' },
      ],
    },
    options: {
      animation: { duration: 320, easing: 'easeOutCubic' },
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: { position: 'left', display: 'auto' },
        y1: { position: 'right', display: 'auto', grid: { drawOnChartArea: false } },
      },
      plugins: {
        tooltip: {
          callbacks: {
            title: (items) => {
              const s = items[0] ? sessions[items[0].dataIndex] : undefined;
              return s ? `${s.date.slice(8, 10)}/${s.date.slice(5, 7)}/${s.date.slice(0, 4)}` : '';
            },
            label: (ctx) => {
              const s = sessions[ctx.dataIndex];
              if (!s) return '';
              if (allBw) return ctx.datasetIndex === 0 ? `Reps máx: ${s.repsAtTop}` : `Reps totales: ${s.sets.reduce((a, x) => a + x.r, 0)}`;
              return ctx.datasetIndex === 0 ? `Peso máx: ${r1(s.top)} kg` : `Kilos totales: ${Math.round(s.volume)} kg`;
            },
            afterBody: (items) => {
              const s = items[0] ? sessions[items[0].dataIndex] : undefined;
              return s ? [`Series: ${s.sets.map((x) => `${r1(x.w)}×${x.r}`).join(' · ')}`] : [];
            },
          },
        },
      },
    },
  };
}

/** Construye la configuración de composición corporal para Resumen evitando crear eje `y1` si falta dato. */
export function buildBodyHomeChartConfig(ms: Measure[], allMeasures?: Measure[]): ChartConfiguration<'line'> | null {
  const mm = ms.filter((m) => m.weight != null || m.bf != null);
  if (!mm.length) return null;
  const hasWeight = mm.some((m) => m.weight != null);
  const hasBf = mm.some((m) => m.bf != null);
  const datasets: ChartConfiguration<'line'>['data']['datasets'] = [];
  if (hasWeight) {
    const accent = chartAccentColor();
    datasets.push(
      { label: 'Tendencia 7d (kg)', data: movingAverage7dFor(mm, allMeasures), borderColor: accent, backgroundColor: accent, borderWidth: 2.5, pointRadius: 0, yAxisID: 'y', tension: 0.3, spanGaps: true },
      { label: 'Peso diario (kg)', data: mm.map((m) => m.weight ?? null), borderColor: 'rgba(148,163,168,0.55)', backgroundColor: 'rgba(148,163,168,0.65)', borderDash: [3, 3], borderWidth: 1.5, pointRadius: 2, yAxisID: 'y', tension: 0.2, spanGaps: true },
    );
  }
  if (hasBf) {
    datasets.push({ label: '% Grasa', data: mm.map((m) => m.bf ?? null), borderColor: '#F59E0B', backgroundColor: '#F59E0B', yAxisID: hasWeight ? 'y1' : 'y', tension: 0.25, spanGaps: true });
  }
  return {
    type: 'line',
    data: { labels: mm.map((m) => short(m.date)), datasets },
    options: { scales: hasWeight && hasBf ? { y: { position: 'left' }, y1: { position: 'right', grid: { drawOnChartArea: false } } } : { y: { position: 'left' } } },
  };
}

/** Devuelve la lista priorizada de ejercicios disponibles en la vista Resumen. */
export function homeExercises(state: State): ExStats[] {
  return [...state.analysis.exercises.values()]
    .filter((e) => e.day || e.sessions.length > 0)
    .sort((a, b) => Number(Boolean(b.day)) - Number(Boolean(a.day)) || b.n - a.n);
}

/** Construye la configuración de progresión del ejercicio seleccionado en Resumen. */
export function buildHomeExChartConfig(state: State): ChartConfiguration<'line'> | null {
  const bounds = resolveRange(state, 'home');
  const ex = homeExercises(state);
  const cur = state.sel.home && state.analysis.exercises.has(state.sel.home) ? state.sel.home : ex[0]?.name;
  const curEx = cur ? filterExByRange(state.analysis.exercises.get(cur)!, bounds) : undefined;
  return curEx && curEx.sessions.length ? exerciseChartConfig(curEx.sessions, chartAccentColor()) : null;
}
