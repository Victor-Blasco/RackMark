import type { ExStats } from '../lib/analysis';
import { norm } from '../lib/seed';
import type { DayName } from '../types';
import { inRange, isAiFreshForEx, resolveRange, routineColor, routineNames, type State } from '../ui/shared';
import { exerciseChartConfig, filterExByRange, type ExMetric } from './homeSelectors';

/**
 * Calcula los datos maestros y de detalle de una rutina concreta (`Push`, `Pull`, personalizada…).
 *
 * @param state - Estado global de la aplicación.
 * @param day - Nombre de la rutina seleccionada.
 * @returns Listas `primary` / `extraAll`, ejercicio seleccionado en escritorio y móvil, y gráficas.
 */
export function buildDayRoutineViewModel(state: State, day: DayName) {
  const bounds = resolveRange(state, day);
  const hasFilter = Boolean(bounds.from || bounds.to);
  const rangeLabel = bounds.label;
  const routines = routineNames(state.settings);
  const dayColor = routineColor(day, state.settings, Math.max(0, routines.indexOf(day)));

  const analyzedByDay = (state.analysis.byDay[day] ?? []).map((e) => filterExByRange(e, bounds));
  const analyzedNorms = new Set(analyzedByDay.map((e) => norm(e.name)));
  const plannedOnly: ExStats[] = (state.settings.routines[day] ?? [])
    .filter((r) => r.name.trim() && !analyzedNorms.has(norm(r.name)))
    .map((r) => ({
      name: r.name,
      day,
      target: r,
      sessions: [],
      last: undefined,
      n: 0,
      maxWeight: 0,
      maxE1rm: 0,
      status: 'Pendiente de estrenar',
      statusColor: 'electricBlue' as const,
      prescription: `Estrena este ejercicio hoy: objetivo ${r.sets} series de ${r.reps} repeticiones con un peso que controles dejando 1–2 repeticiones en reserva.`,
    }));

  const primary = [...analyzedByDay, ...plannedOnly];
  const primaryNorms = new Set(primary.map((e) => norm(e.name)));
  const extraAll = [...state.analysis.exercises.values()]
    .filter((e) => !primaryNorms.has(norm(e.name)) && !e.name.startsWith('Samsung #') && (e.day === day || e.day == null))
    .map((e) => filterExByRange(e, bounds))
    .filter((e) => !hasFilter || e.n > 0)
    .sort((a, b) => (a.day === day ? 0 : 1) - (b.day === day ? 0 : 1) || b.n - a.n);

  const isEmpty = !primary.length && !extraAll.length;
  const showingExtra = Boolean(state.dayExtra?.[day]) && extraAll.length > 0;
  const visibleList = showingExtra ? extraAll : primary.length ? primary : extraAll;
  const allPool = [...primary, ...extraAll];

  const rawSel = state.sel[day];
  const desktopCur = visibleList.length
    ? rawSel && visibleList.some((e) => e.name === rawSel)
      ? rawSel
      : visibleList[0].name
    : undefined;
  const mobileCur = rawSel === '__closed__' ? undefined : desktopCur;

  const metric: ExMetric = state.exMetric ?? 'top';
  const desktopEx = desktopCur ? allPool.find((x) => x.name === desktopCur) : undefined;
  const desktopChartCfg =
    desktopEx && desktopEx.sessions.length ? exerciseChartConfig(desktopEx.sessions, dayColor, metric) : null;

  const mobileEx = mobileCur ? allPool.find((x) => x.name === mobileCur) : undefined;
  const mobileChartCfg =
    mobileEx && mobileEx.sessions.length ? exerciseChartConfig(mobileEx.sessions, dayColor, metric) : null;

  const sessAll = state.analysis.sessions.filter((x) => x.day === day);
  const sess = hasFilter ? sessAll.filter((x) => inRange(x.date, bounds)) : sessAll;
  const lastS = sess[sess.length - 1];

  const aiFor = (ex: ExStats) => {
    if (hasFilter) return undefined;
    return isAiFreshForEx(state, state.analysis.exercises.get(ex.name) ?? ex)
      ? state.settings.ai?.byExercise[ex.name]
      : undefined;
  };

  return {
    bounds,
    hasFilter,
    rangeLabel,
    dayColor,
    primary,
    extraAll,
    isEmpty,
    showingExtra,
    visibleList,
    desktopCur,
    mobileCur,
    desktopEx,
    desktopChartCfg,
    mobileChartCfg,
    sess,
    lastS,
    metric,
    aiFor,
  };
}
