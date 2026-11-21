import type { ChartConfiguration } from 'chart.js';
import { isoWeekStart } from '../lib/analysis';
import type { DayName } from '../types';
import { inRange, resolveRange, routineNames, short, todayIso, type DateBounds, type State } from '../ui/shared';
import { buildAdherenceCalendarData } from './adherenceCalendar';
import { weeksForBounds } from './volumeSelectors';

/**
 * Construye los KPIs, calendario mensual interactivo, gráficas de bienestar y cardio para `<AdherenceView />`.
 *
 * @param state - Estado global de la aplicación.
 * @returns Modelo derivado de constancia semanal, cardio, sueño y pasos.
 */
export function buildAdherenceViewModel(state: State) {
  const isEmpty = !state.strength.length && !state.cardio.length && !state.wellbeing.length;
  const hasStrength = state.strength.length > 0;
  const bounds = resolveRange(state, 'adherence', '1M');
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
  const cols = weeksForBounds(bounds, allDates, 12, 4, 104);

  const perWeek = new Map<string, number>();
  byDate.forEach((_, d) => {
    const w = isoWeekStart(d);
    perWeek.set(w, (perWeek.get(w) ?? 0) + 1);
  });
  const curWeek = isoWeekStart(todayIso());
  const completedCols = cols.length > 1 && cols[cols.length - 1] === curWeek ? cols.slice(0, -1) : cols;
  const avg = completedCols.reduce((a, w) => a + (perWeek.get(w) ?? 0), 0) / completedCols.length;
  let streak = 0;
  const curMs = Date.parse(`${curWeek}T00:00:00Z`);
  for (let i = 1; i <= 520; i++) {
    const wk = new Date(curMs - i * 7 * 864e5).toISOString().slice(0, 10);
    if ((perWeek.get(wk) ?? 0) < 3) break;
    streak++;
  }

  const effBounds: DateBounds = bounds;
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

  const calendar = buildAdherenceCalendarData(state, bounds, allDates);

  return {
    isEmpty,
    hasStrength,
    bounds,
    routines,
    calendar,
    avg,
    streak,
    counts,
    cardioCount: cardio.length,
    cardioDistKm,
    cardioDurMin,
    recentCardio,
    sleepChartCfg,
    stepsChartCfg,
  };
}
