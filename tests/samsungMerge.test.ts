import { describe, expect, it } from 'vitest';
import { sanitizeSettings } from '../src/lib/db';
import { isManualStrengthRow, mergeSamsungStrengthWithManual } from '../src/lib/samsungMerge';
import type { StrengthRow } from '../src/types';

const makeSettings = (customNames: Record<string, string> = {}) =>
  sanitizeSettings({ customNames });

describe('samsungMerge', () => {
  it('detecta correctamente filas manuales frente a filas de Samsung', () => {
    expect(
      isManualStrengthRow({
        id: 'manual-2026-11-20-press-banca',
        sessionId: 'manual-1700000000',
        ts: 1,
        date: '2026-11-20',
        ref: 'name:Press banca',
        sets: [{ w: 80, r: 8 }],
      }),
    ).toBe(true);
    expect(
      isManualStrengthRow({
        id: 'uuid-samsung-1',
        sessionId: 'routine-uuid-1',
        ts: 1,
        date: '2026-11-20',
        ref: 'custom-uuid-1',
        sets: [{ w: 80, r: 8 }],
      }),
    ).toBe(false);
  });

  it('en días sin entrenamiento manual importa las filas de Samsung sin cambios', () => {
    const samsung: StrengthRow[] = [
      {
        id: 's1',
        sessionId: 'r1',
        ts: 1000,
        date: '2026-11-19',
        ref: 'custom-1',
        sets: [{ w: 60, r: 10 }],
        durMin: 8,
        avgHr: 128,
        maxHr: 145,
        minHr: 102,
        kcal: 55,
      },
    ];
    const res = mergeSamsungStrengthWithManual([], samsung, makeSettings({ 'custom-1': 'Remo' }));
    expect(res.toUpsert).toEqual(samsung);
    expect(res.mergedDays).toBe(0);
    expect(res.enrichedRows).toBe(0);
    expect(res.skippedExtraRows).toBe(0);
  });

  it('en días con entrenamiento manual agrupa bloques duplicados de Samsung, suma durMin/kcal, pondera avgHr y nunca toca las series manuales', () => {
    const manualRow: StrengthRow = {
      id: 'manual-1-press',
      sessionId: 'manual-sess-1',
      ts: 2000,
      date: '2026-11-20',
      ref: 'name:Press Banca',
      sets: [
        { w: 82.5, r: 8, rir: 2, restSec: 120 },
        { w: 82.5, r: 8, rir: 1, restSec: 120 },
        { w: 82.5, r: 7, rir: 0 },
      ],
      note: 'Buen control excéntrico',
      day: 'Empuje',
    };
    const samsungRows: StrengthRow[] = [
      {
        id: 'sam-block-1',
        sessionId: 'sam-r-1',
        ts: 2001,
        date: '2026-11-20',
        ref: 'custom-bench',
        sets: [{ w: 80, r: 8 }, { w: 80, r: 8 }],
        durMin: 6,
        avgHr: 120,
        maxHr: 142,
        minHr: 98,
        kcal: 40,
      },
      {
        id: 'sam-block-2',
        sessionId: 'sam-r-1',
        ts: 2500,
        date: '2026-11-20',
        ref: 'custom-bench',
        sets: [{ w: 80, r: 6 }],
        durMin: 4,
        avgHr: 135,
        maxHr: 152,
        minHr: 105,
        kcal: 30,
      },
    ];

    const res = mergeSamsungStrengthWithManual(
      [manualRow],
      samsungRows,
      makeSettings({ 'custom-bench': 'Press banca' }),
    );

    expect(res.mergedDays).toBe(1);
    expect(res.enrichedRows).toBe(1);
    expect(res.skippedExtraRows).toBe(0);
    expect(res.toUpsert).toHaveLength(1);

    const out = res.toUpsert[0];
    expect(out.id).toBe(manualRow.id);
    expect(out.sessionId).toBe(manualRow.sessionId);
    expect(out.ref).toBe(manualRow.ref);
    expect(out.sets).toEqual(manualRow.sets);
    expect(out.note).toBe('Buen control excéntrico');
    expect(out.day).toBe('Empuje');
    expect(out.durMin).toBe(10);
    expect(out.kcal).toBe(70);
    expect(out.maxHr).toBe(152);
    expect(out.minHr).toBe(98);
    // Media ponderada: (120 * 6 + 135 * 4) / 10 = 126
    expect(out.avgHr).toBe(126);
  });

  it('mantiene intactos ejercicios manuales ausentes en Samsung y descarta ejercicios extra de Samsung sin contaminar', () => {
    const manualBench: StrengthRow = {
      id: 'manual-bench',
      sessionId: 'manual-s1',
      ts: 1000,
      date: '2026-11-21',
      ref: 'name:Press banca',
      sets: [{ w: 80, r: 8 }],
    };
    const manualLaterals: StrengthRow = {
      id: 'manual-lat',
      sessionId: 'manual-s1',
      ts: 2000,
      date: '2026-11-21',
      ref: 'name:Elevaciones laterales',
      sets: [{ w: 12, r: 15 }],
    };
    const samsungRows: StrengthRow[] = [
      {
        id: 'sam-bench',
        sessionId: 'sam-r1',
        ts: 1001,
        date: '2026-11-21',
        ref: 'custom-bench',
        sets: [{ w: 80, r: 8 }],
        avgHr: 124,
        kcal: 45,
      },
      {
        id: 'sam-extra',
        sessionId: 'sam-r1',
        ts: 3000,
        date: '2026-11-21',
        ref: 'custom-unknown-extra',
        sets: [{ w: 50, r: 12 }],
        avgHr: 118,
        kcal: 30,
      },
    ];

    const res = mergeSamsungStrengthWithManual(
      [manualBench, manualLaterals],
      samsungRows,
      makeSettings({ 'custom-bench': 'Press banca', 'custom-unknown-extra': 'Face pull' }),
    );

    expect(res.mergedDays).toBe(1);
    expect(res.enrichedRows).toBe(1);
    expect(res.skippedExtraRows).toBe(1);
    expect(res.toUpsert).toHaveLength(1);
    expect(res.toUpsert[0].id).toBe('manual-bench');
    expect(res.toUpsert[0].avgHr).toBe(124);
    expect(res.toUpsert[0].kcal).toBe(45);
    expect(manualLaterals.avgHr).toBeUndefined();
  });

  it('es idempotente al reimportar el mismo ZIP de Samsung sobre filas ya enriquecidas', () => {
    const manualRow: StrengthRow = {
      id: 'manual-squat',
      sessionId: 'manual-s2',
      ts: 1000,
      date: '2026-11-22',
      ref: 'name:Sentadilla',
      sets: [{ w: 100, r: 5 }],
    };
    const samsungRows: StrengthRow[] = [
      {
        id: 'sam-sq-1',
        sessionId: 'sam-r2',
        ts: 1001,
        date: '2026-11-22',
        ref: 'custom-sq',
        sets: [{ w: 100, r: 5 }],
        durMin: 9,
        avgHr: 138,
        maxHr: 162,
        minHr: 110,
        kcal: 80,
      },
    ];
    const settings = makeSettings({ 'custom-sq': 'Sentadilla' });
    const first = mergeSamsungStrengthWithManual([manualRow], samsungRows, settings);
    const second = mergeSamsungStrengthWithManual(first.toUpsert, samsungRows, settings);

    expect(second.toUpsert).toEqual(first.toUpsert);
    expect(second.toUpsert[0].durMin).toBe(9);
    expect(second.toUpsert[0].kcal).toBe(80);
  });
});
