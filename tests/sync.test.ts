import { describe, expect, it } from 'vitest';
import {
  bucketIdFor,
  groupRecordsByBucket,
  mergeBucket,
  stripUndefined,
  type RemoteBucket,
} from '../src/lib/sync';
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
});
