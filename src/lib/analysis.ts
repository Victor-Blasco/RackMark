import type { DayName, LoadType, Settings, StrengthRow, MuscleMap, Measure, RoutineEx, SetRec } from '../types';
import { BUILTIN_REF_NAMES, DEFAULT_LOAD_TYPES, DEFAULT_MUSCLES, MUSCLE_DAY, isValidIsoDate, norm, todayIso } from './seed';

export const epley = (w: number, r: number) => (r <= 1 ? w : w * (1 + r / 30));
export const isWorkSet = (s: SetRec) => s.kind !== 'W';
export const isCountedSet = (s: SetRec) => s.kind !== 'W' && s.kind !== 'D';
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

export function resolveName(ref: string, s: Settings): string {
  let n = ref.startsWith('name:')
    ? ref.slice(5)
    : (s.refNames[ref] ?? s.customNames[ref] ?? BUILTIN_REF_NAMES[ref] ?? `Samsung ${ref.replace('type:', '#')}`);
  const seen = new Set<string>();
  while (s.aliases[n] && !seen.has(n) && seen.size < 10) {
    seen.add(n);
    n = s.aliases[n];
  }
  return n;
}

export function musclesOf(name: string, s: Settings): MuscleMap | null {
  const k = norm(name);
  return s.muscles[k] ?? DEFAULT_MUSCLES[k] ?? null;
}

/** Devuelve el tipo de carga configurado para un ejercicio (`external`, `weighted` o `assisted`). */
export function loadTypeOf(name: string, s: Settings): LoadType {
  const k = norm(name);
  return s.loadTypes?.[k] ?? DEFAULT_LOAD_TYPES[k] ?? 'external';
}

/** Obtiene el peso corporal más reciente registrado en `measures` (en kg). */
export function latestBodyWeight(measures: Measure[]): number | null {
  let latestDate = '';
  let latestW: number | null = null;
  for (const m of measures) {
    if (m.weight != null && m.weight > 0 && m.date >= latestDate) {
      latestDate = m.date;
      latestW = m.weight;
    }
  }
  return latestW;
}

/** Calcula la carga total real en kg considerando peso corporal si el ejercicio es lastrado o asistido. */
export function effectiveLoadKg(w: number, loadType: LoadType, bodyWeightKg: number | null): number {
  const clean = Math.max(0, w);
  if (bodyWeightKg == null) return clean;
  if (loadType === 'weighted') return round(bodyWeightKg + clean, 1);
  if (loadType === 'assisted') return round(Math.max(0, bodyWeightKg - clean), 1);
  return clean;
}

export interface ExSession {
  date: string; sets: SetRec[];
  top: number; repsAtTop: number; volume: number; e1rm: number;
  avgHr?: number; maxHr?: number; durMin?: number; kcal?: number;
  note?: string;
}
export interface ExStats {
  name: string; day: DayName | null; target?: RoutineEx;
  sessions: ExSession[]; last?: ExSession; n: number;
  maxWeight: number; maxE1rm: number;
  avgHr?: number; maxHr?: number;
  status: string; statusColor: 'emeraldGreen' | 'electricBlue' | 'coralRed' | 'amberGold' | 'gray';
  prescription: string;
}
export interface Session {
  id: string; date: string; day: DayName | null; exercises: string[]; sets: number;
  avgHr?: number; maxHr?: number; durMin?: number; kcal?: number;
}

export interface Analysis {
  exercises: Map<string, ExStats>;
  sessions: Session[];
  byDay: Record<DayName, ExStats[]>;
  unmapped: { ref: string; n: number; last: string }[];
}

function dayOfExercise(name: string, s: Settings): DayName | null {
  const k = norm(name);
  const routineKeys = Object.keys(s.routines);
  for (const d of routineKeys) if (s.routines[d]?.some((e) => norm(e.name) === k)) return d;
  const m = musclesOf(name, s);
  const mapped = m ? (MUSCLE_DAY[m.p] ?? null) : null;
  return mapped && s.routines[mapped] ? mapped : null;
}

function targetOf(name: string, s: Settings): { day: DayName; t: RoutineEx } | null {
  const k = norm(name);
  for (const d of Object.keys(s.routines)) {
    const t = s.routines[d]?.find((e) => norm(e.name) === k);
    if (t) return { day: d, t };
  }
  return null;
}

export function judge(sessions: ExSession[], t?: RoutineEx): Pick<ExStats, 'status' | 'statusColor' | 'prescription'> {
  const last = sessions[sessions.length - 1];
  if (!last) return { status: 'Sin datos', statusColor: 'gray', prescription: 'Importa tus sesiones para ver recomendaciones.' };
  const minReps = t?.reps ?? 10;
  const nSets = t?.sets ?? 2;
  const atTop = last.sets.filter((x) => isCountedSet(x) && x.w === last.top);
  const hit = atTop.length >= nSets && atTop.slice(0, nSets).every((x) => x.r >= minReps);
  const missing = Math.max(0, nSets * minReps - atTop.slice(0, nSets).reduce((a, b) => a + b.r, 0));

  if (last.top === 0) {
    if (hit) {
      return { status: 'Añadir lastre o reps', statusColor: 'emeraldGreen',
        prescription: `Completaste ${nSets}×${minReps} con peso corporal. Añade lastre (+2,5 kg) o busca ${minReps + 2} reps.` };
    }
    const bwCmp = sessions.filter((x) => x.top === 0);
    const bwPrev = bwCmp[bwCmp.length - 2];
    const bwMaxReps = Math.max(...bwCmp.map((x) => x.repsAtTop));
    if (bwCmp.length > 1 && last.repsAtTop >= bwMaxReps && last.repsAtTop > (bwPrev?.repsAtTop ?? 0)) {
      return { status: 'Récord personal (reps)', statusColor: 'electricBlue',
        prescription: `Nuevo máximo con peso corporal (${last.repsAtTop} reps). Sigue hasta ${nSets}×${minReps}.` };
    }
    if (bwPrev && last.repsAtTop > bwPrev.repsAtTop) {
      return { status: `Progresando (+${last.repsAtTop - bwPrev.repsAtTop} reps)`, statusColor: 'emeraldGreen',
        prescription: `Buen avance con peso corporal (${last.repsAtTop} reps). Faltan ${missing} reps para ${nSets}×${minReps}.` };
    }
    const bwRecent = bwCmp.slice(-4);
    if (bwRecent.length === 4 && bwRecent[3].repsAtTop <= bwRecent[0].repsAtTop) {
      return { status: 'Estancado', statusColor: 'coralRed',
        prescription: '4 sesiones sin subir repeticiones con peso corporal. Alarga el descanso a 3 min o cambia el tempo.' };
    }
    return { status: 'Consolidando', statusColor: 'amberGold',
      prescription: `Mantén peso corporal buscando ${nSets}×${minReps} (faltan ${missing} reps).` };
  }

  const cmp = sessions.filter((x) => x.top >= last.top * 0.6 && x.top <= last.top * 1.6);
  const prev = cmp[cmp.length - 2];
  const inc = last.top >= 80 ? 5 : 2.5;
  const maxE = Math.max(...cmp.map((x) => x.e1rm));

  if (hit) {
    return { status: 'Subir carga', statusColor: 'emeraldGreen',
      prescription: `Completaste ${nSets}×${minReps} con ${last.top} kg. Sube a ${last.top + inc} kg y busca ${nSets}×${minReps}.` };
  }
  if (!prev && sessions.length > 1) {
    if (sessions.slice(0, -1).every((x) => x.top === 0)) {
      return { status: `Progresando (+${round(last.top)} kg)`, statusColor: 'emeraldGreen',
        prescription: `Primer registro con lastre (${last.top} kg). Mantén esta carga buscando ${nSets}×${minReps}.` };
    }
    return { status: 'Cambio de carga', statusColor: 'amberGold',
      prescription: `Carga muy distinta a las sesiones previas (${last.top} kg). ¿Cambio de máquina o unidad? Revisa los datos antes de decidir.` };
  }
  if (prev && last.top > prev.top) {
    return { status: `Progresando (+${round(last.top - prev.top)} kg)`, statusColor: 'emeraldGreen',
      prescription: `Mantén ${last.top} kg y consolida: faltan ${missing} reps para ${nSets}×${minReps}.` };
  }
  if (cmp.length > 2 && last.e1rm >= maxE * 0.999 && last.e1rm > (prev?.e1rm ?? 0)) {
    return { status: 'Récord personal (e1RM)', statusColor: 'electricBlue',
      prescription: `Nuevo máximo estimado (${round(last.e1rm)} kg). Mantén ${last.top} kg hasta ${nSets}×${minReps}.` };
  }
  if (prev && last.top === prev.top && last.repsAtTop > prev.repsAtTop) {
    const diffReps = last.repsAtTop - prev.repsAtTop;
    return { status: `Progresando (+${diffReps} ${diffReps === 1 ? 'rep' : 'reps'})`, statusColor: 'emeraldGreen',
      prescription: `Buen avance (+${diffReps} ${diffReps === 1 ? 'rep' : 'reps'}) con ${last.top} kg. Sigue hasta ${nSets}×${minReps} (faltan ${missing} reps).` };
  }
  const recent = cmp.slice(-4);
  const stalled = recent.length === 4 && recent.every((x) => x.top === last.top) && recent[3].repsAtTop <= recent[0].repsAtTop;
  const avgReps = atTop.length ? atTop.reduce((a, b) => a + b.r, 0) / atTop.length : 0;
  if (avgReps < minReps - 3 || stalled) {
    return { status: stalled ? 'Estancado' : 'Ajustar carga (reps bajas)', statusColor: 'coralRed',
      prescription: stalled
        ? `4 sesiones sin mejora con ${last.top} kg. Alarga el descanso a 3 min o baja a ${Math.max(0, last.top - inc)} kg y progresa en reps.`
        : `Reps medias ${round(avgReps)} frente al objetivo de ${minReps}. Considera bajar a ${Math.max(0, last.top - inc)} kg.` };
  }
  return { status: 'Consolidando', statusColor: 'amberGold',
    prescription: `Mantén ${last.top} kg buscando ${nSets}×${minReps} (faltan ${missing} reps) antes de subir a ${last.top + inc} kg.` };
}

/** Leyenda resumida de los estados automáticos de progresión en fuerza. */
export const STATUS_LEGEND: ReadonlyArray<{ label: string; dot: string; desc: string }> = [
  { label: 'Subir carga', dot: 'bg-emeraldGreen', desc: 'Completaste todas las series×reps objetivo: toca subir +2,5 kg (menos de 80 kg) o +5 kg (desde 80 kg).' },
  { label: 'Progresando', dot: 'bg-emeraldGreen', desc: 'Subiste peso o repeticiones respecto a la sesión comparable anterior.' },
  { label: 'Récord personal', dot: 'bg-electricBlue', desc: 'Mejor marca histórica comparable de fuerza estimada o repeticiones.' },
  { label: 'Consolidando', dot: 'bg-amberGold', desc: 'Aún faltan repeticiones para completar el objetivo con este peso, sin estancamiento.' },
  { label: 'Cambio de carga', dot: 'bg-amberGold', desc: 'Peso fuera del rango 60%–160% previo (p. ej., cambio de máquina o unidad).' },
  { label: 'Estancado / Ajustar', dot: 'bg-coralRed', desc: '4 sesiones seguidas al mismo peso sin subir reps, o media >3 reps bajo objetivo.' },
];

/** Explica en lenguaje claro la regla que originó el estado actual del ejercicio. */
export function describeStatus(e: ExStats, aiStatus?: string): string {
  const nSets = e.target?.sets ?? 2;
  const minReps = e.target?.reps ?? 10;
  const last = e.last;
  const prefix = aiStatus && aiStatus !== e.status
    ? `Estado del Coach IA («${aiStatus}»). Regla local (${e.status}): `
    : `Regla aplicada (${e.status}): `;
  if (!last) return `${prefix}no hay sesiones registradas para este ejercicio.`;

  const top = last.top;
  const inc = top >= 80 ? 5 : 2.5;
  const s = e.status;
  if (s === 'Subir carga') {
    return `${prefix}completaste al menos ${nSets}×${minReps} con ${top} kg; el siguiente salto sugerido es +${inc} kg (+2,5 kg por debajo de 80 kg y +5 kg desde 80 kg).`;
  }
  if (s === 'Añadir lastre o reps') {
    return `${prefix}completaste ${nSets}×${minReps} con peso corporal (0 kg); ya puedes añadir lastre (+2,5 kg) o ampliar repeticiones.`;
  }
  if (s === 'Cambio de carga') {
    return `${prefix}la carga actual (${top} kg) queda fuera del margen comparable (60%–160%) frente a sesiones anteriores.`;
  }
  if (s.startsWith('Récord personal')) {
    const metric = top === 0 ? `${last.repsAtTop} reps máximas` : `${round(last.e1rm)} kg de e1RM`;
    return `${prefix}alcanzaste tu mejor marca comparable (${metric}) mientras buscas consolidar ${nSets}×${minReps}.`;
  }
  if (s.startsWith('Progresando')) {
    const what = top === 0 ? 'tus repeticiones' : s.includes('rep') ? `tus repeticiones máximas con ${top} kg` : 'tu carga máxima';
    return `${prefix}superaste ${what} frente a la sesión comparable anterior camino a ${nSets}×${minReps}.`;
  }
  if (s === 'Estancado') {
    return `${prefix}llevas 4 sesiones comparables seguidas con ${top === 0 ? 'peso corporal' : `${top} kg`} sin mejorar tus repeticiones máximas.`;
  }
  if (s.startsWith('Ajustar carga')) {
    return `${prefix}la media de repeticiones con ${top} kg quedó más de 3 reps por debajo de tu objetivo (${minReps} reps).`;
  }
  return `${prefix}aún faltan repeticiones para completar ${nSets}×${minReps} con ${top === 0 ? 'peso corporal' : `${top} kg`}, sin señales de estancamiento en las últimas 4 sesiones.`;
}

interface PhysioAcc { hrs: number[]; maxHr: number; durMin: number; kcal: number }

function addPhysio(acc: PhysioAcc, row: StrengthRow) {
  if (row.avgHr) acc.hrs.push(row.avgHr);
  if (row.maxHr && row.maxHr > acc.maxHr) acc.maxHr = row.maxHr;
  if (row.durMin) acc.durMin += row.durMin;
  if (row.kcal) acc.kcal += row.kcal;
}

function summarizePhysio(acc: PhysioAcc) {
  return {
    ...(acc.hrs.length ? { avgHr: Math.round(acc.hrs.reduce((a, b) => a + b, 0) / acc.hrs.length) } : {}),
    ...(acc.maxHr > 0 ? { maxHr: acc.maxHr } : {}),
    ...(acc.durMin > 0 ? { durMin: round(acc.durMin) } : {}),
    ...(acc.kcal > 0 ? { kcal: Math.round(acc.kcal) } : {}),
  };
}

export function analyze(rows: StrengthRow[], s: Settings): Analysis {
  const perEx = new Map<string, Map<string, { sets: SetRec[]; seenSigs: Set<string>; notes: string[]; phys: PhysioAcc }>>();
  const unm = new Map<string, { n: number; last: string }>();
  const sessMap = new Map<string, { date: string; day?: DayName; names: Set<string>; sets: number; phys: PhysioAcc }>();
  const manualDays = new Map<string, DayName>();
  const canonicalByNorm = new Map<string, string>();
  for (const d of Object.keys(s.routines)) {
    for (const r of s.routines[d] ?? []) {
      const t = r.name.trim();
      if (t && !canonicalByNorm.has(norm(t))) canonicalByNorm.set(norm(t), t);
    }
  }

  for (const row of [...rows].sort((a, b) => a.ts - b.ts)) {
    const validSets = row.sets.filter((x) => Number.isFinite(x.w) && x.w >= 0 && Number.isFinite(x.r) && x.r > 0);
    if (!validSets.length || !isValidIsoDate(row.date)) continue;
    const rawName = resolveName(row.ref, s);
    const k = norm(rawName);
    const name = canonicalByNorm.get(k) ?? rawName;
    if (!canonicalByNorm.has(k)) canonicalByNorm.set(k, name);
    if (name.startsWith('Samsung #')) {
      const u = unm.get(row.ref) ?? { n: 0, last: '' };
      u.n++; if (row.date > u.last) u.last = row.date;
      unm.set(row.ref, u);
    }
    if (row.day) manualDays.set(name, row.day);
    const byDate = perEx.get(name) ?? new Map<string, { sets: SetRec[]; seenSigs: Set<string>; notes: string[]; phys: PhysioAcc }>();
    const entry = byDate.get(row.date) ?? { sets: [], seenSigs: new Set<string>(), notes: [], phys: { hrs: [], maxHr: 0, durMin: 0, kcal: 0 } };
    const sig = validSets.map((x) => `${x.w}x${x.r}`).join('|');
    const isDuplicateSets = entry.seenSigs.has(sig);
    if (!isDuplicateSets) {
      entry.seenSigs.add(sig);
      entry.sets.push(...validSets);
      addPhysio(entry.phys, row);
    } else if (entry.phys.hrs.length === 0 && entry.phys.durMin === 0) {
      addPhysio(entry.phys, row);
    }
    if (row.note?.trim()) entry.notes.push(row.note.trim());
    byDate.set(row.date, entry);
    perEx.set(name, byDate);
    const sm = sessMap.get(row.sessionId) ?? { date: row.date, day: row.day, names: new Set<string>(), sets: 0, phys: { hrs: [], maxHr: 0, durMin: 0, kcal: 0 } };
    if (row.day && !sm.day) sm.day = row.day;
    sm.names.add(name);
    if (!isDuplicateSets) {
      sm.sets += validSets.length;
      addPhysio(sm.phys, row);
    }
    if (row.date < sm.date) sm.date = row.date;
    sessMap.set(row.sessionId, sm);
  }

  const exercises = new Map<string, ExStats>();
  for (const [name, byDate] of perEx) {
    const sessions: ExSession[] = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, { sets, notes, phys }]) => {
      const workSets = sets.filter(isWorkSet);
      const active = workSets.length ? workSets : sets;
      const top = Math.max(...active.map((x) => x.w));
      const note = notes.length ? [...new Set(notes)].join(' · ') : undefined;
      return {
        date, sets, top,
        repsAtTop: Math.max(...active.filter((x) => x.w === top).map((x) => x.r)),
        volume: round(active.reduce((a, x) => a + x.w * x.r, 0)),
        e1rm: round(Math.max(...active.map((x) => epley(x.w, x.r)))),
        ...summarizePhysio(phys),
        ...(note ? { note } : {}),
      };
    });
    const tgt = targetOf(name, s);
    const verdict = judge(sessions, tgt?.t);
    const hrs = sessions.map((x) => x.avgHr).filter((h): h is number => h != null);
    const maxHrs = sessions.map((x) => x.maxHr).filter((h): h is number => h != null);
    exercises.set(name, {
      name, day: tgt?.day ?? dayOfExercise(name, s) ?? manualDays.get(name) ?? null, target: tgt?.t, sessions,
      last: sessions[sessions.length - 1], n: sessions.length,
      maxWeight: Math.max(...sessions.map((x) => x.top)), maxE1rm: Math.max(...sessions.map((x) => x.e1rm)),
      ...(hrs.length ? { avgHr: Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) } : {}),
      ...(maxHrs.length ? { maxHr: Math.max(...maxHrs) } : {}),
      ...verdict,
    });
  }

  const sessions: Session[] = [...sessMap.entries()].map(([id, v]) => {
    let day: DayName | null = v.day ?? null;
    if (!day) {
      const votes: Record<string, number> = {};
      v.names.forEach((n) => { const d = dayOfExercise(n, s); if (d) votes[d] = (votes[d] ?? 0) + 1; });
      const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
      day = (best?.[0] as DayName) ?? null;
    }
    return { id, date: v.date, day, exercises: [...v.names], sets: v.sets, ...summarizePhysio(v.phys) };
  }).sort((a, b) => a.date.localeCompare(b.date));

  const byDay: Record<DayName, ExStats[]> = {};
  for (const d of Object.keys(s.routines)) {
    byDay[d] = [];
    const added = new Set<string>();
    for (const r of s.routines[d]) {
      if (added.has(norm(r.name))) continue;
      const base = [...exercises.values()].find((e) => norm(e.name) === norm(r.name));
      if (!base) continue;
      added.add(norm(base.name));
      byDay[d].push({ ...base, day: d, target: r, ...judge(base.sessions, r) });
    }
    for (const [name, day] of manualDays) {
      if (day !== d || added.has(norm(name))) continue;
      const base = exercises.get(name);
      if (!base) continue;
      added.add(norm(name));
      byDay[d].push({ ...base, day: d });
    }
  }
  return { exercises, sessions, byDay, unmapped: [...unm.entries()].map(([ref, v]) => ({ ref, ...v })) };
}

export function isoWeekStart(date: string): string {
  const safeDate = isValidIsoDate(date) ? date : todayIso();
  const d = new Date(`${safeDate}T00:00:00Z`);
  const wd = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - wd);
  return d.toISOString().slice(0, 10);
}

/** Devuelve créditos semanales únicos por músculo: principal = 1, secundarios (únicos y distintos de p) = 0,5. */
export function effectiveMuscleCredits(m: MuscleMap): [string, number][] {
  const p = m.p.trim();
  const out: [string, number][] = p ? [[p, 1]] : [];
  for (const s of new Set(m.s.map((x) => x.trim()).filter((x) => x && x !== p))) {
    out.push([s, 0.5]);
  }
  return out;
}

/** Busca estadísticas analizadas por nombre exacto o normalizado. */
export function findAnalyzedExercise(analysis: Analysis, name: string): ExStats | undefined {
  const direct = analysis.exercises.get(name);
  if (direct) return direct;
  const k = norm(name);
  return [...analysis.exercises.values()].find((e) => norm(e.name) === k);
}

/** Series efectivas por músculo y semana: principal = 1, secundario = 0,5. */
export function weeklyVolume(
  rows: StrengthRow[],
  s: Settings,
  from: string | null = null,
  to: string | null = null,
): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  const seenDaySigs = new Set<string>();
  for (const row of [...rows].sort((a, b) => a.ts - b.ts)) {
    if (!row || !isValidIsoDate(row.date) || !Array.isArray(row.sets)) continue;
    if (from && row.date < from) continue;
    if (to && row.date > to) continue;
    const validSets = row.sets.filter((x) =>
      x && Number.isFinite(x.w) && x.w >= 0 && Number.isFinite(x.r) && x.r > 0 && isCountedSet(x),
    );
    if (!validSets.length) continue;
    const name = resolveName(row.ref, s);
    const sigKey = `${norm(name)}|${row.date}|${validSets.map((x) => `${x.w}x${x.r}`).join('|')}`;
    if (seenDaySigs.has(sigKey)) continue;
    seenDaySigs.add(sigKey);
    const m = musclesOf(name, s);
    if (!m) continue;
    const wk = isoWeekStart(row.date);
    const sets = validSets.length;
    for (const [muscle, factor] of effectiveMuscleCredits(m)) {
      const w = out.get(muscle) ?? new Map<string, number>();
      w.set(wk, (w.get(wk) ?? 0) + sets * factor);
      out.set(muscle, w);
    }
  }
  return out;
}

export function currentPhase(s: Settings, today = todayIso()) {
  const p = [...s.phases].sort((a, b) => a.start.localeCompare(b.start)).filter((x) => x.start <= today);
  return p[p.length - 1];
}
