import type { DayName, Settings, StrengthRow, MuscleMap, Measure, RoutineEx } from '../types';
import { BUILTIN_REF_NAMES, DEFAULT_MUSCLES, MUSCLE_DAY, norm } from './seed';

export const epley = (w: number, r: number) => (r <= 1 ? w : w * (1 + r / 30));
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

export function resolveName(ref: string, s: Settings): string {
  let n = ref.startsWith('name:')
    ? ref.slice(5)
    : (s.refNames[ref] ?? s.customNames[ref] ?? BUILTIN_REF_NAMES[ref] ?? `Samsung ${ref.replace('type:', '#')}`);
  for (let i = 0; i < 5 && s.aliases[n]; i++) n = s.aliases[n];
  return n;
}

export function musclesOf(name: string, s: Settings): MuscleMap | null {
  const k = norm(name);
  return s.muscles[k] ?? DEFAULT_MUSCLES[k] ?? null;
}

export interface ExSession {
  date: string; sets: { w: number; r: number }[];
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

export function judge(name: string, sessions: ExSession[], t?: RoutineEx): Pick<ExStats, 'status' | 'statusColor' | 'prescription'> {
  const last = sessions[sessions.length - 1];
  if (!last) return { status: 'Sin datos', statusColor: 'gray', prescription: 'Importa tus sesiones para ver recomendaciones.' };
  const cmp = sessions.filter((x) => x.top >= last.top * 0.6 && x.top <= last.top * 1.6);
  const prev = cmp[cmp.length - 2];
  const minReps = t?.reps ?? 10;
  const nSets = t?.sets ?? 2;
  const atTop = last.sets.filter((x) => x.w === last.top);
  const hit = atTop.length >= nSets && atTop.slice(0, nSets).every((x) => x.r >= minReps);
  const inc = last.top >= 40 ? 5 : 2.5;
  const maxE = Math.max(...cmp.map((x) => x.e1rm));
  const missing = Math.max(0, nSets * minReps - atTop.slice(0, nSets).reduce((a, b) => a + b.r, 0));

  if (hit) {
    return { status: 'Subir carga', statusColor: 'emeraldGreen',
      prescription: `Completaste ${nSets}×${minReps} con ${last.top} kg. Sube a ${last.top + inc} kg y busca ${nSets}×${minReps}.` };
  }
  if (!prev && sessions.length > 1) {
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
  const perEx = new Map<string, Map<string, { sets: { w: number; r: number }[]; notes: string[]; phys: PhysioAcc }>>();
  const unm = new Map<string, { n: number; last: string }>();
  const sessMap = new Map<string, { date: string; day?: DayName; names: Set<string>; sets: number; phys: PhysioAcc }>();
  const manualDays = new Map<string, DayName>();

  for (const row of rows) {
    const name = resolveName(row.ref, s);
    if (name.startsWith('Samsung #')) {
      const u = unm.get(row.ref) ?? { n: 0, last: '' };
      u.n++; if (row.date > u.last) u.last = row.date;
      unm.set(row.ref, u);
    }
    if (row.day) manualDays.set(name, row.day);
    const byDate = perEx.get(name) ?? new Map<string, { sets: { w: number; r: number }[]; notes: string[]; phys: PhysioAcc }>();
    const entry = byDate.get(row.date) ?? { sets: [], notes: [], phys: { hrs: [], maxHr: 0, durMin: 0, kcal: 0 } };
    entry.sets.push(...row.sets);
    if (row.note?.trim()) entry.notes.push(row.note.trim());
    addPhysio(entry.phys, row);
    byDate.set(row.date, entry);
    perEx.set(name, byDate);
    const sm = sessMap.get(row.sessionId) ?? { date: row.date, day: row.day, names: new Set<string>(), sets: 0, phys: { hrs: [], maxHr: 0, durMin: 0, kcal: 0 } };
    if (row.day && !sm.day) sm.day = row.day;
    sm.names.add(name); sm.sets += row.sets.length; if (row.date < sm.date) sm.date = row.date;
    addPhysio(sm.phys, row);
    sessMap.set(row.sessionId, sm);
  }

  const exercises = new Map<string, ExStats>();
  for (const [name, byDate] of perEx) {
    const sessions: ExSession[] = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, { sets, notes, phys }]) => {
      const top = Math.max(...sets.map((x) => x.w));
      const note = notes.length ? [...new Set(notes)].join(' · ') : undefined;
      return {
        date, sets, top,
        repsAtTop: Math.max(...sets.filter((x) => x.w === top).map((x) => x.r)),
        volume: round(sets.reduce((a, x) => a + x.w * x.r, 0)),
        e1rm: round(Math.max(...sets.map((x) => epley(x.w, x.r)))),
        ...summarizePhysio(phys),
        ...(note ? { note } : {}),
      };
    });
    const tgt = targetOf(name, s);
    const verdict = judge(name, sessions, tgt?.t);
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
      const base = [...exercises.values()].find((e) => norm(e.name) === norm(r.name));
      if (!base) continue;
      added.add(norm(base.name));
      byDay[d].push({ ...base, day: d, target: r, ...judge(base.name, base.sessions, r) });
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
  const d = new Date(date + 'T00:00:00Z');
  const wd = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - wd);
  return d.toISOString().slice(0, 10);
}

/** Series efectivas por músculo y semana: principal = 1, secundario = 0,5. */
export function weeklyVolume(rows: StrengthRow[], s: Settings): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const m = musclesOf(resolveName(row.ref, s), s);
    if (!m) continue;
    const wk = isoWeekStart(row.date);
    const sets = row.sets.length;
    const add = (muscle: string, v: number) => {
      const w = out.get(muscle) ?? new Map<string, number>();
      w.set(wk, (w.get(wk) ?? 0) + v);
      out.set(muscle, w);
    };
    add(m.p, sets);
    m.s.forEach((x) => add(x, sets * 0.5));
  }
  return out;
}

export function latestWith<K extends keyof Measure>(ms: Measure[], key: K): Measure | undefined {
  return [...ms].reverse().find((m) => m[key] != null);
}

export function currentPhase(s: Settings, today = new Date().toISOString().slice(0, 10)) {
  const p = [...s.phases].sort((a, b) => a.start.localeCompare(b.start)).filter((x) => x.start <= today);
  return p[p.length - 1];
}
