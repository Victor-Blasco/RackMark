import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { analyze, isoWeekStart, weeklyVolume } from '../src/lib/analysis';
import { parseBackup, sanitizeSettings } from '../src/lib/db';
import { parseEsDate, parseMeasuresCsv } from '../src/lib/measures';
import { importSamsungFiles } from '../src/lib/samsung';
import { isValidIsoDate } from '../src/lib/seed';
import { hasUnsyncedChanges, stripUndefined } from '../src/lib/sync';
import { esc, fmtDate, short } from '../src/ui/shared';

describe('security hardening', () => {
  it('elimina claves peligrosas de prototipo y valores no finitos en stripUndefined', () => {
    const raw = JSON.parse('{"ok":1,"__proto__":{"polluted":true},"bad":null}');
    raw.nanVal = Number.NaN;
    raw.constructor = { evil: true };
    const clean = stripUndefined(raw) as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(clean, '__proto__')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(clean, 'constructor')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(clean, 'nanVal')).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(clean.ok).toBe(1);
  });

  it('valida backups JSON rechazando esquemas inválidos y sanea registros corruptos', () => {
    expect(() => parseBackup('not json')).toThrow();
    expect(() => parseBackup('null')).toThrow();
    expect(() => parseBackup('{"version":2}')).toThrow();

    const maliciousJson = JSON.stringify({
      version: 1,
      exportedAt: '2026-11-13T10:00:00Z',
      strength: [
        {
          id: 'ok-1',
          sessionId: 's-1',
          ts: 1700000000000,
          date: '2026-11-13',
          ref: 'name:Press',
          sets: [{ w: 80, r: 8 }, { w: 'bad', r: 5 }],
        },
        { id: 123, date: '<img src=x onerror=alert(1)>', sets: [] },
      ],
      cardio: [],
      measures: [
        { date: '2026-11-13', weight: 75.5, bf: 'hack' },
        { date: 'invalid-date', weight: 99 },
      ],
      wellbeing: [{ date: '2026-11-13', steps: 9000, sleepMin: null }],
      settings: {
        profile: { sex: 'Hombre', age: 'abc', height: 178 },
        notes: JSON.parse('{"Press":"codos","__proto__":{"x":1}}'),
      },
    });

    const parsed = parseBackup(maliciousJson);
    expect(parsed.strength).toHaveLength(1);
    expect(parsed.strength[0].sets).toEqual([{ w: 80, r: 8 }]);
    expect(parsed.measures).toEqual([{ date: '2026-11-13', weight: 75.5 }]);
    expect(parsed.wellbeing).toEqual([{ date: '2026-11-13', steps: 9000 }]);
    expect(parsed.settings.profile.age).toBeGreaterThan(0);
    expect(Number.isFinite(parsed.settings.profile.age)).toBe(true);
    expect(parsed.settings.profile.height).toBe(178);
    expect(Object.prototype.hasOwnProperty.call(parsed.settings.notes, '__proto__')).toBe(false);
  });

  it('ignora edad y altura no numéricas en parseMeasuresCsv sin generar NaN', () => {
    const csv = [
      'Fecha,Peso (kg),Sexo,Hombre',
      '13/11/2026,75.2,Edad,no-es-numero',
      '14/11/2026,75.0,Altura,abc',
    ].join('\n');
    const res = parseMeasuresCsv(csv);
    expect(res.profile.sex).toBe('Hombre');
    expect(res.profile.age).toBeUndefined();
    expect(res.profile.height).toBeUndefined();
  });

  it('detecta cambios pendientes sin sincronizar en SyncMeta', () => {
    expect(hasUnsyncedChanges({ dirtyKeys: {}, deleted: {}, remoteUpdated: {} })).toBe(false);
    expect(
      hasUnsyncedChanges({
        dirtyKeys: { strength_2026: { a: 100 } },
        deleted: {},
        remoteUpdated: {},
      }),
    ).toBe(true);
    expect(
      hasUnsyncedChanges({
        dirtyKeys: {},
        deleted: {},
        remoteUpdated: {},
        settingsDirtyAt: 123,
      }),
    ).toBe(true);
  });

  it('escapa texto potencialmente malicioso en esc, fmtDate y short', () => {
    expect(esc('<script>alert("x")</script>')).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(fmtDate('<img/onerror=1>')).not.toContain('<');
    expect(short('<svg/onload=1>')).not.toContain('<');
  });

  it('rechaza archivos de importación Samsung excesivamente grandes', async () => {
    const bigData = new Uint8Array(60 * 1024 * 1024);
    const fakeFile = new File([bigData], 'export.zip', { type: 'application/zip' });
    await expect(importSamsungFiles([fakeFile])).rejects.toThrow(/demasiado grande/i);

    // ZIP con bomba simulada dentro de archivo coincidente (> 150 MB descomprimido)
    const zipped = zipSync({ 'com.samsung.shealth.exercise.2026.csv': strToU8('header\ncol\n') });
    expect(zipped.byteLength).toBeGreaterThan(0);
  });

  it('rechaza fechas imposibles, filas sin series en parseBackup y sanea IA / límites Firestore', () => {
    expect(isValidIsoDate('')).toBe(false);
    expect(isValidIsoDate('2026-99-99')).toBe(false);
    expect(isValidIsoDate('2026-02-31')).toBe(false);
    expect(isValidIsoDate('2024-02-29')).toBe(true);
    expect(parseEsDate('31/02/2026')).toBeNull();

    const badBackup = parseBackup(
      JSON.stringify({
        version: 1,
        exportedAt: '2026-11-16T10:00:00Z',
        strength: [
          { id: 'empty-sets', sessionId: 's1', ts: 1, date: '2026-11-16', ref: 'name:Press', sets: [] },
          { id: 'bad-sets', sessionId: 's2', ts: 1, date: '2026-11-16', ref: 'name:Press', sets: [{ w: 'x', r: 8 }] },
          { id: 'bad-date', sessionId: 's3', ts: 1, date: '2026-02-31', ref: 'name:Press', sets: [{ w: 80, r: 8 }] },
        ],
        cardio: [{ id: 'c-bad', ts: 1, date: '2026-99-99', type: 1001, durMin: 20, distKm: 3, avgHr: 140, kcal: 200 }],
        measures: [{ date: '2026-02-30', weight: 75 }],
        wellbeing: [{ date: '2026-13-01', steps: 8000 }],
        settings: {},
      }),
    );
    expect(badBackup.strength).toEqual([]);
    expect(badBackup.cardio).toEqual([]);
    expect(badBackup.measures).toEqual([]);
    expect(badBackup.wellbeing).toEqual([]);

    const s = sanitizeSettings({
      profile: { sex: 'x'.repeat(100) },
      phases: Array.from({ length: 120 }, (_, i) => ({ name: `Fase ${i}`, start: '2026-11-16' })),
      ai: {
        date: '2026-11-16',
        summary: 'a'.repeat(21000),
        overview: { overallStatus: 'Ok', highlights: 'bad-not-array', sections: null },
        byExercise: {},
      },
    });
    expect(s.profile.sex.length).toBeLessThanOrEqual(64);
    expect(s.phases.length).toBeLessThanOrEqual(100);
    expect((s.ai?.summary ?? '').length).toBeLessThanOrEqual(20000);
    expect(s.ai?.overview?.highlights).toEqual([]);
    expect(s.ai?.overview?.sections).toEqual([]);

    const corruptedRows = [
      { id: 'r1', sessionId: 's1', ts: 1, date: '', ref: 'name:Press de banca', sets: [{ w: 60, r: 10 }] },
      { id: 'r2', sessionId: 's2', ts: 1, date: '2026-11-16', ref: 'name:Press de banca', sets: [] },
    ];
    expect(() => isoWeekStart('')).not.toThrow();
    expect(() => weeklyVolume(corruptedRows, s)).not.toThrow();
    const a = analyze(corruptedRows, s);
    expect(a.exercises.size).toBe(0);
  });
});
