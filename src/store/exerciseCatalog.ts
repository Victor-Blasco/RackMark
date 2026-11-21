import { musclesOf } from '../lib/analysis';
import { CATALOG_EXERCISES, MUSCLE_DAY, norm } from '../lib/seed';
import type { DayName, LogExDraft, SetRec } from '../types';
import { findAiExercise, isAiFreshForEx, routineNames, short, type State } from '../ui/shared';

/**
 * Devuelve la lista ordenada y deduplicada de todos los nombres de ejercicios conocidos.
 *
 * @param state - Estado global de la aplicación.
 * @returns Lista alfabética de ejercicios disponibles.
 */
export function allExerciseNames(state: State): string[] {
  const byNorm = new Map<string, string>();
  const aliases = state.settings.aliases;
  const add = (n: string) => {
    let t = n.trim();
    for (let seen = new Set<string>(); aliases[t] && !seen.has(t) && seen.size < 10; t = aliases[t]) seen.add(t);
    if (!t || t.startsWith('Samsung #')) return;
    const k = norm(t);
    if (!byNorm.has(k)) byNorm.set(k, t);
  };
  routineNames(state.settings).forEach((d) => (state.settings.routines[d] ?? []).forEach((r) => add(r.name)));
  CATALOG_EXERCISES.forEach(add);
  Object.values(state.settings.customNames).forEach(add);
  Object.values(state.settings.refNames).forEach(add);
  [...state.analysis.exercises.keys()].forEach(add);
  return [...byNorm.values()].sort((a, b) => a.localeCompare(b, 'es'));
}

/**
 * Genera el identificador estable de sesión manual por fecha y rutina,
 * permitiendo registrar varias sesiones distintas en un mismo día.
 *
 * @param date - Fecha ISO de la sesión.
 * @param day - Rutina seleccionada o `'Libre'`.
 * @returns Identificador determinista de sesión manual.
 */
export function manualSessionId(date: string, day: DayName | 'Libre'): string {
  const slug = norm(day || 'libre').replace(/\s+/g, '-') || 'libre';
  return `manual-${date}-${slug}`;
}

/**
 * Precarga las series de un ejercicio usando la última sesión registrada o valores por defecto.
 *
 * @param state - Estado global de la aplicación.
 * @param name - Nombre del ejercicio.
 * @param fallbackSets - Número de series si no hay historial.
 * @param fallbackReps - Repeticiones iniciales si no hay historial.
 * @param done - Estado inicial de completado de las series.
 * @returns Array nuevo de series `{ w, r, done }`.
 */
export function defaultSetsForEx(
  state: State,
  name: string,
  fallbackSets = 2,
  fallbackReps = 10,
  done = false,
): SetRec[] {
  const k = norm(name);
  const ex = [...state.analysis.exercises.values()].find((e) => norm(e.name) === k);
  if (ex?.last?.sets.length) return ex.last.sets.map((s) => ({ w: s.w, r: s.r, done }));
  return Array.from({ length: fallbackSets }, () => ({ w: 0, r: fallbackReps, done }));
}

/**
 * Extrae el peso objetivo en kg sugerido por una prescripción explícita (no captura deltas relativos).
 *
 * @param text - Texto de prescripción del análisis o Coach IA.
 * @returns Peso numérico objetivo en kg o `null` si no aparece.
 */
export function extractTargetWeight(text: string): number | null {
  const actMatch = text.match(/(?:^|[.\s])(?:sube a|baja a|mant[eé]n|usa|objetivo:?)\s+(\d+(?:[.,]\d+)?)\s*kg/i);
  const raw = actMatch?.[1];
  if (!raw) return null;
  const val = parseFloat(raw.replace(',', '.'));
  return Number.isFinite(val) && val >= 0 ? val : null;
}

/**
 * Calcula contexto histórico, prescripción, notas y contadores de series para un ejercicio.
 *
 * @param state - Estado global de la aplicación.
 * @param day - Rutina activa o `'Libre'`.
 * @param ex - Ejercicio en curso dentro del borrador o sesión viva.
 * @returns Objeto con historial, objetivo, prescripción, nota fija y contadores.
 */
export function exerciseContext(state: State, day: DayName | 'Libre', ex: LogExDraft) {
  const k = norm(ex.name);
  const hist = [...state.analysis.exercises.values()].find((e) => norm(e.name) === k);
  const tgt = day !== 'Libre' ? (state.settings.routines[day] ?? []).find((r) => norm(r.name) === k) : hist?.target;
  const lastRef = hist?.last
    ? `Última (${short(hist.last.date)}): ${hist.last.sets.map((s) => `${s.w}×${s.r}`).join(' · ')}`
    : 'Sin historial previo';
  const freshAi = isAiFreshForEx(state, hist) ? findAiExercise(state.settings.ai, ex.name) : undefined;
  const prescription = freshAi?.prescription ?? hist?.prescription ?? '';
  const targetW = prescription ? extractTargetWeight(prescription) : null;
  const fixedNote = state.settings.notes[ex.name]?.trim() ?? '';
  const doneInEx = ex.sets.filter((s) => s.done && s.r > 0).length;
  const allDoneInEx = ex.sets.length > 0 && doneInEx === ex.sets.length;
  const showApplyBtn = targetW != null && ex.sets.some((s) => !s.done && s.w !== targetW);
  return { hist, tgt, lastRef, prescription, targetW, fixedNote, doneInEx, allDoneInEx, showApplyBtn };
}

/**
 * Devuelve ejercicios disponibles y sugerencias musculares afines al día elegido.
 *
 * @param state - Estado global de la aplicación.
 * @param day - Rutina activa o `'Libre'`.
 * @param currentNames - Nombres ya presentes en la sesión para excluirlos.
 * @param limit - Máximo de sugerencias rápidas devueltas.
 * @param preferredExName - Ejercicio a sustituir para priorizar su músculo principal.
 * @returns Listas `avail` (todos los disponibles) y `quick` (sugerencias ordenadas).
 */
export function quickExSuggestions(state: State, day: DayName | 'Libre', currentNames: string[], limit = 6, preferredExName?: string) {
  const inUse = new Set(currentNames.map((n) => norm(n)));
  const avail = allExerciseNames(state).filter((n) => !inUse.has(norm(n)));
  const muscleFreq = new Map<string, number>();
  if (day !== 'Libre') {
    (state.settings.routines[day] ?? []).forEach((r) => {
      const p = musclesOf(r.name, state.settings)?.p;
      if (p) muscleFreq.set(p, (muscleFreq.get(p) ?? 0) + 1);
    });
  }
  const prefMuscle = preferredExName ? musclesOf(preferredExName, state.settings)?.p : undefined;
  const nonAbRoutine = [...muscleFreq.keys()].some((m) => m !== 'Abdomen');
  const score = (n: string) => {
    const m = musclesOf(n, state.settings);
    const prefMatch = prefMuscle && m ? (m.p === prefMuscle ? 2 : m.s.includes(prefMuscle) ? 1 : 0) : 0;
    const abPriority = m?.p === 'Abdomen' && prefMuscle !== 'Abdomen' && nonAbRoutine ? 0 : 1;
    return [prefMatch, abPriority, m ? (muscleFreq.get(m.p) ?? 0) : 0, state.analysis.exercises.get(n)?.n ?? 0];
  };
  const quick = avail
    .filter((n) => {
      if (day === 'Libre') return true;
      const m = musclesOf(n, state.settings);
      return m ? (muscleFreq.size ? muscleFreq.has(m.p) : MUSCLE_DAY[m.p] === day) : false;
    })
    .sort((a, b) => {
      const sa = score(a);
      const sb = score(b);
      for (let i = 0; i < sa.length; i++) if (sb[i] !== sa[i]) return sb[i] - sa[i];
      return a.localeCompare(b, 'es');
    })
    .slice(0, limit);
  return { avail, quick };
}
