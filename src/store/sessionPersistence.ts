import { epley, findAnalyzedExercise } from '../lib/analysis';
import { deleteMany, putMany } from '../lib/db';
import { isValidIsoDate, norm } from '../lib/seed';
import { markBucketDeletes, markBucketUpserts } from '../lib/sync';
import type { DayName, LiveWorkout, LogExDraft, StrengthRow } from '../types';
import type { State, WorkoutSummary } from '../ui/shared';
import { isCompletedSet } from './draftSetHelpers';

/** Parámetros para persistir una sesión completada en IndexedDB y cola de sync. */
export interface PersistSessionOpts {
  sessionId: string;
  day: DayName | 'Libre';
  date: string;
  exercises: LogExDraft[];
  replaceExisting?: boolean;
  defaultDurPerEx?: number;
  tsBase?: number;
}

/**
 * Convierte el borrador en filas `StrengthRow` válidas y las guarda en IndexedDB.
 *
 * @param state - Estado global con historial previo.
 * @param opts - Datos de la sesión a persistir.
 * @param onToast - Callback para avisar al usuario si falta fecha o series.
 * @returns Número de ejercicios guardados (`0` si se canceló por validación).
 */
export async function persistCompletedSession(
  state: State,
  opts: PersistSessionOpts,
  onToast: (msg: string) => void,
): Promise<number> {
  if (!isValidIsoDate(opts.date)) {
    onToast('Selecciona una fecha válida antes de guardar.');
    return 0;
  }
  const rows: StrengthRow[] = [];
  const usedIds = new Set<string>();
  const fallbackTs = opts.tsBase ?? (Date.parse(`${opts.date}T12:00:00Z`) || Date.now());
  for (let i = 0; i < opts.exercises.length; i++) {
    const ex = opts.exercises[i];
    const sets = ex.sets
      .filter(isCompletedSet)
      .map((s) => ({
        w: Math.max(0, Number(s.w) || 0),
        r: Math.max(1, Math.round(Number(s.r) || 0)),
        ...(s.restSec != null && Number.isFinite(s.restSec) && s.restSec >= 0 ? { restSec: Math.round(s.restSec) } : {}),
        ...(s.rir != null && Number.isFinite(s.rir) && s.rir >= 0 && s.rir <= 10 ? { rir: Math.round(s.rir) } : {}),
      }));
    if (!sets.length) continue;
    const durMin = ex.meta?.durMin ?? opts.defaultDurPerEx;
    const slug = norm(ex.name) || encodeURIComponent(ex.name.trim()).replace(/%/g, '').slice(0, 24) || 'ex';
    let rowId = ex.meta?.id ?? `${opts.sessionId}-${slug}`;
    if (usedIds.has(rowId)) {
      let n = 2;
      while (usedIds.has(`${rowId}-${n}`)) n++;
      rowId = `${rowId}-${n}`;
    }
    usedIds.add(rowId);
    rows.push({
      id: rowId,
      sessionId: opts.sessionId,
      ts: ex.meta?.ts ?? fallbackTs + i * 1000,
      date: opts.date,
      ref: `name:${ex.name.trim()}`,
      sets,
      ...(durMin != null ? { durMin } : {}),
      ...(ex.meta?.avgHr != null ? { avgHr: ex.meta.avgHr } : {}),
      ...(ex.meta?.maxHr != null ? { maxHr: ex.meta.maxHr } : {}),
      ...(ex.meta?.minHr != null ? { minHr: ex.meta.minHr } : {}),
      ...(ex.meta?.kcal != null ? { kcal: ex.meta.kcal } : {}),
      ...(ex.note.trim() ? { note: ex.note.trim() } : {}),
      ...(opts.day !== 'Libre' ? { day: opts.day } : {}),
    });
  }
  if (!rows.length) {
    onToast('Marca con ✓ al menos una serie completada (con repeticiones > 0) antes de guardar.');
    return 0;
  }
  if (opts.replaceExisting) {
    const legacySid = `manual-${opts.date}`;
    const oldRows = state.strength.filter(
      (r) =>
        r.sessionId === opts.sessionId ||
        (r.id.startsWith('manual-') && r.sessionId === legacySid && (r.day ?? 'Libre') === opts.day),
    );
    if (oldRows.length) {
      await deleteMany('strength', oldRows.map((r) => r.id));
      markBucketDeletes('strength', oldRows.map((r) => ({ key: r.id, date: r.date })));
    }
  }
  await putMany('strength', rows);
  markBucketUpserts('strength', rows);
  return rows.length;
}

/**
 * Resume volumen, series y nuevos récords personales de una sesión en vivo.
 *
 * @param state - Estado global con estadísticas previas.
 * @param live - Sesión en vivo recién completada.
 * @param savedExercises - Número de ejercicios persistidos.
 * @returns Resumen listo para mostrar en `<WorkoutSummaryModal />`.
 */
export function buildWorkoutSummary(state: State, live: LiveWorkout, savedExercises: number): WorkoutSummary {
  const validEx = live.exercises.filter((e) => e.sets.some(isCompletedSet));
  const durationMin = Math.max(1, Math.round((Date.now() - live.startedAt) / 60000));
  let sets = 0;
  let tonnageKg = 0;
  const prNames: string[] = [];
  const plannedNorms = live.day !== 'Libre'
    ? new Set((state.settings.routines[live.day] ?? []).map((r) => norm(r.name)))
    : null;
  const extraExercises: NonNullable<WorkoutSummary['extraExercises']> = [];
  for (const ex of validEx) {
    const doneSets = ex.sets.filter(isCompletedSet);
    sets += doneSets.length;
    for (const s of doneSets) tonnageKg += Math.max(0, s.w) * s.r;
    if (plannedNorms && !plannedNorms.has(norm(ex.name))) {
      extraExercises.push({ name: ex.name, sets: doneSets.length, reps: doneSets[0]?.r ?? 10 });
    }
    const prev = findAnalyzedExercise(state.analysis, ex.name);
    if (prev && prev.n > 0) {
      const bestW = Math.max(...doneSets.map((s) => s.w));
      const bestE1rm = Math.max(...doneSets.map((s) => epley(s.w, s.r)));
      if (bestW === 0 && prev.maxWeight === 0) {
        const prevMaxReps = Math.max(0, ...prev.sessions.map((s) => s.repsAtTop));
        if (Math.max(...doneSets.map((s) => s.r)) > prevMaxReps) prNames.push(ex.name);
      } else if (bestW > prev.maxWeight + 0.05 || bestE1rm > prev.maxE1rm + 0.05) {
        prNames.push(ex.name);
      }
    }
  }
  return {
    day: live.day,
    durationMin,
    exercises: savedExercises,
    sets,
    tonnageKg: Math.round(tonnageKg),
    prNames,
    ...(extraExercises.length ? { extraExercises } : {}),
  };
}
