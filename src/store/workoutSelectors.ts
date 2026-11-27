import { findAnalyzedExercise } from '../lib/analysis';
import type { DayName, LiveWorkout, LogExDraft } from '../types';
import { defaultSetsForEx, exerciseContext } from './exerciseCatalog';
import { isCompletedSet } from './draftSetHelpers';
import { r1, routineColor, routineNames, todayIso, type State } from '../ui/shared';

/** Sugiere la siguiente rutina en rotación respecto a la última sesión registrada. */
export function suggestedNextRoutine(state: State, routines: DayName[]): DayName | undefined {
  if (!routines.length) return undefined;
  const lastWithRoutine = [...state.analysis.sessions].reverse().find((s) => s.day && routines.includes(s.day));
  if (!lastWithRoutine?.day) return routines[0];
  const idx = routines.indexOf(lastWithRoutine.day);
  return routines[(idx + 1) % routines.length];
}

/** Formatea los minutos transcurridos desde `startedAt` para la cabecera en vivo. */
export function fmtElapsed(startedAt: number): string {
  const min = Math.max(0, Math.floor((Date.now() - startedAt) / 60000));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
}

/**
 * Inicializa una sesión de entrenamiento en vivo paso a paso para la rutina elegida.
 *
 * @param state - Estado global con rutinas, historial y ajustes.
 * @param day - Rutina seleccionada o `'Libre'` para entreno sin plantilla.
 * @returns Borrador de sesión en vivo listo para guardar en `liveWorkout`.
 */
export function initLiveWorkout(state: State, day: DayName | 'Libre'): LiveWorkout {
  const exercises: LogExDraft[] = day === 'Libre'
    ? []
    : (state.settings.routines[day] ?? []).map((r) => ({
        name: r.name,
        done: false,
        sets: defaultSetsForEx(state, r.name, r.sets, r.reps, false),
        note: '',
      }));
  return {
    date: todayIso(),
    day,
    startedAt: Date.now(),
    curIdx: 0,
    exercises,
    targetRestSec: state.liveWorkout?.targetRestSec ?? 90,
    ...(exercises.length === 0 ? { pickerMode: 'add' as const } : {}),
  };
}

/**
 * Resume estado, serie objetivo y última marca de un ejercicio en el menú de `En vivo`.
 *
 * @param state - Estado global de la aplicación.
 * @param day - Rutina de la sesión en curso.
 * @param item - Ejercicio en curso dentro del borrador vivo.
 * @returns Línea informativa corta, series completadas y si todas están hechas.
 */
export function liveExQuickInfo(
  state: State,
  day: DayName | 'Libre',
  item: LogExDraft,
): { infoLine: string; doneInEx: number; allDoneInEx: boolean } {
  const { tgt, hist, doneInEx, allDoneInEx } = exerciseContext(state, day, item);
  const doneToday = item.sets.filter((s) => s.done && s.r > 0);
  const bestToday = doneToday.length
    ? doneToday.reduce((a, b) => (b.w > a.w || (b.w === a.w && b.r > a.r) ? b : a))
    : null;
  const quickInfo = bestToday
    ? `Hoy ${bestToday.w} kg × ${bestToday.r}`
    : hist?.last
      ? `Últ. ${hist.last.top} kg × ${hist.last.repsAtTop}`
      : 'Sin historial';
  return {
    infoLine: `${tgt ? `Obj ${tgt.sets}×${tgt.reps} · ` : ''}${quickInfo}`,
    doneInEx,
    allDoneInEx,
  };
}

/** Elemento de rutina calculado para la pantalla inicial de `En vivo`. */
export interface DayPickerRoutineItem {
  day: string;
  color: string;
  sub?: string;
  exerciseCount: number;
  totalSets: number;
  lastDate?: string;
  isSuggested: boolean;
}

/**
 * Construye la lista de rutinas con última fecha y sugerencia de "Toca hoy".
 *
 * @param state - Estado global de la aplicación.
 * @returns Elementos listos para pintar en `<RoutineDayPicker />`.
 */
export function buildDayPickerItems(state: State): DayPickerRoutineItem[] {
  const routines = routineNames(state.settings);
  const suggested = suggestedNextRoutine(state, routines);
  const lastByDay = new Map<string, string>();
  for (const s of state.analysis.sessions) {
    if (s.day) lastByDay.set(s.day, s.date);
  }
  return routines.map((day, idx) => {
    const list = state.settings.routines[day] ?? [];
    return {
      day,
      color: routineColor(day, state.settings, idx),
      sub: state.settings.routineMeta?.[day]?.sub,
      exerciseCount: list.length,
      totalSets: list.reduce((acc, ex) => acc + ex.sets, 0),
      lastDate: lastByDay.get(day),
      isSuggested: day === suggested,
    };
  });
}

/** Resumen y comparativa vs la sesión anterior tras completar todas las series de un ejercicio. */
export interface ExerciseCompletionSummary {
  setsCount: number;
  topWeight: number;
  totalReps: number;
  totalVolume: number;
  comparisonText: string;
  tone: 'emerald' | 'amber' | 'blue';
}

export function buildExerciseCompletionSummary(state: State, ex: LogExDraft): ExerciseCompletionSummary {
  const doneSets = ex.sets.filter(isCompletedSet);
  const setsCount = doneSets.length;
  const topWeight = setsCount ? Math.max(...doneSets.map((s) => s.w)) : 0;
  const totalReps = doneSets.reduce((sum, s) => sum + s.r, 0);
  const totalVolume = Math.round(doneSets.reduce((sum, s) => sum + s.w * s.r, 0));
  const hist = findAnalyzedExercise(state.analysis, ex.name);
  const prev = hist?.last;

  if (!prev) {
    return { setsCount, topWeight, totalReps, totalVolume, comparisonText: 'Primera sesión registrada', tone: 'blue' };
  }

  const prevReps = prev.sets.reduce((sum, s) => sum + s.r, 0);
  const dW = Math.round((topWeight - prev.top) * 10) / 10;
  const dR = totalReps - prevReps;
  const dV = totalVolume - Math.round(prev.volume);

  if (dW === 0 && dR === 0 && dV === 0) {
    return { setsCount, topWeight, totalReps, totalVolume, comparisonText: 'Igual que tu sesión anterior', tone: 'blue' };
  }

  const parts: string[] = [];
  if (dW !== 0) parts.push(`${dW > 0 ? '+' : '−'}${r1(Math.abs(dW))} kg máx`);
  if (dR !== 0 && parts.length < 2) parts.push(`${dR > 0 ? '+' : '−'}${Math.abs(dR)} reps`);
  if (dV !== 0 && parts.length < 2) parts.push(`${dV > 0 ? '+' : '−'}${Math.abs(dV)} kg vol.`);
  const improved = dW > 0 || (dW === 0 && (dV > 0 || (dV === 0 && dR > 0)));
  return {
    setsCount,
    topWeight,
    totalReps,
    totalVolume,
    comparisonText: `${parts.join(' · ')} vs anterior`,
    tone: improved ? 'emerald' : 'amber',
  };
}

/**
 * Calcula el modelo completo derivado para la sesión activa de `<LiveWorkoutView />`.
 *
 * @param state - Estado global con `liveWorkout` definido.
 * @returns Totales, ejercicio activo, contexto histórico y color de la rutina.
 */
export function buildLiveWorkoutViewModel(state: State, live: LiveWorkout) {
  const total = live.exercises.length;
  const curIdx = total > 0 ? Math.min(Math.max(0, live.curIdx), total - 1) : 0;
  const currentEx = live.exercises[curIdx];
  const doneExCount = live.exercises.filter((e) => e.sets.length > 0 && e.sets.every((s) => s.done && s.r > 0)).length;
  const doneSetsCount = live.exercises.reduce((acc, e) => acc + e.sets.filter((s) => s.done && s.r > 0).length, 0);
  const totalSetsCount = live.exercises.reduce((acc, e) => acc + e.sets.length, 0);
  const routines = routineNames(state.settings);
  const rIdx = routines.indexOf(live.day);
  const prevBannerEx = live.lastCompletedExIdx != null ? live.exercises[live.lastCompletedExIdx] : undefined;
  const activeCtx = currentEx ? exerciseContext(state, live.day, currentEx) : undefined;
  return {
    total,
    curIdx,
    currentEx,
    doneExCount,
    doneSetsCount,
    totalSetsCount,
    allDone: total > 0 && doneExCount === total,
    prevIdx: live.lastCompletedExIdx,
    prevBannerEx,
    prevSummary: prevBannerEx ? buildExerciseCompletionSummary(state, prevBannerEx) : undefined,
    dayColor: rIdx >= 0 ? routineColor(live.day, state.settings, rIdx) : '#9CA3AF',
    activeCtx,
    activeRestSec: activeCtx?.tgt?.restSec ?? live.targetRestSec,
    elapsedLabel: fmtElapsed(live.startedAt),
    menuItems: live.exercises.map((item, idx) => ({ item, idx, ...liveExQuickInfo(state, live.day, item) })),
  };
}
