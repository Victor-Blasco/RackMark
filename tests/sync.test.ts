import { describe, expect, it, vi } from 'vitest';

const fakeRemoteDocs = new Map<string, unknown>();
const fakeIdb: Record<string, Map<string, unknown>> = {
  strength: new Map(),
  cardio: new Map(),
  measures: new Map(),
  wellbeing: new Map(),
};
let fakeSettings: unknown = null;
let onRemoteReadHook: (() => void) | null = null;

vi.mock('../src/lib/firebase', () => ({ fs: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (_fs: unknown, ...segs: string[]) => segs.join('/'),
  collection: (_fs: unknown, ...segs: string[]) => segs.join('/'),
  getDoc: async (ref: string) => {
    onRemoteReadHook?.();
    const data = fakeRemoteDocs.get(ref);
    return { exists: () => data !== undefined, data: () => data };
  },
  getDocs: async (colRef: string) => {
    const prefix = `${colRef}/`;
    const docs = [...fakeRemoteDocs.entries()]
      .filter(([k]) => k.startsWith(prefix))
      .map(([k, v]) => ({ id: k.slice(prefix.length), ref: k, data: () => v }));
    return { docs, forEach: (cb: (d: { id: string; ref: string; data: () => unknown }) => void) => docs.forEach(cb) };
  },
  setDoc: async (ref: string, data: unknown) => {
    fakeRemoteDocs.set(ref, structuredClone(data));
  },
  deleteDoc: async (ref: string) => {
    fakeRemoteDocs.delete(ref);
  },
  writeBatch: () => {
    const ops: (() => void)[] = [];
    return {
      set: (ref: string, data: unknown) => { ops.push(() => fakeRemoteDocs.set(ref, structuredClone(data))); },
      delete: (ref: string) => { ops.push(() => fakeRemoteDocs.delete(ref)); },
      commit: async () => { ops.forEach((op) => op()); },
    };
  },
}));
vi.mock('../src/lib/db', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/db')>('../src/lib/db');
  return {
    ...actual,
    getAll: async (kind: string) => [...(fakeIdb[kind]?.values() ?? [])],
    putMany: async (kind: string, items: Record<string, unknown>[]) => {
      for (const it of items) {
        const k = (it.id ?? it.date) as string;
        fakeIdb[kind].set(k, structuredClone(it));
      }
    },
    deleteKey: async (kind: string, key: string) => {
      fakeIdb[kind].delete(key);
    },
    loadSettings: async () => structuredClone(fakeSettings ?? DEFAULT_SETTINGS),
    saveSettings: async (s: Record<string, unknown>) => {
      fakeSettings = structuredClone(s);
    },
    wipeAll: async () => {
      Object.values(fakeIdb).forEach((m) => m.clear());
      fakeSettings = null;
    },
  };
});

import {
  bucketIdFor,
  clearSyncMeta,
  groupRecordsByBucket,
  hasCustomSettings,
  hasUnsyncedChanges,
  loadSyncMeta,
  markBucketDeletes,
  markBucketUpserts,
  markSettingsDirty,
  mergeSyncSettings,
  mergeBucket,
  saveSyncMeta,
  stripUndefined,
  syncWithCloud,
  type RemoteBucket,
} from '../src/lib/sync';
import { DEFAULT_SETTINGS } from '../src/lib/seed';
import type { DailyWellbeing, StrengthRow } from '../src/types';

const row = (id: string, date: string, note?: string): StrengthRow => ({
  id,
  sessionId: `s-${date}`,
  ts: Date.parse(`${date}T10:00:00Z`),
  date,
  ref: 'name:Press',
  sets: [{ w: 60, r: 8 }],
  ...(note !== undefined ? { note } : {}),
});

describe('cloud sync helpers', () => {
  it('conserva nombres personalizados locales al resolver un conflicto de ajustes', () => {
    const local = {
      ...structuredClone(DEFAULT_SETTINGS),
      customNames: {
        custom_a: 'Curl de bíceps Martillo',
        custom_b: 'Remo Unilateral',
      },
    };
    const remote = {
      ...structuredClone(DEFAULT_SETTINGS),
      customNames: { custom_a: 'Nombre antiguo', custom_c: 'Dominadas' },
    };

    const merged = mergeSyncSettings(local, remote);
    expect(merged.customNames).toEqual({
      custom_a: 'Curl de bíceps Martillo',
      custom_b: 'Remo Unilateral',
      custom_c: 'Dominadas',
    });
  });

  it('genera IDs de bucket compatibles con reglas Firestore', () => {
    expect(bucketIdFor('strength', '2026-11-11')).toBe('strength_2026');
    expect(bucketIdFor('wellbeing', '2025-05-01')).toBe('wellbeing_2025');
    expect(bucketIdFor('strength', 'bad-date')).toBe('strength_legacy');
    expect(bucketIdFor('cardio', '2026-11-11')).toBe('cardio_all');
    expect(bucketIdFor('measures', '2026-11-11')).toBe('measures_all');
  });

  it('elimina undefined recursivamente antes de subir a Firestore', () => {
    const clean = stripUndefined({
      a: 1,
      b: undefined,
      nested: { x: 'ok', y: undefined },
      arr: [{ k: 1, z: undefined }],
    });
    expect(clean).toEqual({ a: 1, nested: { x: 'ok' }, arr: [{ k: 1 }] });
  });

  it('agrupa registros por bucket limpiando undefined', () => {
    const grouped = groupRecordsByBucket('strength', [
      { ...row('a', '2025-01-10'), note: undefined },
      row('b', '2026-02-01', 'ok'),
    ]);
    expect(Object.keys(grouped)).toEqual(['strength_2025', 'strength_2026']);
    expect('note' in grouped.strength_2025.a).toBe(false);
    expect((grouped.strength_2026.b as StrengthRow).note).toBe('ok');
  });

  it('sube datos locales preexistentes en primera sincronización sin remoto', () => {
    const res = mergeBucket({
      kind: 'strength',
      localItems: { a: row('a', '2026-01-01') },
      remoteBucket: undefined,
      localDirtyKeys: {},
      localDeleted: {},
      now: 5000,
    });
    expect(Object.keys(res.merged)).toEqual(['a']);
    expect(res.toPutLocally).toHaveLength(0);
    expect(res.pushRemote).toBe(true);
  });

  it('descarga registros remotos nuevos a dispositivo vacío', () => {
    const remoteBucket: RemoteBucket = {
      kind: 'strength',
      items: { r1: row('r1', '2026-03-01') },
      deleted: {},
      updatedAt: 2000,
    };
    const res = mergeBucket({
      kind: 'strength',
      localItems: {},
      remoteBucket,
      localDirtyKeys: {},
      localDeleted: {},
      now: 5000,
    });
    expect(Object.keys(res.merged)).toEqual(['r1']);
    expect(res.toPutLocally).toHaveLength(1);
    expect(res.pushRemote).toBe(false);
  });

  it('propaga borrados remotos y locales según marca temporal', () => {
    // Caso A: borrado remoto elimina fila local no tocada recientemente
    const remoteDel: RemoteBucket = {
      kind: 'strength',
      items: {},
      deleted: { r1: 3000 },
      updatedAt: 3000,
    };
    const resA = mergeBucket({
      kind: 'strength',
      localItems: { r1: row('r1', '2026-03-01') },
      remoteBucket: remoteDel,
      localDirtyKeys: {},
      localDeleted: {},
      now: 5000,
    });
    expect(resA.merged).toEqual({});
    expect(resA.toDeleteLocally).toEqual(['r1']);

    // Caso B: borrado local offline más reciente elimina fila remota antigua
    const remoteOld: RemoteBucket = {
      kind: 'strength',
      items: { r1: row('r1', '2026-03-01') },
      deleted: {},
      updatedAt: 2000,
    };
    const resB = mergeBucket({
      kind: 'strength',
      localItems: {},
      remoteBucket: remoteOld,
      localDirtyKeys: {},
      localDeleted: { r1: 4000 },
      now: 5000,
    });
    expect(resB.merged).toEqual({});
    expect(resB.deleted.r1).toBe(4000);
    expect(resB.pushRemote).toBe(true);
  });

  it('fusiona campos de bienestar de sueño y pasos por fecha', () => {
    const loc: DailyWellbeing = { date: '2026-03-01', steps: 9500 };
    const rem: DailyWellbeing = { date: '2026-03-01', sleepMin: 430, rhr: 56 };
    const res = mergeBucket({
      kind: 'wellbeing',
      localItems: { '2026-03-01': loc },
      remoteBucket: {
        kind: 'wellbeing',
        items: { '2026-03-01': rem },
        updatedAt: 2000,
      },
      localDirtyKeys: { '2026-03-01': 3000 },
      localDeleted: {},
      now: 5000,
    });
    expect(res.merged['2026-03-01']).toEqual({
      date: '2026-03-01',
      steps: 9500,
      sleepMin: 430,
      rhr: 56,
    });
    expect(res.pushRemote).toBe(true);
  });

  it('conserva ediciones y borrados locales offline sobre ítem A aunque otro ítem suba remoteAt', () => {
    const editedA: StrengthRow = { ...row('a', '2026-03-01', 'edit móvil'), sets: [{ w: 70, r: 8 }] };
    const remoteA = row('a', '2026-03-01');
    const remoteB = row('b', '2026-03-02', 'pc');
    const res = mergeBucket({
      kind: 'strength',
      localItems: { a: editedA, delMe: row('delMe', '2026-03-01') },
      remoteBucket: {
        kind: 'strength',
        items: { a: remoteA, b: remoteB, delMe: row('delMe', '2026-03-01') },
        deleted: {},
        updatedAt: 200,
      },
      localDirtyKeys: { a: 150 },
      localDeleted: { delMe: 160 },
      lastSyncedAt: 100,
      now: 300,
    });
    expect((res.merged.a as StrengthRow).sets[0]?.w).toBe(70);
    expect((res.merged.b as StrengthRow).note).toBe('pc');
    expect(res.merged.delMe).toBeUndefined();
    expect(res.deleted.delMe).toBe(160);
    expect(res.pushRemote).toBe(true);
  });

  it('prioriza la versión remota más reciente en la primera sincronización cuando lastSyncedAt es 0', () => {
    const localOld: StrengthRow = { ...row('a', '2026-03-01', 'offline viejo'), sets: [{ w: 65, r: 8 }] };
    const remoteNew: StrengthRow = { ...row('a', '2026-03-01', 'pc reciente'), sets: [{ w: 75, r: 8 }] };
    const res = mergeBucket({
      kind: 'strength',
      localItems: { a: localOld },
      remoteBucket: {
        kind: 'strength',
        items: { a: remoteNew },
        deleted: {},
        updatedAt: 2000,
      },
      localDirtyKeys: { a: 1500 },
      localDeleted: {},
      lastSyncedAt: 0,
      now: 2500,
    });
    expect((res.merged.a as StrengthRow).sets[0]?.w).toBe(75);
    expect((res.merged.a as StrengthRow).note).toBe('pc reciente');
    expect(res.toPutLocally).toHaveLength(1);
    expect(res.pushRemote).toBe(false);
  });

  it('descarta registros remotos malformados o con claves peligrosas en mergeBucket', () => {
    const corrupt = {
      kind: 'strength',
      items: {
        badDate: { id: 'badDate', sessionId: 's', ts: 1, date: 'invalid-date', ref: 'name:X', sets: [{ w: 10, r: 5 }] },
        badSets: { id: 'badSets', sessionId: 's', ts: 1, date: '2026-03-01', ref: 'name:X', sets: [{ w: -5, r: 0 }] },
        valid: row('valid', '2026-03-01'),
      },
      deleted: {},
      updatedAt: 2000,
    } as unknown as RemoteBucket;
    const res = mergeBucket({
      kind: 'strength',
      localItems: {},
      remoteBucket: corrupt,
      localDirtyKeys: {},
      localDeleted: {},
      now: 3000,
    });
    expect(Object.keys(res.merged)).toEqual(['valid']);
    expect(res.toPutLocally).toHaveLength(1);
  });

  it('detecta personalización en rutinas y perfil básico en hasCustomSettings', () => {
    expect(hasCustomSettings(DEFAULT_SETTINGS)).toBe(false);
    expect(hasCustomSettings({
      ...DEFAULT_SETTINGS,
      profile: { ...DEFAULT_SETTINGS.profile, age: 31 },
    })).toBe(true);
    expect(hasCustomSettings({
      ...DEFAULT_SETTINGS,
      routines: { ...DEFAULT_SETTINGS.routines, Extra: [{ name: 'Dominadas', sets: 3, reps: 8 }] },
    })).toBe(true);
    expect(hasCustomSettings({
      ...DEFAULT_SETTINGS,
      hiddenExercises: ['press de banca'],
    })).toBe(true);
    expect(hasCustomSettings({
      ...DEFAULT_SETTINGS,
      theme: 'light',
    })).toBe(true);
    expect(hasCustomSettings({
      ...DEFAULT_SETTINGS,
      theme: 'system',
    })).toBe(true);

    const mergedHidden = mergeSyncSettings(
      { ...structuredClone(DEFAULT_SETTINGS), hiddenExercises: ['press de banca', 'plancha'] },
      { ...structuredClone(DEFAULT_SETTINGS), hiddenExercises: ['plancha', 'fondos en paralelas'] },
    );
    expect(mergedHidden.hiddenExercises).toEqual(['plancha', 'fondos en paralelas', 'press de banca']);
  });

  it('syncWithCloud conserva cambios concurrentes durante el vuelo y limpia deletes huérfanos', async () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
      removeItem: (k: string) => { store.delete(k); },
    });
    fakeRemoteDocs.clear();
    Object.values(fakeIdb).forEach((m) => m.clear());
    fakeSettings = structuredClone(DEFAULT_SETTINGS);
    clearSyncMeta();

    // Caso 1: añadir y borrar el único registro de un bucket que nunca existió en la nube no deja cambios pendientes tras sync
    saveSyncMeta({ uid: 'u1', dirtyKeys: {}, deleted: {}, remoteUpdated: {} });
    markBucketUpserts('measures', [{ date: '2026-11-21', weight: 74 }], 1000);
    markBucketDeletes('measures', [{ key: '2026-11-21', date: '2026-11-21' }], 2000);
    expect(hasUnsyncedChanges()).toBe(true);

    onRemoteReadHook = null;
    await syncWithCloud('u1');
    expect(hasUnsyncedChanges()).toBe(false);
    expect(fakeRemoteDocs.has('users/u1/buckets/measures_all')).toBe(false);

    // Caso 2: edición concurrente y ajuste guardado durante el await remoto NO se pierden al cerrar syncWithCloud
    const nowBeforeSync = Date.now();
    markBucketUpserts('strength', [row('s1', '2026-11-21')], nowBeforeSync - 100);
    fakeIdb.strength.set('s1', row('s1', '2026-11-21'));
    let triggered = false;
    onRemoteReadHook = () => {
      if (triggered) return;
      triggered = true;
      const later = Date.now() + 50;
      markBucketUpserts('strength', [row('s2', '2026-11-21', 'edición en vuelo')], later);
      markSettingsDirty(later);
    };

    await syncWithCloud('u1');
    onRemoteReadHook = null;
    const postMeta = loadSyncMeta();
    expect(postMeta.dirtyKeys.strength_2026?.s2).toBeDefined();
    expect(postMeta.settingsDirtyAt).toBeDefined();
    expect(hasUnsyncedChanges(postMeta)).toBe(true);
    vi.unstubAllGlobals();
  });

  it('syncWithCloud ignora documentos remotos con kind o updatedAt inválidos sin lanzar error', async () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
      removeItem: (k: string) => { store.delete(k); },
    });
    fakeRemoteDocs.clear();
    Object.values(fakeIdb).forEach((m) => m.clear());
    fakeSettings = structuredClone(DEFAULT_SETTINGS);
    clearSyncMeta();

    fakeRemoteDocs.set('users/u1/sync/settings', { data: DEFAULT_SETTINGS, updatedAt: 'corrupto' });
    fakeRemoteDocs.set('users/u1/buckets/unknown_2026', {
      kind: 'unknown',
      items: { bad1: { id: 'bad1' } },
      updatedAt: 'corrupto',
    });

    const report = await syncWithCloud('u1');
    expect(report.pulledItems).toBe(0);
    vi.unstubAllGlobals();
  });

  it('conserva routineMeta.freq válido al fusionar ajustes', () => {
    const local = {
      ...structuredClone(DEFAULT_SETTINGS),
      routineMeta: { Pull: { color: '#3B82F6', freq: 3 } },
    };
    const remote = {
      ...structuredClone(DEFAULT_SETTINGS),
      routineMeta: { Pull: { color: '#3B82F6', freq: 2 }, Leg: { color: '#10B981', freq: 0 } },
    };
    const merged = mergeSyncSettings(local, remote);
    expect(merged.routineMeta?.Pull?.freq).toBe(2);
    expect(merged.routineMeta?.Leg?.freq).toBe(0);
  });
});
