import type { CardioRow, DailyWellbeing, Measure, Settings, StrengthRow } from '../types';
import { DEFAULT_SETTINGS } from './seed';

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
export async function importBackup(b: Backup): Promise<void> {
  await putMany('strength', b.strength ?? []);
  await putMany('cardio', b.cardio ?? []);
  await putMany('measures', b.measures ?? []);
  await putMany('wellbeing', b.wellbeing ?? []);
  if (b.settings) await saveSettings({ ...structuredClone(DEFAULT_SETTINGS), ...b.settings });
}
export async function wipeAll(): Promise<void> {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const t = db.transaction([...STORES], 'readwrite');
    STORES.forEach((s) => t.objectStore(s).clear());
    t.oncomplete = () => res(); t.onerror = () => rej(t.error);
  });
}
