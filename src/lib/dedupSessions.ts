import type { StrengthRow } from '../types';
import type { State } from '../ui/shared';

export interface DuplicateSessionItem {
  id: string;
  date: string;
  day: string;
  exerciseCount: number;
  sets: number;
  durMin?: number;
  avgHr?: number;
  kcal?: number;
}

export interface DuplicateSessionGroup {
  key: string;
  date: string;
  day: string;
  sessions: DuplicateSessionItem[];
}

/** Detecta días con 2 o más sesiones distintas de la misma rutina (`date + day`). */
export function findDuplicateSessionGroups(state: State): DuplicateSessionGroup[] {
  const groups = new Map<string, DuplicateSessionItem[]>();
  for (const s of state.analysis?.sessions ?? []) {
    if (!s.day) continue;
    const key = `${s.date}|${s.day}`;
    const list = groups.get(key) ?? [];
    list.push({
      id: s.id,
      date: s.date,
      day: s.day,
      exerciseCount: s.exercises.length,
      sets: s.sets,
      durMin: s.durMin,
      avgHr: s.avgHr,
      kcal: s.kcal,
    });
    groups.set(key, list);
  }
  return [...groups.entries()]
    .filter(([, list]) => list.length >= 2)
    .map(([key, sessions]) => {
      const sorted = [...sessions].sort((a, b) => (b.sets - a.sets) || ((b.durMin ?? 0) - (a.durMin ?? 0)));
      return { key, date: sorted[0].date, day: sorted[0].day, sessions: sorted };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Calcula qué filas conservar/enriquecer y qué filas eliminar al elegir una sesión ganadora. */
export function buildSessionKeepCleanup(
  strength: StrengthRow[],
  groupSessions: DuplicateSessionItem[],
  keepSessionId: string,
): {
  toUpsert: StrengthRow[];
  toDeleteIds: string[];
  toDeleteEntries: { key: string; date: string }[];
} {
  const dropSessionIds = new Set(groupSessions.map((s) => s.id).filter((id) => id !== keepSessionId));
  const keepRows = strength.filter((r) => r.sessionId === keepSessionId);
  const dropRows = strength.filter((r) => dropSessionIds.has(r.sessionId));

  // Si la sesión descartada tiene pulso/duración/kcal y la conservada no, preservamos esa telemetría en la primera fila conservada
  const donor = dropRows.find((r) => r.avgHr != null || r.durMin != null || r.kcal != null);
  const toUpsert: StrengthRow[] = [];
  if (donor && keepRows.length > 0 && keepRows.every((r) => r.avgHr == null && r.durMin == null)) {
    const first = keepRows[0];
    toUpsert.push({
      ...first,
      ...(donor.avgHr != null ? { avgHr: donor.avgHr } : {}),
      ...(donor.maxHr != null ? { maxHr: donor.maxHr } : {}),
      ...(donor.minHr != null ? { minHr: donor.minHr } : {}),
      ...(donor.durMin != null ? { durMin: donor.durMin } : {}),
      ...(donor.kcal != null ? { kcal: donor.kcal } : {}),
    });
  }

  return {
    toUpsert,
    toDeleteIds: dropRows.map((r) => r.id),
    toDeleteEntries: dropRows.map((r) => ({ key: r.id, date: r.date })),
  };
}
