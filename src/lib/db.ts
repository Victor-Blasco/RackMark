import { MEASURE_FIELDS } from '../types';
import type {
  AiEntry, AiResult, AiSection, CardioRow, DailyWellbeing, DayName, Measure, MuscleMap, RoutineEx, RoutineMeta, Settings, StrengthRow,
} from '../types';
import { DEFAULT_SETTINGS } from './seed';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_BACKUP_BYTES = 50 * 1024 * 1024;
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

function sanitizeStringMap(raw: unknown): Record<string, string> {
  if (!isObj(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
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
      rq.onerror = () => rej(rq.error);
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

export async function loadSettings(): Promise<Settings> {
  const saved = (await wrap((await tx('kv', 'readonly')).get('settings'))) as Partial<Settings> | undefined;
  return { ...structuredClone(DEFAULT_SETTINGS), ...(saved ?? {}) } as Settings;
}
export async function saveSettings(s: Settings): Promise<void> {
  await wrap((await tx('kv', 'readwrite')).put(s, 'settings'));
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

export function sanitizeSettings(raw: unknown): Settings {
  const base = structuredClone(DEFAULT_SETTINGS);
  if (!isObj(raw)) return base;

  if (isObj(raw.profile)) {
    if (typeof raw.profile.sex === 'string' && raw.profile.sex.trim()) base.profile.sex = raw.profile.sex.trim();
    const age = fin(raw.profile.age);
    if (age !== undefined && age > 0 && age < 130) base.profile.age = age;
    const height = fin(raw.profile.height);
    if (height !== undefined && height > 40 && height < 270) base.profile.height = height;
    if (
      raw.profile.goal === 'bulk' ||
      raw.profile.goal === 'cut' ||
      raw.profile.goal === 'recomp' ||
      raw.profile.goal === 'strength'
    ) {
      base.profile.goal = raw.profile.goal;
    }
    if (
      raw.profile.experience === 'beginner' ||
      raw.profile.experience === 'intermediate' ||
      raw.profile.experience === 'advanced'
    ) {
      base.profile.experience = raw.profile.experience;
    }
    const dpw = fin(raw.profile.daysPerWeek);
    if (dpw !== undefined && dpw >= 1 && dpw <= 7) base.profile.daysPerWeek = Math.round(dpw);
  }

  if (isObj(raw.routines)) {
    const cleanRoutines: Record<DayName, RoutineEx[]> = {};
    for (const [rawDay, list] of Object.entries(raw.routines)) {
      const day = rawDay.trim();
      if (!day || day.length > 40 || UNSAFE_KEYS.has(day) || !Array.isArray(list)) continue;
      if (Object.keys(cleanRoutines).length >= 20) break;
      cleanRoutines[day] = list.flatMap((ex): RoutineEx[] => {
        if (!isObj(ex) || typeof ex.name !== 'string' || !ex.name.trim()) return [];
        const sets = fin(ex.sets);
        const reps = fin(ex.reps);
        if (!sets || sets <= 0 || !reps || reps <= 0) return [];
        return [{ name: ex.name.trim(), sets, reps }];
      });
    }
    if (Object.keys(cleanRoutines).length > 0) base.routines = cleanRoutines;
  }

  if (isObj(raw.routineMeta)) {
    const cleanMeta: Record<DayName, RoutineMeta> = {};
    for (const [rawDay, val] of Object.entries(raw.routineMeta)) {
      const day = rawDay.trim();
      if (!day || day.length > 40 || UNSAFE_KEYS.has(day) || !isObj(val)) continue;
      if (Object.keys(cleanMeta).length >= 20) break;
      const meta: RoutineMeta = {};
      if (typeof val.color === 'string' && HEX_COLOR_RE.test(val.color)) meta.color = val.color;
      if (typeof val.sub === 'string' && val.sub.trim()) meta.sub = val.sub.trim().slice(0, 40);
      if (meta.color || meta.sub) cleanMeta[day] = meta;
    }
    base.routineMeta = cleanMeta;
  }

  base.customNames = { ...base.customNames, ...sanitizeStringMap(raw.customNames) };
  base.refNames = { ...base.refNames, ...sanitizeStringMap(raw.refNames) };
  base.aliases = { ...base.aliases, ...sanitizeStringMap(raw.aliases) };
  base.notes = { ...base.notes, ...sanitizeStringMap(raw.notes) };

  if (isObj(raw.muscles)) {
    for (const [k, v] of Object.entries(raw.muscles)) {
      if (UNSAFE_KEYS.has(k) || !isObj(v) || typeof v.p !== 'string' || !Array.isArray(v.s)) continue;
      const sec = v.s.filter((item): item is string => typeof item === 'string');
      base.muscles[k] = { p: v.p, s: sec } satisfies MuscleMap;
    }
  }

  if (Array.isArray(raw.phases)) {
    base.phases = raw.phases.flatMap((p) =>
      isObj(p) && typeof p.name === 'string' && typeof p.start === 'string' && ISO_DATE_RE.test(p.start)
        ? [{ name: p.name, start: p.start }]
        : [],
    );
  }

  if (typeof raw.onboardingCompleted === 'boolean') base.onboardingCompleted = raw.onboardingCompleted;

  if (raw.aiTone === 'simple' || raw.aiTone === 'technical') base.aiTone = raw.aiTone;

  if (isObj(raw.ai) && typeof raw.ai.date === 'string' && ISO_DATE_RE.test(raw.ai.date) && isObj(raw.ai.byExercise)) {
    const byExercise: Record<string, AiEntry> = {};
    for (const [k, v] of Object.entries(raw.ai.byExercise)) {
      if (UNSAFE_KEYS.has(k) || !isObj(v)) continue;
      const entry: AiEntry = {};
      if (typeof v.status === 'string') entry.status = v.status;
      if (typeof v.prescription === 'string') entry.prescription = v.prescription;
      if (typeof v.biomech === 'string') entry.biomech = v.biomech;
      byExercise[k] = entry;
    }
    const ai: AiResult = { date: raw.ai.date, byExercise };
    if (raw.ai.tone === 'simple' || raw.ai.tone === 'technical') ai.tone = raw.ai.tone;
    if (typeof raw.ai.summary === 'string') ai.summary = raw.ai.summary;
    if (isObj(raw.ai.overview) && typeof raw.ai.overview.overallStatus === 'string') {
      const highlights = Array.isArray(raw.ai.overview.highlights)
        ? raw.ai.overview.highlights.filter((h): h is string => typeof h === 'string')
        : [];
      const sections: AiSection[] = Array.isArray(raw.ai.overview.sections)
        ? raw.ai.overview.sections.flatMap((s) =>
            isObj(s) && typeof s.title === 'string' && typeof s.text === 'string'
              ? [{
                  title: s.title,
                  verdict: s.verdict === 'good' || s.verdict === 'warning' ? s.verdict : 'neutral',
                  text: s.text,
                }]
              : [],
          )
        : [];
      ai.overview = { overallStatus: raw.ai.overview.overallStatus, highlights, sections };
    }
    base.ai = ai;
  }

  return base;
}

/** Valida y sanea un JSON de copia de seguridad antes de escribirlo en IndexedDB. */
export function parseBackup(jsonText: string): Backup {
  if (jsonText.length > MAX_BACKUP_BYTES) throw new Error('Archivo de backup demasiado grande.');
  let raw: unknown;
  try { raw = JSON.parse(jsonText); } catch { throw new Error('El archivo no contiene un JSON válido.'); }
  if (!isObj(raw) || raw.version !== 1) throw new Error('Formato o versión de backup no compatible.');

  const strength: StrengthRow[] = Array.isArray(raw.strength)
    ? raw.strength.flatMap((r): StrengthRow[] => {
        if (!isObj(r) || typeof r.id !== 'string' || !r.id || typeof r.date !== 'string' || !ISO_DATE_RE.test(r.date) || typeof r.ref !== 'string' || !r.ref || !Array.isArray(r.sets)) return [];
        const sets = r.sets.flatMap((s) => {
          if (!isObj(s)) return [];
          const w = fin(s.w);
          const reps = fin(s.r);
          const restSec = fin(s.restSec);
          return w !== undefined && w >= 0 && reps !== undefined && reps > 0
            ? [{ w, r: reps, ...(restSec !== undefined && restSec >= 0 ? { restSec: Math.round(restSec) } : {}) }]
            : [];
        });
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
        return [row];
      })
    : [];

  const cardio: CardioRow[] = Array.isArray(raw.cardio)
    ? raw.cardio.flatMap((r): CardioRow[] => {
        if (!isObj(r) || typeof r.id !== 'string' || !r.id || typeof r.date !== 'string' || !ISO_DATE_RE.test(r.date)) return [];
        const type = fin(r.type); const durMin = fin(r.durMin); const distKm = fin(r.distKm);
        const avgHr = fin(r.avgHr); const kcal = fin(r.kcal);
        if (type === undefined || durMin === undefined || distKm === undefined || avgHr === undefined || kcal === undefined) return [];
        const row: CardioRow = { id: r.id, ts: fin(r.ts) ?? 0, date: r.date, type, durMin, distKm, avgHr, kcal };
        const vo2 = fin(r.vo2);
        if (vo2 !== undefined) row.vo2 = vo2;
        return [row];
      })
    : [];

  const measureKeys = MEASURE_FIELDS.map((f) => f.key);
  const measures: Measure[] = Array.isArray(raw.measures)
    ? raw.measures.flatMap((r): Measure[] => {
        if (!isObj(r) || typeof r.date !== 'string' || !ISO_DATE_RE.test(r.date)) return [];
        const m: Measure = { date: r.date };
        pickFiniteNums(r, measureKeys, m);
        if (typeof r.note === 'string') m.note = r.note;
        return [m];
      })
    : [];

  const wellbeing: DailyWellbeing[] = Array.isArray(raw.wellbeing)
    ? raw.wellbeing.flatMap((r): DailyWellbeing[] => {
        if (!isObj(r) || typeof r.date !== 'string' || !ISO_DATE_RE.test(r.date)) return [];
        const w: DailyWellbeing = { date: r.date };
        pickFiniteNums(r, WELLBEING_KEYS, w);
        return [w];
      })
    : [];

  return {
    version: 1,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(),
    strength,
    cardio,
    measures,
    wellbeing,
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
