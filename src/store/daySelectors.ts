import type { ExStats } from '../lib/analysis';
import { norm } from '../lib/seed';
import type { DayName } from '../types';
import { findAiExercise, inRange, isAiFreshForEx, resolveRange, routineColor, routineNames, type State } from '../ui/shared';
import { exerciseChartConfig, filterExByRange } from './homeSelectors';

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
  const analyzedByNorm = new Map(analyzedByDay.map((e) => [norm(e.name), e]));
  const seenPrimary = new Set<string>();
  const plannedPrimary: ExStats[] = [];
  for (const r of state.settings.routines[day] ?? []) {
    const k = norm(r.name);
    if (!k || seenPrimary.has(k)) continue;
    seenPrimary.add(k);
    const existing = analyzedByNorm.get(k);
    if (existing) {
      plannedPrimary.push(existing);
    } else {
      plannedPrimary.push({
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
      });
    }
  }
  const primary = plannedPrimary;
  const primaryNorms = new Set(primary.map((e) => norm(e.name)));
  const sessAll = state.analysis.sessions.filter((x) => x.day === day);
  const doneInDayNorms = new Set<string>();
  for (const s of sessAll) {
    for (const exName of s.exercises) doneInDayNorms.add(norm(exName));
  }
  for (const e of analyzedByDay) doneInDayNorms.add(norm(e.name));

  const priorityOf = (name: string, exDay: string | null) =>
    doneInDayNorms.has(norm(name)) ? 0 : exDay === day ? 1 : 2;
  const extraAll = [...state.analysis.exercises.values()]
    .filter((e) => !primaryNorms.has(norm(e.name)) && !e.name.startsWith('Samsung #') && (doneInDayNorms.has(norm(e.name)) || e.day === day || e.day == null))
    .map((e) => filterExByRange(e, bounds))
    .filter((e) => !hasFilter || e.n > 0)
    .sort((a, b) =>
      priorityOf(a.name, a.day) - priorityOf(b.name, b.day)
      || (b.last?.date ?? '').localeCompare(a.last?.date ?? '')
      || b.n - a.n,
    );

  const isEmpty = !primary.length && !extraAll.length;
  const showingExtra = primary.length === 0 ? extraAll.length > 0 : Boolean(state.dayExtra?.[day]) && extraAll.length > 0;
  const visibleList = showingExtra ? extraAll : primary;
  const allPool = [...primary, ...extraAll];

  const rawSel = state.sel[day];
  const desktopCur = visibleList.length
    ? rawSel && visibleList.some((e) => e.name === rawSel)
      ? rawSel
      : visibleList[0].name
    : undefined;
  const mobileCur = rawSel === '__closed__' ? undefined : desktopCur;

  const desktopEx = desktopCur ? allPool.find((x) => x.name === desktopCur) : undefined;
  const desktopChartCfg =
    desktopEx && desktopEx.sessions.length ? exerciseChartConfig(desktopEx.sessions, dayColor) : null;

  const mobileEx = mobileCur ? allPool.find((x) => x.name === mobileCur) : undefined;
  const mobileChartCfg =
    mobileEx && mobileEx.sessions.length ? exerciseChartConfig(mobileEx.sessions, dayColor) : null;

  const sess = hasFilter ? sessAll.filter((x) => inRange(x.date, bounds)) : sessAll;
  const lastS = sess[sess.length - 1];

  const aiFor = (ex: ExStats) => {
    return isAiFreshForEx(state, state.analysis.exercises.get(ex.name) ?? ex)
      ? findAiExercise(state.settings.ai, ex.name)
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
    aiFor,
  };
}
