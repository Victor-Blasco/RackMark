import { MEASURE_FIELDS } from '../types';
import type {
  AiEntry, AiJob, AiResult, AiSection, CardioRow, DailyWellbeing, DataKind, DataRecord, DayName, Measure, MuscleMap, RoutineEx, RoutineMeta, Settings, StrengthRow, SyncJob,
} from '../types';
import { DEFAULT_SETTINGS, isValidIsoDate, LEGACY_ROUTINE_COLORS, norm, UNSAFE_KEYS } from './seed';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const MAX_BACKUP_BYTES = 50 * 1024 * 1024;
const MAX_AUX_MAP_ENTRIES = 500;
const MAX_PHASES = 100;
const WELLBEING_KEYS: (keyof DailyWellbeing)[] = [
  'sleepMin', 'sleepScore', 'sleepEff', 'remMin', 'deepMin', 'physRec', 'mentalRec',
  'steps', 'stepKm', 'activeMin', 'stepKcal', 'energyScore', 'rhr', 'hrv',
];
const STRENGTH_NUM_KEYS: (keyof StrengthRow)[] = ['durMin', 'avgHr', 'maxHr', 'minHr', 'kcal'];

const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const fin = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

function pickFiniteNums<T extends object>(src: Record<string, unknown>, keys: (keyof T)[], target: Partial<T>): void {
  for (const k of keys) {
    const n = fin(src[k as string]);
    if (n !== undefined) (target as Record<string, number>)[k as string] = n;
  }
}

function sanitizeStringMap(raw: unknown, maxEntries = MAX_AUX_MAP_ENTRIES): Record<string, string> {
  if (!isObj(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (Object.keys(out).length >= maxEntries) break;
    if (!UNSAFE_KEYS.has(k) && typeof v === 'string') out[k] = v;
  }
  return out;
}

const STORES = ['strength', 'cardio', 'measures', 'wellbeing', 'kv'] as const;
type Store = (typeof STORES)[number];

let dbp: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      const rq = indexedDB.open('gymapp', 2);
      rq.onupgradeneeded = () => {
        const db = rq.result;
        if (!db.objectStoreNames.contains('strength')) db.createObjectStore('strength', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('cardio')) db.createObjectStore('cardio', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('measures')) db.createObjectStore('measures', { keyPath: 'date' });
        if (!db.objectStoreNames.contains('wellbeing')) db.createObjectStore('wellbeing', { keyPath: 'date' });
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => {
        dbp = null;
        rej(rq.error);
      };
      rq.onblocked = () => {
        dbp = null;
        rej(new Error('Base de datos bloqueada por otra pestaña'));
      };
    });
  }
  return dbp;
}

const wrap = <T>(rq: IDBRequest<T>) => new Promise<T>((res, rej) => { rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); });

async function tx(store: Store, mode: IDBTransactionMode) {
  const db = await open();
  return db.transaction(store, mode).objectStore(store);
}

export async function putMany<T>(store: Store, items: T[]): Promise<void> {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const t = db.transaction(store, 'readwrite');
    const os = t.objectStore(store);
    items.forEach((i) => os.put(i));
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}
export const getAll = async <T>(store: Store): Promise<T[]> => wrap((await tx(store, 'readonly')).getAll() as IDBRequest<T[]>);
export const deleteKey = async (store: Store, key: IDBValidKey) => { await wrap((await tx(store, 'readwrite')).delete(key)); };
export async function deleteMany(store: Store, keys: IDBValidKey[]): Promise<void> {
  if (!keys.length) return;
  const db = await open();
  await new Promise<void>((res, rej) => {
    const t = db.transaction(store, 'readwrite');
    const os = t.objectStore(store);
    keys.forEach((k) => os.delete(k));
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}

export async function loadSettings(): Promise<Settings> {
  const saved = (await wrap((await tx('kv', 'readonly')).get('settings'))) as Partial<Settings> | undefined;
  return saved ? sanitizeSettings(saved) : structuredClone(DEFAULT_SETTINGS);
}
export async function saveSettings(s: Settings): Promise<void> {
  await wrap((await tx('kv', 'readwrite')).put(s, 'settings'));
}

const AI_JOB_KEY = 'ai_job';

export async function loadAiJob(): Promise<AiJob | undefined> {
  const raw = await wrap((await tx('kv', 'readonly')).get(AI_JOB_KEY)) as unknown;
  if (!isObj(raw) || typeof raw.id !== 'string' || !isObj(raw.payload)) return undefined;
  if (raw.status !== 'pending' && raw.status !== 'running' && raw.status !== 'completed' && raw.status !== 'error') return undefined;
  if (raw.tone !== 'simple' && raw.tone !== 'technical') return undefined;
  const createdAt = fin(raw.createdAt);
  const updatedAt = fin(raw.updatedAt);
  const attempts = fin(raw.attempts);
  if (createdAt == null || updatedAt == null || attempts == null) return undefined;
  return {
    id: raw.id.slice(0, 100),
    status: raw.status,
    tone: raw.tone,
    payload: raw.payload,
    createdAt,
    updatedAt,
    attempts: Math.max(0, Math.round(attempts)),
    ...(fin(raw.startedAt) != null ? { startedAt: fin(raw.startedAt) } : {}),
    ...(fin(raw.finishedAt) != null ? { finishedAt: fin(raw.finishedAt) } : {}),
    ...(typeof raw.error === 'string' ? { error: raw.error.slice(0, 500) } : {}),
  };
}

export async function saveAiJob(job: AiJob): Promise<void> {
  await wrap((await tx('kv', 'readwrite')).put(job, AI_JOB_KEY));
}

export async function clearAiJob(): Promise<void> {
  await wrap((await tx('kv', 'readwrite')).delete(AI_JOB_KEY));
}

const SYNC_JOB_KEY = 'sync_job';

export async function loadSyncJob(): Promise<SyncJob | undefined> {
  const raw = await wrap((await tx('kv', 'readonly')).get(SYNC_JOB_KEY)) as unknown;
  if (!isObj(raw) || raw.id !== 'cloud-sync' || !['pending', 'running', 'error'].includes(String(raw.status))) return undefined;
  const createdAt = fin(raw.createdAt);
  const updatedAt = fin(raw.updatedAt);
  const attempts = fin(raw.attempts);
  const nextAttemptAt = fin(raw.nextAttemptAt);
  if (createdAt == null || updatedAt == null || attempts == null) return undefined;
  return {
    id: 'cloud-sync',
    status: raw.status as SyncJob['status'],
    createdAt,
    updatedAt,
    attempts: Math.max(0, Math.round(attempts)),
    ...(typeof raw.error === 'string' ? { error: raw.error.slice(0, 500) } : {}),
    ...(nextAttemptAt != null ? { nextAttemptAt } : {}),
  };
}

export async function saveSyncJob(job: SyncJob): Promise<void> {
  await wrap((await tx('kv', 'readwrite')).put(job, SYNC_JOB_KEY));
}

export async function clearSyncJob(): Promise<void> {
  await wrap((await tx('kv', 'readwrite')).delete(SYNC_JOB_KEY));
}

export async function mergeWellbeing(items: DailyWellbeing[]): Promise<void> {
  if (!items.length) return;
  const existing = new Map((await getAll<DailyWellbeing>('wellbeing')).map((w) => [w.date, w]));
  const merged = items.map((item) => {
    const clean = Object.fromEntries(Object.entries(item).filter(([, v]) => v !== undefined)) as DailyWellbeing;
    return { ...(existing.get(item.date) ?? {}), ...clean };
  });
  await putMany('wellbeing', merged);
}

export interface Backup {
  version: 1;
  exportedAt: string;
  strength: StrengthRow[];
  cardio: CardioRow[];
  measures: Measure[];
  wellbeing?: DailyWellbeing[];
  settings: Settings;
}

export async function exportBackup(): Promise<Backup> {
  return {
    version: 1, exportedAt: new Date().toISOString(),
    strength: await getAll('strength'), cardio: await getAll('cardio'),
    measures: await getAll('measures'), wellbeing: await getAll('wellbeing'), settings: await loadSettings(),
  };
}

function sanitizeProfile(raw: unknown, base: Settings['profile']): void {
  if (!isObj(raw)) return;
  if (typeof raw.sex === 'string' && raw.sex.trim()) base.sex = raw.sex.trim().slice(0, 64);
  const age = fin(raw.age);
  if (age !== undefined && age > 0 && age < 130) base.age = age;
  const height = fin(raw.height);
  if (height !== undefined && height > 40 && height < 270) base.height = height;
  if (raw.goal === 'bulk' || raw.goal === 'cut' || raw.goal === 'recomp' || raw.goal === 'strength') {
    base.goal = raw.goal;
  }
  if (raw.experience === 'beginner' || raw.experience === 'intermediate' || raw.experience === 'advanced') {
    base.experience = raw.experience;
  }
  const dpw = fin(raw.daysPerWeek);
  if (dpw !== undefined && dpw >= 1 && dpw <= 7) base.daysPerWeek = Math.round(dpw);
}

function sanitizeRoutines(raw: unknown): Record<DayName, RoutineEx[]> | null {
  if (!isObj(raw)) return null;
  const cleanRoutines: Record<DayName, RoutineEx[]> = {};
  for (const [rawDay, list] of Object.entries(raw)) {
    const day = rawDay.trim();
    if (!day || day.length > 40 || UNSAFE_KEYS.has(day) || !Array.isArray(list)) continue;
    if (Object.keys(cleanRoutines).length >= 20) break;
    cleanRoutines[day] = list.flatMap((ex): RoutineEx[] => {
      if (!isObj(ex) || typeof ex.name !== 'string' || !ex.name.trim()) return [];
      const sets = fin(ex.sets);
      const reps = fin(ex.reps);
      if (!sets || sets <= 0 || !reps || reps <= 0) return [];
      const restSec = fin(ex.restSec);
      return [{
        name: ex.name.trim(),
        sets,
        reps,
        ...(restSec !== undefined && restSec >= 15 && restSec <= 1800 ? { restSec: Math.round(restSec) } : {}),
      }];
    });
  }
  return Object.keys(cleanRoutines).length > 0 ? cleanRoutines : null;
}

function sanitizeRoutineMeta(raw: unknown): Record<DayName, RoutineMeta> | null {
  if (!isObj(raw)) return null;
  const cleanMeta: Record<DayName, RoutineMeta> = {};
  for (const [rawDay, val] of Object.entries(raw)) {
    const day = rawDay.trim();
    if (!day || day.length > 40 || UNSAFE_KEYS.has(day) || !isObj(val)) continue;
    if (Object.keys(cleanMeta).length >= 20) break;
    const meta: RoutineMeta = {};
    if (typeof val.color === 'string' && HEX_COLOR_RE.test(val.color)) {
      const up = val.color.toUpperCase();
      meta.color = LEGACY_ROUTINE_COLORS.has(up) ? '#A855F7' : val.color;
    }
    if (typeof val.sub === 'string' && val.sub.trim()) meta.sub = val.sub.trim().slice(0, 40);
    const freq = fin(val.freq);
    if (freq !== undefined) {
      const rounded = Math.round(freq);
      if (rounded >= 0 && rounded <= 7) meta.freq = rounded;
    }
    if (meta.color || meta.sub || meta.freq !== undefined) cleanMeta[day] = meta;
  }
  return cleanMeta;
}

function sanitizePhases(raw: unknown): Settings['phases'] | null {
  if (!Array.isArray(raw)) return null;
  return raw.flatMap((p) =>
    isObj(p) && typeof p.name === 'string' && p.name.trim() && isValidIsoDate(p.start)
      ? [{ name: p.name.trim().slice(0, 80), start: p.start }]
      : [],
  ).slice(0, MAX_PHASES);
}

function sanitizeAiResult(raw: unknown): AiResult | undefined {
  if (!isObj(raw) || !isValidIsoDate(raw.date) || !isObj(raw.byExercise)) return undefined;
  const byExercise: Record<string, AiEntry> = {};
  for (const [k, v] of Object.entries(raw.byExercise)) {
    if (Object.keys(byExercise).length >= MAX_AUX_MAP_ENTRIES) break;
    if (UNSAFE_KEYS.has(k) || !isObj(v)) continue;
    const entry: AiEntry = {};
    if (typeof v.status === 'string') entry.status = v.status.slice(0, 500);
    if (typeof v.prescription === 'string') entry.prescription = v.prescription.slice(0, 1000);
    if (typeof v.biomech === 'string') entry.biomech = v.biomech.slice(0, 1000);
    byExercise[k] = entry;
  }
  const ai: AiResult = { date: raw.date, byExercise };
  if (raw.tone === 'simple' || raw.tone === 'technical') ai.tone = raw.tone;
  if (typeof raw.summary === 'string') ai.summary = raw.summary.slice(0, 20000);
  if (isObj(raw.overview) && typeof raw.overview.overallStatus === 'string') {
    const highlights = Array.isArray(raw.overview.highlights)
      ? raw.overview.highlights.filter((h): h is string => typeof h === 'string')
      : [];
    const sections: AiSection[] = Array.isArray(raw.overview.sections)
      ? raw.overview.sections.flatMap((s) =>
          isObj(s) && typeof s.title === 'string' && typeof s.text === 'string'
            ? [{ title: s.title, verdict: s.verdict === 'good' || s.verdict === 'warning' ? s.verdict : 'neutral', text: s.text }]
            : [],
        )
      : [];
    ai.overview = { overallStatus: raw.overview.overallStatus, highlights, sections };
  }
  return ai;
}

export function sanitizeSettings(raw: unknown): Settings {
  const base = structuredClone(DEFAULT_SETTINGS);
  if (!isObj(raw)) return base;

  sanitizeProfile(raw.profile, base.profile);
  const routines = sanitizeRoutines(raw.routines);
  if (routines) base.routines = routines;
  const routineMeta = sanitizeRoutineMeta(raw.routineMeta);
  if (routineMeta) base.routineMeta = routineMeta;

  base.customNames = { ...base.customNames, ...sanitizeStringMap(raw.customNames) };
  base.refNames = { ...base.refNames, ...sanitizeStringMap(raw.refNames) };
  base.aliases = { ...base.aliases, ...sanitizeStringMap(raw.aliases) };
  base.notes = { ...base.notes, ...sanitizeStringMap(raw.notes) };

  if (isObj(raw.muscles)) {
    for (const [k, v] of Object.entries(raw.muscles)) {
      if (Object.keys(base.muscles).length >= MAX_AUX_MAP_ENTRIES) break;
      if (UNSAFE_KEYS.has(k) || !isObj(v) || typeof v.p !== 'string' || !Array.isArray(v.s)) continue;
      const sec = v.s.filter((item): item is string => typeof item === 'string');
      base.muscles[k] = { p: v.p, s: sec } satisfies MuscleMap;
    }
  }

  if (Array.isArray(raw.hiddenExercises)) {
    const cleanHidden = [...new Set(
      raw.hiddenExercises
        .filter((x): x is string => typeof x === 'string')
        .map((x) => norm(x.slice(0, 80)))
        .filter(Boolean),
    )].slice(0, MAX_AUX_MAP_ENTRIES);
    if (cleanHidden.length) base.hiddenExercises = cleanHidden;
  }

  if (isObj(raw.loadTypes)) {
    const cleanLoadTypes: Record<string, 'external' | 'weighted' | 'assisted'> = {};
    for (const [k, v] of Object.entries(raw.loadTypes)) {
      if (Object.keys(cleanLoadTypes).length >= MAX_AUX_MAP_ENTRIES) break;
      const nk = norm(k.slice(0, 80));
      if (!nk || UNSAFE_KEYS.has(nk)) continue;
      if (v === 'external' || v === 'weighted' || v === 'assisted') cleanLoadTypes[nk] = v;
    }
    if (Object.keys(cleanLoadTypes).length) base.loadTypes = cleanLoadTypes;
  }

  const phases = sanitizePhases(raw.phases);
  if (phases) base.phases = phases;
  if (typeof raw.onboardingCompleted === 'boolean') base.onboardingCompleted = raw.onboardingCompleted;
  if (raw.aiTone === 'simple' || raw.aiTone === 'technical') base.aiTone = raw.aiTone;
  if (raw.theme === 'dark' || raw.theme === 'light' || raw.theme === 'system') base.theme = raw.theme;
  const ai = sanitizeAiResult(raw.ai);
  if (ai) base.ai = ai;

  return base;
}

const MEASURE_KEYS = MEASURE_FIELDS.map((f) => f.key);

function sanitizeStrengthRow(r: unknown): StrengthRow | null {
  if (!isObj(r) || typeof r.id !== 'string' || !r.id || !isValidIsoDate(r.date) || typeof r.ref !== 'string' || !r.ref || !Array.isArray(r.sets)) return null;
  const sets = r.sets.flatMap((s) => {
    if (!isObj(s)) return [];
    const w = fin(s.w);
    const reps = fin(s.r);
    const restSec = fin(s.restSec);
    const rir = fin(s.rir);
    const kind = s.kind === 'W' || s.kind === 'F' || s.kind === 'D' ? (s.kind as 'W' | 'F' | 'D') : undefined;
    return w !== undefined && w >= 0 && reps !== undefined && reps > 0
      ? [{
          w,
          r: reps,
          ...(restSec !== undefined && restSec >= 0 && restSec <= 1800 ? { restSec: Math.round(restSec) } : {}),
          ...(rir !== undefined && rir >= 0 && rir <= 10 ? { rir: Math.round(rir) } : {}),
          ...(kind ? { kind } : {}),
        }]
      : [];
  });
  if (!sets.length) return null;
  const row: StrengthRow = {
    id: r.id,
    sessionId: typeof r.sessionId === 'string' && r.sessionId ? r.sessionId : r.date,
    ts: fin(r.ts) ?? 0,
    date: r.date,
    ref: r.ref,
    sets,
  };
  pickFiniteNums(r, STRENGTH_NUM_KEYS, row);
  if (typeof r.note === 'string') row.note = r.note;
  if (typeof r.day === 'string' && r.day.trim().length > 0 && r.day.trim().length <= 40 && !UNSAFE_KEYS.has(r.day.trim())) {
    row.day = r.day.trim();
  }
  return row;
}

function sanitizeCardioRow(r: unknown): CardioRow | null {
  if (!isObj(r) || typeof r.id !== 'string' || !r.id || !isValidIsoDate(r.date)) return null;
  const type = fin(r.type); const durMin = fin(r.durMin); const distKm = fin(r.distKm);
  const avgHr = fin(r.avgHr); const kcal = fin(r.kcal);
  if (type === undefined || durMin === undefined || distKm === undefined || avgHr === undefined || kcal === undefined) return null;
  const row: CardioRow = { id: r.id, ts: fin(r.ts) ?? 0, date: r.date, type, durMin, distKm, avgHr, kcal };
  const vo2 = fin(r.vo2);
  if (vo2 !== undefined) row.vo2 = vo2;
  return row;
}

function sanitizeMeasureRow(r: unknown): Measure | null {
  if (!isObj(r) || !isValidIsoDate(r.date)) return null;
  const m: Measure = { date: r.date };
  pickFiniteNums(r, MEASURE_KEYS, m);
  if (typeof r.note === 'string') m.note = r.note;
  return m;
}

function sanitizeWellbeingRow(r: unknown): DailyWellbeing | null {
  if (!isObj(r) || !isValidIsoDate(r.date)) return null;
  const w: DailyWellbeing = { date: r.date };
  pickFiniteNums(r, WELLBEING_KEYS, w);
  return w;
}

const RECORD_SANITIZERS: Record<DataKind, (r: unknown) => DataRecord | null> = {
  strength: sanitizeStrengthRow,
  cardio: sanitizeCardioRow,
  measures: sanitizeMeasureRow,
  wellbeing: sanitizeWellbeingRow,
};

/** Valida y sanea un registro individual de cualquier colección externa (backup o bucket remoto). */
export function sanitizeDataRecord(kind: DataKind, raw: unknown): DataRecord | null {
  return RECORD_SANITIZERS[kind](raw);
}

/** Valida y sanea un JSON de copia de seguridad antes de escribirlo en IndexedDB. */
export function parseBackup(jsonText: string): Backup {
  if (jsonText.length > MAX_BACKUP_BYTES) throw new Error('Archivo de backup demasiado grande.');
  let raw: unknown;
  try { raw = JSON.parse(jsonText); } catch { throw new Error('El archivo seleccionado no es una copia de seguridad válida.'); }
  if (!isObj(raw) || raw.version !== 1) throw new Error('Formato o versión de backup no compatible.');

  const collect = <T extends DataRecord>(kind: DataKind, arr: unknown): T[] =>
    Array.isArray(arr)
      ? arr.flatMap((item) => {
          const clean = sanitizeDataRecord(kind, item);
          return clean ? [clean as T] : [];
        })
      : [];

  return {
    version: 1,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(),
    strength: collect<StrengthRow>('strength', raw.strength),
    cardio: collect<CardioRow>('cardio', raw.cardio),
    measures: collect<Measure>('measures', raw.measures),
    wellbeing: collect<DailyWellbeing>('wellbeing', raw.wellbeing),
    settings: sanitizeSettings(raw.settings),
  };
}

export async function importBackup(b: Backup): Promise<void> {
  await putMany('strength', b.strength ?? []);
  await putMany('cardio', b.cardio ?? []);
  await putMany('measures', b.measures ?? []);
  await putMany('wellbeing', b.wellbeing ?? []);
  if (b.settings) await saveSettings(sanitizeSettings(b.settings));
}
export async function wipeAll(): Promise<void> {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const t = db.transaction([...STORES], 'readwrite');
    STORES.forEach((s) => t.objectStore(s).clear());
    t.oncomplete = () => res(); t.onerror = () => rej(t.error);
  });
}
