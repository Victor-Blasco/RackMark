import { resolveName } from '../lib/analysis';
import { norm } from '../lib/seed';
import type { DayName, LogDraft, LogExDraft, LogExMeta, SetRec } from '../types';
import { filterSelectionOptions } from '../ui/selection';
import { routineNames, todayIso, type State } from '../ui/shared';
import { defaultSetsForEx, manualSessionId, quickExSuggestions } from './exerciseCatalog';

/**
 * Construye un borrador de sesión para una rutina y fecha dadas, combinando datos guardados.
 * Las series aún no guardadas nacen con `done: false` para evitar sesiones fantasma.
 *
 * @param state - Estado global de la aplicación.
 * @param day - Rutina seleccionada (`Push`, `Pull`, `Leg`, personalizada o `Libre`).
 * @param date - Fecha en formato ISO (`YYYY-MM-DD`).
 * @param sessionId - ID de sesión concreto al cargar o editar desde el historial.
 * @returns Borrador listo para editar en `Registrar entreno`.
 */
export function initLogDraft(
  state: State,
  day: DayName | 'Libre',
  date: string,
  sessionId?: string,
): LogDraft {
  const targetSid = manualSessionId(date, day);
  const legacySid = `manual-${date}`;
  const inferredDayBySid = new Map(state.analysis.sessions.map((s) => [s.id, s.day ?? 'Libre']));
  const onDate = sessionId
    ? state.strength.filter((r) => r.sessionId === sessionId)
    : state.strength.filter((r) => {
        if (r.date !== date) return false;
        if (r.sessionId === targetSid) return true;
        const rowDay = r.day ?? inferredDayBySid.get(r.sessionId) ?? 'Libre';
        return rowDay === day && (r.sessionId === legacySid || !r.id.startsWith('manual-'));
      });

  const savedByNorm = new Map<string, { name: string; sets: SetRec[]; notes: string[]; meta?: LogExMeta }>();
  for (const r of onDate) {
    const name = resolveName(r.ref, state.settings);
    const k = norm(name);
    const cur = savedByNorm.get(k) ?? {
      name,
      sets: [],
      notes: [],
      meta: {
        id: r.id,
        ts: r.ts,
        ...(r.durMin != null ? { durMin: r.durMin } : {}),
        ...(r.avgHr != null ? { avgHr: r.avgHr } : {}),
        ...(r.maxHr != null ? { maxHr: r.maxHr } : {}),
        ...(r.minHr != null ? { minHr: r.minHr } : {}),
        ...(r.kcal != null ? { kcal: r.kcal } : {}),
      },
    };
    cur.sets.push(
      ...r.sets.map((s) => ({
        w: s.w,
        r: s.r,
        done: s.r > 0,
        ...(s.rir != null ? { rir: s.rir } : {}),
        ...(s.restSec != null ? { restSec: s.restSec } : {}),
      })),
    );
    if (r.note?.trim()) cur.notes.push(r.note.trim());
    savedByNorm.set(k, cur);
  }

  const exercises: LogExDraft[] = [];
  const used = new Set<string>();

  if (day !== 'Libre') {
    for (const r of state.settings.routines[day] ?? []) {
      const k = norm(r.name);
      if (used.has(k)) continue;
      used.add(k);
      const saved = savedByNorm.get(k);
      if (saved) {
        exercises.push({ name: r.name, done: true, sets: saved.sets, note: [...new Set(saved.notes)].join(' · '), ...(saved.meta ? { meta: saved.meta } : {}) });
      } else {
        exercises.push({ name: r.name, done: false, sets: defaultSetsForEx(state, r.name, r.sets, r.reps, false), note: '' });
      }
    }
  }

  for (const [k, saved] of savedByNorm) {
    if (used.has(k)) continue;
    used.add(k);
    exercises.push({
      name: saved.name,
      done: true,
      sets: saved.sets,
      note: [...new Set(saved.notes)].join(' · '),
      ...(saved.meta ? { meta: saved.meta } : {}),
    });
  }

  return {
    date,
    day,
    exercises,
    sessionId: sessionId ?? (onDate[0]?.sessionId || targetSid),
    dirty: false,
  };
}

/**
 * Construye el modelo derivado completo para la vista `Registrar entreno ya hecho`.
 *
 * @param state - Estado global de la aplicación.
 * @returns Borrador activo, opciones filtradas de añadido, contadores y últimas 10 sesiones.
 */
export function buildLogViewModel(state: State) {
  const today = todayIso();
  const routines = routineNames(state.settings);
  const draft = state.logDraft ?? initLogDraft(state, routines[0] ?? 'Libre', today);
  const { avail, quick } = quickExSuggestions(
    state,
    draft.day,
    draft.exercises.map((e) => e.name),
  );
  const filteredAvail = avail.length > 12
    ? filterSelectionOptions(avail.map((n) => ({ id: n, label: n })), state.logAddQuery ?? '')
    : avail.map((n) => ({ id: n, label: n }));

  const doneExCount = draft.exercises.filter((e) => e.sets.some((s) => s.done && s.r > 0)).length;
  const doneSetsCount = draft.exercises.reduce((acc, e) => acc + e.sets.filter((s) => s.done && s.r > 0).length, 0);
  const totalSetsCount = draft.exercises.reduce((acc, e) => acc + e.sets.length, 0);
  const recentSessions = [...state.analysis.sessions].reverse().slice(0, 10);

  return {
    routines,
    draft,
    avail,
    quick,
    filteredAvail,
    doneExCount,
    doneSetsCount,
    totalSetsCount,
    recentSessions,
  };
}
