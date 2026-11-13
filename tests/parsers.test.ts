import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { parseExerciseCsv, parseCustomExerciseCsv } from '../src/lib/samsung';
import { parseMeasuresCsv } from '../src/lib/measures';
import { analyze } from '../src/lib/analysis';
import { DEFAULT_SETTINGS } from '../src/lib/seed';
import type { StrengthRow } from '../src/types';

const EX = 'C:/Users/Victor/Downloads/com.samsung.shealth.exercise.20261111152201.csv';
const CE = 'C:/Users/Victor/Desktop/samsunghealth_victorblascogar_20261111152201/com.samsung.shealth.exercise.custom_exercise.20261111152201.csv';
const ME = 'C:/Users/Victor/Downloads/Medidas 11-11-2026.csv';
const have = existsSync(EX) && existsSync(CE) && existsSync(ME);

describe.skipIf(!have)('archivos reales', () => {
  it('parsea medidas', () => {
    const r = parseMeasuresCsv(readFileSync(ME, 'utf8'));
    expect(r.measures.length).toBe(14);
    const last = r.measures[r.measures.length - 1];
    expect(last.date).toBe('2026-11-11');
    expect(last.weight).toBe(70.4);
    expect(last.bf).toBe(14.8);
    expect(last.waist).toBe(81.5);
    expect(r.profile.height).toBe(167);
    expect(r.measures.some((m) => /defi/.test(m.note ?? ''))).toBe(true);
  });
  it('parsea ejercicios y cruza nombres', () => {
    const names = parseCustomExerciseCsv(readFileSync(CE, 'utf8'));
    expect(names['m7i86bn9_2u6']).toBe('Curl de bíceps Martillo');
    const { strength, cardio } = parseExerciseCsv(readFileSync(EX, 'utf8'));
    expect(strength.length).toBeGreaterThan(1500);
    expect(cardio.length).toBeGreaterThan(50);
    const s = { ...structuredClone(DEFAULT_SETTINGS), customNames: names };
    const a = analyze(strength, s);
    const jal = a.exercises.get('Jalones al pecho')!;
    expect(jal.last!.date).toBe('2026-11-09');
    expect(jal.last!.top).toBe(90);
    const mart = a.exercises.get('Curl de bíceps Martillo')!;
    expect(mart.last!.sets.map((x) => x.r)).toEqual([11, 10, 9]);
    console.log('sin mapear:', a.unmapped, 'sesiones:', a.sessions.length, a.sessions.slice(-4));
    for (const d of ['Push', 'Pull', 'Leg'] as const) console.log(d, a.byDay[d].map((e) => `${e.name}: ${e.status}`));
  });
});

describe('sesiones manuales', () => {
  it('integra filas manuales con historial, notas y ejercicios extra por día', () => {
    const s = structuredClone(DEFAULT_SETTINGS);
    const rows: StrengthRow[] = [
      {
        id: 'samsung-1',
        sessionId: 'sess-1',
        ts: Date.parse('2026-11-01T12:00:00Z'),
        date: '2026-11-01',
        ref: 'type:10018', // Jalones al pecho
        sets: [{ w: 85, r: 9 }, { w: 85, r: 8 }],
      },
      {
        id: 'manual-2026-11-13-jalones-al-pecho',
        sessionId: 'manual-2026-11-13',
        ts: Date.parse('2026-11-13T12:00:00Z'),
        date: '2026-11-13',
        ref: 'name:Jalones al pecho',
        sets: [{ w: 90, r: 10 }, { w: 90, r: 10 }],
        note: 'RIR 1, buena retracción escapular',
        day: 'Pull',
      },
      {
        id: 'manual-2026-11-13-face-pull',
        sessionId: 'manual-2026-11-13',
        ts: Date.parse('2026-11-13T12:00:00Z'),
        date: '2026-11-13',
        ref: 'name:Face Pull',
        sets: [{ w: 25, r: 15 }, { w: 25, r: 14 }],
        note: 'Pausa 1s atrás',
        day: 'Pull',
      },
    ];

    const a = analyze(rows, s);
    expect(a.unmapped).toEqual([]);

    const jal = a.exercises.get('Jalones al pecho')!;
    expect(jal.n).toBe(2);
    expect(jal.last!.date).toBe('2026-11-13');
    expect(jal.last!.note).toBe('RIR 1, buena retracción escapular');

    const fp = a.exercises.get('Face Pull')!;
    expect(fp.last!.note).toBe('Pausa 1s atrás');
    expect(a.byDay.Pull.some((e) => e.name === 'Face Pull')).toBe(true);

    const lastSess = a.sessions[a.sessions.length - 1];
    expect(lastSess.day).toBe('Pull');
    expect(lastSess.exercises).toContain('Face Pull');
  });
});
