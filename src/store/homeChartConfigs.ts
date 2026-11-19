import type { ChartConfiguration } from 'chart.js';
import type { ExSession, ExStats } from '../lib/analysis';
import type { Measure } from '../types';
import {
  inRange,
  movingAverage7d,
  r1,
  resolveRange,
  short,
  type DateBounds,
  type State,
} from '../ui/shared';

export type ExMetric = 'top' | 'e1rm' | 'volume';

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
  return {
    ...e,
    sessions,
    n: sessions.length,
    last: sessions[sessions.length - 1],
    maxWeight: sessions.length ? Math.max(...sessions.map((s) => s.top)) : 0,
    maxE1rm: sessions.length ? Math.max(...sessions.map((s) => s.e1rm)) : 0,
    avgHr: hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : undefined,
    maxHr: maxHrs.length ? Math.max(...maxHrs) : undefined,
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

/** Configura la gráfica de carga (`Peso máx`, `e1RM` o `Tonelaje`) en un único eje Y. */
export function exerciseChartConfig(
  sessions: ExSession[],
  color: string,
  metric: ExMetric = 'top',
): ChartConfiguration<'line'> {
  const label = metric === 'e1rm' ? 'e1RM est. (kg)' : metric === 'volume' ? 'Tonelaje (kg)' : 'Peso máx (kg)';
  const data = sessions.map((x) =>
    metric === 'e1rm' ? Math.round(x.e1rm * 10) / 10 : metric === 'volume' ? Math.round(x.volume) : x.top,
  );
  return {
    type: 'line',
    data: { labels: sessions.map((x) => short(x.date)), datasets: [{ label, data, borderColor: color, backgroundColor: color, tension: 0.25, yAxisID: 'y' }] },
    options: {
      animation: { duration: 320, easing: 'easeOutCubic' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        tooltip: {
          callbacks: {
            title: (items) => {
              const s = items[0] ? sessions[items[0].dataIndex] : undefined;
              return s ? `${s.date.slice(8, 10)}/${s.date.slice(5, 7)}/${s.date.slice(0, 4)}` : '';
            },
            label: (ctx) => {
              const s = sessions[ctx.dataIndex];
              return s ? `Peso máx: ${r1(s.top)} kg × ${s.repsAtTop} · e1RM: ${r1(s.e1rm)} kg · Tonelaje: ${Math.round(s.volume)} kg` : '';
            },
            afterBody: (items) => {
              const s = items[0] ? sessions[items[0].dataIndex] : undefined;
              if (!s) return [];
              const lines = [`Series: ${s.sets.map((x) => `${x.w}×${x.r}`).join(' · ')}`];
              if (s.avgHr != null) lines.push(`FC media: ${Math.round(s.avgHr)} lpm${s.maxHr ? ` (máx ${Math.round(s.maxHr)})` : ''}`);
              return lines;
            },
          },
        },
      },
    },
  };
}

/** Construye la configuración de composición corporal para Resumen evitando crear eje `y1` si falta dato. */
export function buildBodyHomeChartConfig(ms: Measure[]): ChartConfiguration<'line'> | null {
  const mm = ms.filter((m) => m.weight != null || m.bf != null);
  if (!mm.length) return null;
  const hasWeight = mm.some((m) => m.weight != null);
  const hasBf = mm.some((m) => m.bf != null);
  const datasets: ChartConfiguration<'line'>['data']['datasets'] = [];
  if (hasWeight) {
    datasets.push(
      { label: 'Tendencia 7d (kg)', data: movingAverage7d(mm), borderColor: '#3B82F6', backgroundColor: '#3B82F6', borderWidth: 2.5, pointRadius: 0, yAxisID: 'y', tension: 0.3, spanGaps: true },
      { label: 'Peso diario (kg)', data: mm.map((m) => m.weight ?? null), borderColor: 'rgba(59,130,246,0.38)', backgroundColor: 'rgba(59,130,246,0.5)', borderDash: [3, 3], borderWidth: 1.5, pointRadius: 2, yAxisID: 'y', tension: 0.2, spanGaps: true },
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
  return curEx && curEx.sessions.length ? exerciseChartConfig(curEx.sessions, '#3B82F6', state.exMetric ?? 'top') : null;
}
