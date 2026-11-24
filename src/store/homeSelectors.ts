import { currentPhase } from '../lib/analysis';
import { daysAgoIso, diffIsoDays } from '../lib/seed';
import type { AiTone, DayName, Measure } from '../types';
import {
  findAiExercise,
  inRange,
  isAiFreshForEx,
  r1,
  resolveRange,
  routineColor,
  routineNames,
  routineShort,
  short,
  todayIso,
  weightDeltaColor,
  type DateBounds,
  type State,
} from '../ui/shared';
import { buildAiReportViewModel } from './aiReportSelectors';
import {
  STATUS_STYLE,
  aiStepLabel,
  buildBodyHomeChartConfig,
  buildHomeExChartConfig,
  exerciseChartConfig,
  filterExByRange,
  homeExercises,
  lastMetric,
} from './homeChartConfigs';

export {
  STATUS_STYLE,
  aiStepLabel,
  buildAiReportViewModel,
  buildBodyHomeChartConfig,
  buildHomeExChartConfig,
  exerciseChartConfig,
  filterExByRange,
  homeExercises,
  lastMetric,
};

const delta = (a?: number, b?: number, u = '') => (a != null && b != null ? `${a - b >= 0 ? '+' : ''}${r1(a - b)}${u}` : '');
const mean = (vals: (number | undefined)[]) => {
  const nums = vals.filter((v): v is number => v != null && Number.isFinite(v));
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : undefined;
};

function buildExVerdict(state: State, cur: string | undefined, bounds: DateBounds): string | undefined {
  if (!cur) return undefined;
  const ex = state.analysis.exercises.get(cur);
  if (!ex) return undefined;
  const sessions = filterExByRange(ex, bounds).sessions;
  if (!sessions.length) return undefined;
  if (sessions.length === 1) return 'Solo 1 sesión en este rango';
  const first = sessions[0];
  const last = sessions[sessions.length - 1];
  if (first.top === 0 && last.top === 0) {
    const dR = last.repsAtTop - first.repsAtTop;
    if (dR > 0) return `+${dR} reps al inicio de serie en este periodo`;
    if (dR < 0) return `${dR} reps respecto al inicio del periodo`;
    return 'Repeticiones estables en este periodo';
  }
  const dW = Math.round((last.top - first.top) * 10) / 10;
  if (dW > 0) return `+${r1(dW)} kg en tu máximo en este periodo`;
  if (dW < 0) return `−${r1(Math.abs(dW))} kg en tu máximo en este periodo`;
  const dR = last.repsAtTop - first.repsAtTop;
  if (dR !== 0) return `Mismo peso (${dR > 0 ? `+${dR}` : dR} reps) en este periodo`;
  return 'Carga estable en este periodo';
}

function buildBodyVerdict(ms: Measure[]): string | undefined {
  const ws = ms.filter((m): m is Measure & { weight: number } => m.weight != null);
  if (!ws.length) return undefined;
  if (ws.length === 1) return `Último peso registrado: ${r1(ws[0].weight)} kg`;
  const dW = Math.round((ws[ws.length - 1].weight - ws[0].weight) * 10) / 10;
  if (dW === 0) return 'Peso corporal estable en este periodo';
  return `${dW > 0 ? '+' : '−'}${r1(Math.abs(dW))} kg de peso en este periodo`;
}

function resolveFourthMetric(state: State, ms: Measure[], rangeLabel: string, hasFilter: boolean, bounds: DateBounds) {
  const since28 = daysAgoIso(28);
  const since7 = daysAgoIso(7);
  const wScope = hasFilter ? state.wellbeing.filter((w) => inRange(w.date, bounds)) : state.wellbeing.filter((w) => w.date >= since7);
  const wBaseline = hasFilter ? wScope : state.wellbeing.filter((w) => w.date >= since28);
  const sessScope = hasFilter ? state.analysis.sessions.filter((x) => inRange(x.date, bounds)) : state.analysis.sessions.filter((x) => x.date >= since28);
  const hrForce = mean(sessScope.map((x) => x.avgHr));
  if (!(state.wellbeing.length > 0 || wBaseline.length > 0 || hrForce != null)) {
    return { lbl: `Medidas (${rangeLabel})`, val: String(ms.length), sub: ms[ms.length - 1] ? ` · última ${short(ms[ms.length - 1].date)}` : '', cls: 'text-blue-300' };
  }
  const scopeLbl = hasFilter ? rangeLabel : '7d';
  const sleepMain = mean(wScope.map((w) => (w.sleepMin != null ? w.sleepMin / 60 : undefined)));
  const stepsMain = mean(wScope.map((w) => w.steps));
  if (sleepMain != null || stepsMain != null) {
    const stepsText = stepsMain != null ? ` · ${stepsMain >= 1000 ? `${r1(stepsMain / 1000)}k` : Math.round(stepsMain)}` : '';
    return { lbl: `Sueño / Pasos (${scopeLbl})`, val: sleepMain != null ? `${r1(sleepMain)} h` : '—', sub: stepsText, cls: 'text-blue-300' };
  }
  const rhrMain = mean(wScope.map((w) => w.rhr));
  const hrvMain = mean(wScope.map((w) => w.hrv));
  const val = rhrMain != null ? `${Math.round(rhrMain)} lpm` : hrForce != null ? `${Math.round(hrForce)} lpm` : '—';
  const sub = hrvMain != null ? ` · HRV ${Math.round(hrvMain)}` : hrForce != null && rhrMain != null ? ` · fuerza ${Math.round(hrForce)}` : '';
  return { lbl: `Pulso (${scopeLbl})`, val, sub, cls: 'text-cyan-300' };
}

/** Construye todos los KPIs, series de gráficas y tabla de cargas para `<HomeView />`. */
export function buildHomeViewModel(state: State) {
  const isOnboarding = !state.strength.length && !state.cardio.length;
  const bounds = resolveRange(state, 'home');
  const hasFilter = Boolean(bounds.from || bounds.to);
  const ms = hasFilter ? state.measures.filter((m) => inRange(m.date, bounds)) : state.measures;
  const mWeight = lastMetric(ms, hasFilter, 'weight');
  const mBf = lastMetric(ms, hasFilter, 'bf');
  const mMuscle = lastMetric(ms, hasFilter, 'muscle');
  const mWaist = lastMetric(ms, hasFilter, 'waist');
  const sessAll = state.analysis.sessions;
  const sess = hasFilter ? sessAll.filter((x) => inRange(x.date, bounds)) : sessAll;
  const lastS = sess[sess.length - 1];
  const since28 = daysAgoIso(28);
  const activeDays = new Set((hasFilter ? sess : sess.filter((x) => x.date >= since28)).map((x) => x.date)).size;
  const rangeEnd = bounds.to ?? todayIso();
  const diffDays = bounds.days ?? (hasFilter && bounds.from ? Math.max(7, diffIsoDays(bounds.from, rangeEnd)) : 28);
  const weeks = Math.max(1, diffDays / 7);
  const phase = currentPhase(state.settings);
  const fourthMetric = resolveFourthMetric(state, ms, bounds.label, hasFilter, bounds);
  const ex = homeExercises(state);
  const cur = state.sel.home && state.analysis.exercises.has(state.sel.home) ? state.sel.home : ex[0]?.name;
  const routines = routineNames(state.settings);
  const rows = routines.flatMap((d, idx) =>
    (state.analysis.byDay[d] ?? []).map((e) => {
      const filtered = filterExByRange(e, bounds);
      const aiStatus = isAiFreshForEx(state, state.analysis.exercises.get(filtered.name) ?? filtered) ? findAiExercise(state.settings.ai, filtered.name)?.status : undefined;
      return { d: d as DayName, c: routineColor(d, state.settings, idx), e: filtered, aiStatus };
    }),
  );
  return {
    isOnboarding,
    bounds,
    hasFilter,
    ms,
    mWeight,
    mBf,
    mMuscle,
    mWaist,
    wDelta: delta(mWeight.val, mWeight.prev, ''),
    wDeltaCls: mWeight.val != null && mWeight.prev != null ? weightDeltaColor(mWeight.val - mWeight.prev, phase?.name) : 'text-emerald-400',
    bfDelta: delta(mBf.val, mBf.prev, '%'),
    lastS,
    activeDays,
    weeks,
    phase,
    lastDayHex: lastS?.day ? routineColor(lastS.day, state.settings, Math.max(0, routines.indexOf(lastS.day))) : '#3B82F6',
    lastBadge: lastS ? routineShort(lastS.day ?? 'Sesión') : '—',
    fourthMetric,
    cur,
    exVerdict: buildExVerdict(state, cur, bounds),
    bodyVerdict: buildBodyVerdict(ms),
    homeExCfg: buildHomeExChartConfig(state),
    bodyHomeCfg: buildBodyHomeChartConfig(ms, state.measures),
    rows,
    tone: (state.settings.aiTone === 'simple' ? 'simple' : 'technical') as AiTone,
  };
}
