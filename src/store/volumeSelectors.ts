import type { ChartConfiguration } from 'chart.js';
import type { AthleteProfile } from '../types';
import { isoWeekStart, weeklyVolume } from '../lib/analysis';
import { MUSCLES } from '../lib/seed';
import { resolveRange, short, todayIso, type DateBounds, type State } from '../ui/shared';
import { chartAccentColor } from '../ui/theme';

/** Rango semanal óptimo de series efectivas según experiencia y días por semana del atleta. */
export function volumeRangeForProfile(profile?: Partial<AthleteProfile>): { min: number; max: number; isLightPlan: boolean } {
  const isLightPlan = profile?.experience === 'beginner' || (profile?.daysPerWeek != null && profile.daysPerWeek <= 3);
  return isLightPlan ? { min: 6, max: 16, isLightPlan: true } : { min: 8, max: 20, isLightPlan: false };
}

/** Genera el listado de inicios de semana ISO comprendidos en el rango temporal activo. */
export function weeksForBounds(
  bounds: DateBounds,
  dates: string[],
  defaultWeeks: number,
  minW = 4,
  maxW = 104,
): string[] {
  const today = todayIso();
  const endIso = bounds.to ?? today;
  const wk0 = isoWeekStart(endIso);
  let count = bounds.days ? Math.ceil(bounds.days / 7) : defaultWeeks;
  if (!bounds.days && bounds.from) {
    const diff = Math.round((Date.parse(`${endIso}T00:00:00Z`) - Date.parse(`${bounds.from}T00:00:00Z`)) / 864e5) + 1;
    if (Number.isFinite(diff) && diff > 0) count = Math.ceil(diff / 7);
  } else if (!bounds.from && !bounds.to && dates.length) {
    const earliest = dates.reduce((min, d) => (d < min ? d : min), dates[0]);
    const diff = Math.round((Date.parse(`${endIso}T00:00:00Z`) - Date.parse(`${earliest}T00:00:00Z`)) / 864e5) + 1;
    if (Number.isFinite(diff) && diff > 0) count = Math.ceil(diff / 7);
  }
  const n = Math.max(minW, Math.min(maxW, count));
  const weeks: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(`${wk0}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i * 7);
    weeks.push(d.toISOString().slice(0, 10));
  }
  return weeks;
}

/**
 * Construye el modelo derivado de la vista `Volumen semanal`.
 *
 * @param state - Estado global de la aplicación.
 * @returns Matriz semanal por músculo, semanas visibles y gráfica de tendencia.
 */
export function buildVolumeViewModel(state: State) {
  const hasStrength = state.strength.length > 0;
  const bounds = resolveRange(state, 'volume', '3M');
  const vol = weeklyVolume(state.strength, state.settings, bounds.from, bounds.to);
  const weeks = weeksForBounds(bounds, state.strength.map((s) => s.date), 12, 4, 104);
  const curWeek = isoWeekStart(todayIso());
  const hasCompletedHistory = weeks.slice(0, -1).some((w) => MUSCLES.some((m) => (vol.get(m)?.get(w) ?? 0) > 0));
  const summaryWeek =
    hasCompletedHistory && weeks.length > 1 && weeks[weeks.length - 1] === curWeek
      ? weeks[weeks.length - 2]
      : weeks[weeks.length - 1];
  const range = volumeRangeForProfile(state.settings.profile);
  const trained = MUSCLES.filter((m) => (vol.get(m)?.get(summaryWeek) ?? 0) > 0);
  let summaryText = `Semana del ${short(summaryWeek)}: sin sesiones registradas.`;
  if (trained.length > 0) {
    const optCount = trained.filter((m) => {
      const v = vol.get(m)?.get(summaryWeek) ?? 0;
      return v >= range.min && v <= range.max;
    }).length;
    const lowMuscles = trained.filter((m) => (vol.get(m)?.get(summaryWeek) ?? 0) < range.min);
    const highMuscles = trained.filter((m) => (vol.get(m)?.get(summaryWeek) ?? 0) > range.max);
    const prefix = summaryWeek === curWeek ? 'Esta semana (en curso)' : `Última semana completa (${short(summaryWeek)})`;
    summaryText = `${prefix}: ${optCount} de ${trained.length} grupos en rango óptimo (${range.min}–${range.max})`;
    if (lowMuscles.length) summaryText += ` · por debajo: ${lowMuscles.slice(0, 4).join(', ')}${lowMuscles.length > 4 ? '…' : ''}`;
    if (highMuscles.length) summaryText += ` · muy alto: ${highMuscles.join(', ')}`;
    summaryText += '.';
  }
  const sel = state.muscleSel || 'Pecho';
  const volChartCfg: ChartConfiguration<'bar'> = {
    type: 'bar',
    data: {
      labels: weeks.map(short),
      datasets: [
        {
          label: `Series efectivas · ${sel}`,
          data: weeks.map((w) => vol.get(sel)?.get(w) ?? 0),
          backgroundColor: chartAccentColor(),
        },
      ],
    },
  };

  return {
    hasStrength,
    muscles: MUSCLES,
    bounds,
    vol,
    weeks,
    curWeek,
    range,
    summaryText,
    sel,
    volChartCfg,
  };
}
