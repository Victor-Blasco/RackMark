import { isCountedSet, isoWeekStart } from '../lib/analysis';
import { daysAgoIso, todayIso } from '../lib/seed';
import { r1, short, type State } from '../ui/shared';
import { monthList } from './adherenceCalendar';

export interface PhaseBlock {
  id: string;
  name: string;
  start: string;
  end: string;
  color: string;
  isFree?: boolean;
}

export interface PhaseLiftDelta {
  name: string;
  deltaPct: number;
  label: string;
}

export interface PhaseAnalyticsModel {
  blocks: PhaseBlock[];
  active: PhaseBlock;
  rangeLabel: string;
  weightDeltaLabel: string;
  weightSubLabel: string;
  daysPerWeekLabel: string;
  sessionsCount: number;
  adherencePct: number;
  avgWeeklySetsLabel: string;
  weeklyBars: number[];
  avgStrengthPct: number | null;
  upCount: number;
  stableCount: number;
  downCount: number;
  lifts: PhaseLiftDelta[];
  trainedDates: Set<string>;
  months: string[];
  defaultMonthIdx: number;
  today: string;
  phaseForDate: (iso: string) => PhaseBlock | undefined;
}

const phaseColorFor = (name: string): string => {
  if (/defini|cut|baja|descarga/i.test(name)) return '#F59E0B';
  if (/recomp/i.test(name)) return '#38BDF8';
  if (/volum|bulk|hipertrof/i.test(name)) return '#2DD4BF';
  if (/fuerz|strength|peaking/i.test(name)) return '#A855F7';
  return '#94A3A8';
};

const prevIsoDay = (iso: string): string => {
  const ms = Date.parse(`${iso}T00:00:00Z`);
  return Number.isFinite(ms) ? new Date(ms - 864e5).toISOString().slice(0, 10) : iso;
};

/**
 * Calcula los bloques de fases, las métricas neutras (peso/cintura, constancia,
 * volumen semanal y fuerza) y los meses del calendario *lowkey* para `<PhaseAnalyticsPanel />`.
 */
export function buildPhaseAnalytics(state: State, selectedId?: string): PhaseAnalyticsModel {
  const today = todayIso();
  const sortedPhases = [...state.settings.phases].sort((a, b) => a.start.localeCompare(b.start));
  const realBlocks: PhaseBlock[] = sortedPhases.map((p, i) => {
    const nextStart = sortedPhases[i + 1]?.start;
    const end = nextStart ? prevIsoDay(nextStart) : today;
    return {
      id: `${p.start}:${p.name}`,
      name: p.name,
      start: p.start,
      end: end >= p.start ? end : p.start,
      color: phaseColorFor(p.name),
    };
  });

  const freeBlock: PhaseBlock = {
    id: '__free__',
    name: 'Sin fase (90d)',
    start: daysAgoIso(90),
    end: today,
    color: '#64748B',
    isFree: true,
  };

  const blocks = [...realBlocks, freeBlock];
  const currentActive = [...realBlocks].reverse().find((b) => b.start <= today) ?? freeBlock;
  const active = blocks.find((b) => b.id === selectedId) ?? currentActive;
  const rangeLabel = `${short(active.start)} – ${active.end === today ? 'Hoy' : short(active.end)}`;

  // Peso y cintura
  const msInRange = state.measures
    .filter((m) => m.date >= active.start && m.date <= active.end)
    .sort((a, b) => a.date.localeCompare(b.date));
  const weights = msInRange.filter((m) => m.weight != null);
  const waists = msInRange.filter((m) => m.waist != null);
  let weightDeltaLabel = 'Sin datos';
  let weightSubLabel = 'Añade mediciones en Cuerpo';
  if (weights.length >= 2) {
    const dW = Math.round((weights[weights.length - 1].weight! - weights[0].weight!) * 10) / 10;
    weightDeltaLabel = `${dW > 0 ? '+' : dW < 0 ? '−' : ''}${r1(Math.abs(dW))} kg`;
    if (waists.length >= 2) {
      const dC = Math.round((waists[waists.length - 1].waist! - waists[0].waist!) * 10) / 10;
      weightSubLabel = `Cintura ${dC > 0 ? '+' : dC < 0 ? '−' : ''}${r1(Math.abs(dC))} cm`;
    } else {
      const spanDays = Math.max(7, Math.round((Date.parse(`${active.end}T00:00:00Z`) - Date.parse(`${active.start}T00:00:00Z`)) / 864e5));
      const rate = Math.round((dW / (spanDays / 7)) * 100) / 100;
      weightSubLabel = `${rate > 0 ? '+' : rate < 0 ? '−' : ''}${r1(Math.abs(rate))} kg/sem`;
    }
  } else if (weights.length === 1) {
    weightDeltaLabel = `${r1(weights[0].weight!)} kg`;
    weightSubLabel = '1 registro en el bloque';
  }

  // Constancia y días entrenados
  const trainedDates = new Set<string>();
  state.analysis.sessions.forEach((s) => trainedDates.add(s.date));
  state.cardio.forEach((c) => trainedDates.add(c.date));
  const sessInRange = state.analysis.sessions.filter((s) => s.date >= active.start && s.date <= active.end);
  const sessionsCount = sessInRange.length;
  const spanDays = Math.max(7, Math.round((Date.parse(`${active.end}T00:00:00Z`) - Date.parse(`${active.start}T00:00:00Z`)) / 864e5) + 1);
  const weeksCount = Math.max(1, spanDays / 7);
  const dpw = sessionsCount / weeksCount;
  const targetDpw = Math.max(1, state.settings.profile.daysPerWeek ?? 4);
  const adherencePct = Math.min(100, Math.round((dpw / targetDpw) * 100));

  // Volumen semanal efectivo (isCountedSet)
  const setsByWeek = new Map<string, number>();
  for (const r of state.strength) {
    if (r.date < active.start || r.date > active.end) continue;
    const n = r.sets.filter((s) => s.r > 0 && isCountedSet(s)).length;
    if (!n) continue;
    const wk = isoWeekStart(r.date);
    setsByWeek.set(wk, (setsByWeek.get(wk) ?? 0) + n);
  }
  const weekVals = [...setsByWeek.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  const avgWeeklySets = weekVals.length ? Math.round(weekVals.reduce((a, b) => a + b, 0) / weekVals.length) : 0;
  const weeklyBars = weekVals.slice(-6);

  // Fuerza en la etapa (variación e1RM %)
  const liftDeltas: PhaseLiftDelta[] = [];
  for (const ex of state.analysis.exercises.values()) {
    const inStage = ex.sessions.filter((s) => s.date >= active.start && s.date <= active.end && s.e1rm > 0);
    if (inStage.length < 2) continue;
    const first = inStage[0].e1rm;
    const last = inStage[inStage.length - 1].e1rm;
    if (first <= 0) continue;
    const deltaPct = Math.round(((last - first) / first) * 1000) / 10;
    const sign = deltaPct > 0 ? '+' : deltaPct < 0 ? '−' : '';
    liftDeltas.push({
      name: ex.name,
      deltaPct,
      label: `${sign}${r1(Math.abs(deltaPct))} % e1RM`,
    });
  }
  const avgStrengthPct = liftDeltas.length
    ? Math.round((liftDeltas.reduce((a, x) => a + x.deltaPct, 0) / liftDeltas.length) * 10) / 10
    : null;
  const upCount = liftDeltas.filter((x) => x.deltaPct > 1).length;
  const downCount = liftDeltas.filter((x) => x.deltaPct < -1).length;
  const stableCount = liftDeltas.length - upCount - downCount;
  const lifts = [...liftDeltas].sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct)).slice(0, 4);

  // Meses para el calendario
  const allDates = [
    ...realBlocks.flatMap((b) => [b.start, b.end]),
    active.start,
    active.end,
    today,
  ].sort();
  const minYm = (allDates[0] ?? today).slice(0, 7);
  const maxYm = (allDates[allDates.length - 1] ?? today).slice(0, 7);
  const months = monthList(minYm, maxYm);
  const targetYm = active.end.slice(0, 7);
  const foundIdx = months.indexOf(targetYm);
  const defaultMonthIdx = foundIdx >= 0 ? foundIdx : Math.max(0, months.length - 1);

  const phaseForDate = (iso: string): PhaseBlock | undefined =>
    realBlocks.find((b) => iso >= b.start && iso <= b.end);

  return {
    blocks,
    active,
    rangeLabel,
    weightDeltaLabel,
    weightSubLabel,
    daysPerWeekLabel: `${r1(dpw)} d/sem`,
    sessionsCount,
    adherencePct,
    avgWeeklySetsLabel: `${avgWeeklySets} ser/sem`,
    weeklyBars,
    avgStrengthPct,
    upCount,
    stableCount,
    downCount,
    lifts,
    trainedDates,
    months,
    defaultMonthIdx,
    today,
    phaseForDate,
  };
}
