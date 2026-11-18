import type { ChartConfiguration } from 'chart.js';
import { isoWeekStart } from '../lib/analysis';
import type { DayName } from '../types';
import {
  fmtDate,
  inRange,
  resolveRange,
  routineColor,
  routineNames,
  routineShort,
  short,
  type DateBounds,
  type State,
} from '../ui/shared';
import { weeksForBounds } from './volumeSelectors';

/**
 * Construye los KPIs, calendario heatmap, gráficas de bienestar y cardio para `<AdherenceView />`.
 *
 * @param state - Estado global de la aplicación.
 * @returns Modelo derivado de constancia semanal, cardio, sueño y pasos.
 */
export function buildAdherenceViewModel(state: State) {
  const isEmpty = !state.strength.length && !state.cardio.length && !state.wellbeing.length;
  const hasStrength = state.strength.length > 0;
  const bounds = resolveRange(state, 'adherence', '3M');
  const routines = routineNames(state.settings);
  const byDate = new Map<string, DayName | null>();
  state.analysis.sessions.forEach((s) => {
    if (!byDate.has(s.date) || s.day) byDate.set(s.date, s.day ?? byDate.get(s.date) ?? null);
  });

  const allDates = [
    ...state.analysis.sessions.map((s) => s.date),
    ...state.cardio.map((c) => c.date),
    ...state.wellbeing.map((w) => w.date),
  ];
  const cols = weeksForBounds(bounds, allDates, 12, 4, 26);
  const mobCols = cols.slice(-8);

  const perWeek = new Map<string, number>();
  byDate.forEach((_, d) => {
    const w = isoWeekStart(d);
    perWeek.set(w, (perWeek.get(w) ?? 0) + 1);
  });
  const completedCols = cols.length > 1 ? cols.slice(0, -1) : cols;
  const avg = completedCols.reduce((a, w) => a + (perWeek.get(w) ?? 0), 0) / completedCols.length;
  let streak = 0;
  for (let i = cols.length - 2; i >= 0 && (perWeek.get(cols[i]) ?? 0) >= 3; i--) streak++;

  const effBounds: DateBounds = { ...bounds, from: bounds.from ?? cols[0] };
  const counts: Record<string, number> = Object.fromEntries(routines.map((r) => [r, 0]));
  byDate.forEach((t, d) => {
    if (t && inRange(d, effBounds)) counts[t] = (counts[t] ?? 0) + 1;
  });

  const cardio = state.cardio.filter((c) => inRange(c.date, effBounds));
  const cardioDistKm = cardio.reduce((a, c) => a + c.distKm, 0);
  const cardioDurMin = cardio.reduce((a, c) => a + c.durMin, 0);
  const recentCardio = [...cardio].reverse().slice(0, 12);

  const wellScope = state.wellbeing.filter((w) => inRange(w.date, effBounds));
  const hasSleep = wellScope.some((w) => w.sleepMin != null || w.hrv != null);
  const hasSteps = wellScope.some((w) => w.steps != null);

  const sleepChartCfg: ChartConfiguration<'line'> | null = hasSleep
    ? {
        type: 'line',
        data: {
          labels: wellScope.map((w) => short(w.date)),
          datasets: [
            {
              label: 'Sueño (h)',
              data: wellScope.map((w) => (w.sleepMin != null ? Math.round((w.sleepMin / 60) * 10) / 10 : null)),
              borderColor: '#3B82F6',
              yAxisID: 'y',
              tension: 0.25,
              spanGaps: true,
            },
            {
              label: 'HRV (ms)',
              data: wellScope.map((w) => w.hrv ?? null),
              borderColor: '#10B981',
              yAxisID: 'y1',
              tension: 0.25,
              spanGaps: true,
            },
          ],
        },
        options: {
          interaction: { mode: 'index', intersect: false },
          scales: { y: { position: 'left' }, y1: { position: 'right', grid: { drawOnChartArea: false } } },
        },
      }
    : null;

  const stepsChartCfg: ChartConfiguration<'bar'> | null = hasSteps
    ? {
        type: 'bar',
        data: {
          labels: wellScope.map((w) => short(w.date)),
          datasets: [{ label: 'Pasos diarios', data: wellScope.map((w) => w.steps ?? 0), backgroundColor: '#F59E0B' }],
        },
      }
    : null;

  const buildCell = (weekIso: string, dayIdx: number) => {
    const d = new Date(`${weekIso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + dayIdx);
    const iso = d.toISOString().slice(0, 10);
    if (!byDate.has(iso)) {
      return {
        iso,
        bg: 'rgba(255,255,255,0.05)',
        label: `${fmtDate(iso)}: Sin sesión`,
        code: '',
      };
    }
    const day = byDate.get(iso);
    if (!day) {
      return {
        iso,
        bg: '#6B7280',
        label: `${fmtDate(iso)}: Otro entrenamiento`,
        code: '·',
      };
    }
    const rIdx = Math.max(0, routines.indexOf(day));
    return {
      iso,
      bg: routineColor(day, state.settings, rIdx),
      label: `${fmtDate(iso)}: ${day}`,
      code: routineShort(day),
    };
  };

  return {
    isEmpty,
    hasStrength,
    bounds,
    routines,
    cols,
    mobCols,
    avg,
    streak,
    counts,
    cardioCount: cardio.length,
    cardioDistKm,
    cardioDurMin,
    recentCardio,
    sleepChartCfg,
    stepsChartCfg,
    buildCell,
  };
}
