import { currentPhase } from '../lib/analysis';
import type { AiTone, DayName, Measure } from '../types';
import { filterSelectionOptions } from '../ui/selection';
import {
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
  type ExMetric,
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
  type ExMetric,
};

const delta = (a?: number, b?: number, u = '') => (a != null && b != null ? `${a - b >= 0 ? '+' : ''}${r1(a - b)}${u}` : '');
const mean = (vals: (number | undefined)[]) => {
  const nums = vals.filter((v): v is number => v != null && Number.isFinite(v));
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : undefined;
};

function resolveFourthMetric(state: State, ms: Measure[], rangeLabel: string, hasFilter: boolean, bounds: DateBounds) {
  const since28 = todayIso(new Date(Date.now() - 28 * 864e5));
  const since7 = todayIso(new Date(Date.now() - 7 * 864e5));
  const wScope = hasFilter ? state.wellbeing.filter((w) => inRange(w.date, bounds)) : state.wellbeing.filter((w) => w.date >= since7);
  const wBaseline = hasFilter ? wScope : state.wellbeing.filter((w) => w.date >= since28);
  const sessScope = hasFilter ? state.analysis.sessions.filter((x) => inRange(x.date, bounds)) : state.analysis.sessions.filter((x) => x.date >= since28);
  const hrForce = mean(sessScope.map((x) => x.avgHr));
  if (!(state.wellbeing.length > 0 || wBaseline.length > 0 || hrForce != null)) {
    return { lbl: `Medidas (${rangeLabel})`, val: String(ms.length), sub: ms[ms.length - 1] ? ` · última ${short(ms[ms.length - 1].date)}` : '', cls: 'text-blue-300' };
  }
  const sleepMain = mean(wScope.map((w) => (w.sleepMin != null ? w.sleepMin / 60 : undefined)));
  const stepsMain = mean(wScope.map((w) => w.steps));
  if (sleepMain != null || stepsMain != null) {
    const stepsText = stepsMain != null ? ` · ${stepsMain >= 1000 ? `${r1(stepsMain / 1000)}k` : Math.round(stepsMain)}` : '';
    return { lbl: `Sueño / Pasos (${rangeLabel})`, val: sleepMain != null ? `${r1(sleepMain)} h` : '—', sub: stepsText, cls: 'text-blue-300' };
  }
  const rhrMain = mean(wScope.map((w) => w.rhr));
  const hrvMain = mean(wScope.map((w) => w.hrv));
  const val = rhrMain != null ? `${Math.round(rhrMain)} lpm` : hrForce != null ? `${Math.round(hrForce)} lpm` : '—';
  const sub = hrvMain != null ? ` · HRV ${Math.round(hrvMain)}` : hrForce != null && rhrMain != null ? ` · fuerza ${Math.round(hrForce)}` : '';
  return { lbl: `Pulso (${rangeLabel})`, val, sub, cls: 'text-cyan-300' };
}

/** Construye todos los KPIs, series de gráficas y tabla de cargas para `<HomeView />`. */
export function buildHomeViewModel(state: State) {
  const isOnboarding = !state.strength.length && !state.measures.length && !state.cardio.length && !state.wellbeing.length;
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
  const since28 = todayIso(new Date(Date.now() - 28 * 864e5));
  const activeDays = new Set((hasFilter ? sess : sess.filter((x) => x.date >= since28)).map((x) => x.date)).size;
  const weeks = bounds.days ? Math.max(1, bounds.days / 7) : 4;
  const phase = currentPhase(state.settings);
  const fourthMetric = resolveFourthMetric(state, ms, bounds.label, hasFilter, bounds);
  const ex = homeExercises(state);
  const cur = state.sel.home && state.analysis.exercises.has(state.sel.home) ? state.sel.home : ex[0]?.name;
  const homeOptions = ex.map((e) => ({ id: e.name, label: e.name }));
  const filteredHomeOptions = ex.length > 12 ? filterSelectionOptions(homeOptions, state.homeExQuery ?? '') : homeOptions;
  const routines = routineNames(state.settings);
  const rows = routines.flatMap((d, idx) =>
    (state.analysis.byDay[d] ?? []).map((e) => {
      const filtered = filterExByRange(e, bounds);
      const aiStatus = !hasFilter && isAiFreshForEx(state, state.analysis.exercises.get(filtered.name) ?? filtered) ? state.settings.ai?.byExercise[filtered.name]?.status : undefined;
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
    exCount: ex.length,
    cur,
    filteredHomeOptions,
    homeExCfg: buildHomeExChartConfig(state),
    bodyHomeCfg: buildBodyHomeChartConfig(ms),
    rows,
    metric: (state.exMetric ?? 'top') as ExMetric,
    tone: (state.settings.aiTone === 'simple' ? 'simple' : 'technical') as AiTone,
  };
}
