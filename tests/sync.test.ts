import { describe, expect, it } from 'vitest';
import {
  bucketIdFor,
  groupRecordsByBucket,
  hasCustomSettings,
  mergeBucket,
  stripUndefined,
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
  });
});
