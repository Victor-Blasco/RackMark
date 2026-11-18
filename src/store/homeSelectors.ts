import type { ChartConfiguration } from 'chart.js';
import { currentPhase, type ExSession, type ExStats } from '../lib/analysis';
import type { AiTone, DayName, Measure } from '../types';
import { filterSelectionOptions } from '../ui/selection';
import {
  inRange,
  isAiFreshForEx,
  movingAverage7d,
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

export type ExMetric = 'top' | 'e1rm' | 'volume';

export const STATUS_STYLE: Record<ExStats['statusColor'], { dot: string; text: string }> = {
  emeraldGreen: { dot: 'bg-emeraldGreen', text: 'text-emerald-300' },
  electricBlue: { dot: 'bg-electricBlue', text: 'text-blue-300' },
  amberGold: { dot: 'bg-amberGold', text: 'text-amber-300' },
  coralRed: { dot: 'bg-coralRed', text: 'text-rose-300' },
  gray: { dot: 'bg-gray-500', text: 'text-gray-400' },
};

const delta = (a?: number, b?: number, u = '') => (a != null && b != null ? `${a - b >= 0 ? '+' : ''}${r1(a - b)}${u}` : '');
const mean = (vals: (number | undefined)[]) => {
  const nums = vals.filter((v): v is number => v != null && Number.isFinite(v));
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : undefined;
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

/** Prepara pestañas y estado derivado para el panel de Coach IA. */
export function buildAiReportViewModel(state: State) {
  const ai = state.settings.ai;
  if (!ai) return null;
  const steps = [
    { kind: 'summary' as const, label: 'Resumen', dot: 'bg-electricBlue', overallStatus: ai.overview?.overallStatus, summary: ai.summary, highlights: ai.overview?.highlights ?? [] },
    ...(ai.overview?.sections ?? []).map((s) => ({
      kind: 'section' as const,
      label: aiStepLabel(s.title),
      dot: s.verdict === 'good' ? 'bg-emeraldGreen' : s.verdict === 'warning' ? 'bg-coralRed' : 'bg-electricBlue',
      titleColor: s.verdict === 'good' ? 'text-emerald-300' : s.verdict === 'warning' ? 'text-rose-300' : 'text-blue-300',
      title: s.title,
      text: s.text,
    })),
  ];
  const activeIdx = Math.min(Math.max(0, state.aiTab ?? 0), steps.length - 1);
  const activeTone: AiTone = state.settings.aiTone === 'simple' ? 'simple' : 'technical';
  const reportTone: AiTone = ai.tone === 'simple' ? 'simple' : 'technical';
  return {
    ai,
    steps,
    activeIdx,
    current: steps[activeIdx],
    activeTone,
    reportTone,
    toneChanged: reportTone !== activeTone,
    coverage: [`${state.strength.length} registros de fuerza`, `${state.measures.length} medidas`, `${state.wellbeing.length} registros de recuperación`],
    limitedData: state.strength.length < 5 && state.measures.length < 2 && state.wellbeing.length < 3,
  };
}

function resolveFourthMetric(
  state: State,
  ms: Measure[],
  rangeLabel: string,
  hasFilter: boolean,
  bounds: DateBounds,
): { lbl: string; val: string; sub: string; cls: string } {
  const since28 = todayIso(new Date(Date.now() - 28 * 864e5));
  const since7 = todayIso(new Date(Date.now() - 7 * 864e5));
  const wScope = hasFilter ? state.wellbeing.filter((w) => inRange(w.date, bounds)) : state.wellbeing.filter((w) => w.date >= since7);
  const wBaseline = hasFilter ? wScope : state.wellbeing.filter((w) => w.date >= since28);
  const sessScope = hasFilter ? state.analysis.sessions.filter((x) => inRange(x.date, bounds)) : state.analysis.sessions.filter((x) => x.date >= since28);
  const hrForce = mean(sessScope.map((x) => x.avgHr));
  const showWellbeing = state.wellbeing.length > 0 || wBaseline.length > 0 || hrForce != null;

  if (!showWellbeing) {
    return {
      lbl: `Medidas (${rangeLabel})`,
      val: String(ms.length),
      sub: ms[ms.length - 1] ? ` · última ${short(ms[ms.length - 1].date)}` : '',
      cls: 'text-blue-300',
    };
  }

  const sleepMain = mean(wScope.map((w) => (w.sleepMin != null ? w.sleepMin / 60 : undefined)));
  const stepsMain = mean(wScope.map((w) => w.steps));
  if (sleepMain != null || stepsMain != null) {
    const stepsText = stepsMain != null ? ` · ${stepsMain >= 1000 ? `${r1(stepsMain / 1000)}k` : Math.round(stepsMain)}` : '';
    return {
      lbl: `Sueño / Pasos (${rangeLabel})`,
      val: sleepMain != null ? `${r1(sleepMain)} h` : '—',
      sub: stepsText,
      cls: 'text-blue-300',
    };
  }

  const rhrMain = mean(wScope.map((w) => w.rhr));
  const hrvMain = mean(wScope.map((w) => w.hrv));
  const val = rhrMain != null ? `${Math.round(rhrMain)} lpm` : hrForce != null ? `${Math.round(hrForce)} lpm` : '—';
  const sub = hrvMain != null
    ? ` · HRV ${Math.round(hrvMain)}`
    : hrForce != null && rhrMain != null
      ? ` · fuerza ${Math.round(hrForce)}`
      : '';
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
