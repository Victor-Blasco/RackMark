import { describe, expect, it } from 'vitest';
import type { ChartConfiguration } from 'chart.js';
import { buildPrompt } from '../src/lib/ai';
import { analyze } from '../src/lib/analysis';
import { parseBackup, sanitizeSettings } from '../src/lib/db';
import { norm } from '../src/lib/seed';
import { allExerciseNames } from '../src/ui/logView';
import { normalizeChartConfig, type State } from '../src/ui/shared';

describe('ai tone & chart axis offset', () => {
  it('adapta el prompt de IA según el tono simple o técnico manteniendo la estructura JSON', () => {
    const samplePayload = { fase: 'Definición' };
    const simplePrompt = buildPrompt(samplePayload, 'simple');
    const techPrompt = buildPrompt(samplePayload, 'technical');

    expect(simplePrompt).toContain('"summary"');
    expect(simplePrompt).toContain('"byExercise"');
    expect(simplePrompt).toContain('Peso y forma física');
    expect(simplePrompt).toContain('sin tecnicismos');
    expect(simplePrompt).not.toContain('fatiga del SNC');

    expect(techPrompt).toContain('"summary"');
    expect(techPrompt).toContain('"byExercise"');
    expect(techPrompt).toContain('Composición Corporal y Antropometría');
    expect(techPrompt).toContain('fatiga del SNC');
  });

  it('conserva aiTone y ai.tone válidos en parseBackup y sanea valores desconocidos', () => {
    const valid = parseBackup(
      JSON.stringify({
        version: 1,
        exportedAt: '2026-11-13T10:00:00Z',
        strength: [],
        cardio: [],
        measures: [],
        settings: {
          aiTone: 'simple',
          ai: { date: '2026-11-13', tone: 'simple', summary: 'Todo bien', byExercise: {} },
        },
      }),
    );
    expect(valid.settings.aiTone).toBe('simple');
    expect(valid.settings.ai?.tone).toBe('simple');

    const invalid = parseBackup(
      JSON.stringify({
        version: 1,
        exportedAt: '2026-11-13T10:00:00Z',
        strength: [],
        cardio: [],
        measures: [],
        settings: {
          aiTone: 'ultra-nerd',
          ai: { date: '2026-11-13', tone: 'bad', summary: 'Ok', byExercise: {} },
        },
      }),
    );
    expect(invalid.settings.aiTone).toBe('technical');
    expect(invalid.settings.ai?.tone).toBeUndefined();
  });

  it('aplica offset en los ejes de líneas y margen superior sin flotar en barras', () => {
    const lineCfg = normalizeChartConfig({
      type: 'line',
      data: { labels: ['01/11'], datasets: [{ label: 'Peso', data: [70] }] },
    });
    const lineScales = lineCfg.options?.scales as Record<string, Record<string, unknown>>;
    expect(lineScales.x.offset).toBe(true);
    expect(lineScales.y.offset).toBe(true);

    const dualCfg = normalizeChartConfig({
      type: 'line',
      data: { labels: ['01/11'], datasets: [{ label: 'Peso', data: [70] }] },
      options: {
        scales: {
          y: { position: 'left' },
          y1: { position: 'right', grid: { drawOnChartArea: false } },
        },
      },
    });
    const dualScales = dualCfg.options?.scales as Record<string, Record<string, unknown>>;
    expect(dualScales.x.offset).toBe(true);
    expect(dualScales.y.offset).toBe(true);
    expect(dualScales.y.position).toBe('left');
    expect(dualScales.y1.offset).toBe(true);
    expect(dualScales.y1.position).toBe('right');

    const barCfg = normalizeChartConfig({
      type: 'bar',
      data: { labels: ['Sem 1'], datasets: [{ label: 'Pasos', data: [8000] }] },
    } satisfies ChartConfiguration);
    const barScales = barCfg.options?.scales as Record<string, Record<string, unknown>>;
    expect(barScales.y.beginAtZero).toBe(true);
    expect(barScales.y.grace).toBe('8%');
    expect(barScales.y.offset).toBeUndefined();
  });

  it('oculta la leyenda con 1 serie, usa pointStyle con varias y reduce puntos en series densas', () => {
    const dense = normalizeChartConfig({
      type: 'line',
      data: {
        labels: Array.from({ length: 30 }, (_, i) => `${i + 1}/10`),
        datasets: [{ label: 'Peso máx (kg)', data: Array.from({ length: 30 }, () => 30) }],
      },
    });
    const denseDs = dense.data.datasets[0] as unknown as { pointRadius?: number; pointHitRadius?: number };
    const densePlugins = dense.options?.plugins as Record<string, Record<string, unknown>>;
    const denseX = (dense.options?.scales as Record<string, Record<string, unknown>>).x.ticks as Record<string, unknown>;
    expect(denseDs.pointRadius).toBe(0);
    expect(denseDs.pointHitRadius).toBe(18);
    expect(densePlugins.legend.display).toBe(false);
    expect(denseX.maxRotation).toBe(0);
    expect(denseX.maxTicksLimit).toBe(6);

    const multi = normalizeChartConfig({
      type: 'line',
      data: {
        labels: ['01/11', '08/11'],
        datasets: [
          { label: 'Peso máx (kg)', data: [35, 37.5] },
          { label: 'FC media (lpm)', data: [120, 125] },
        ],
      },
    });
    const multiDs = multi.data.datasets[0] as unknown as { pointRadius?: number };
    const multiLegend = (multi.options?.plugins as Record<string, Record<string, unknown>>).legend;
    const multiLabels = multiLegend.labels as Record<string, unknown>;
    expect(multiDs.pointRadius).toBe(2.5);
    expect(multiLegend.display).toBe(true);
    expect(multiLabels.usePointStyle).toBe(true);
  });
});

describe('custom routines & dynamic exercise catalog', () => {
  it('sanitizeSettings y analyze soportan rutinas personalizadas y routineMeta', () => {
    const settings = sanitizeSettings({
      routines: {
        'Torso A': [{ name: 'Press banca mancuerna', sets: 3, reps: 8 }],
        'Pierna A': [{ name: 'Sentadilla Hack', sets: 3, reps: 10 }],
      },
      routineMeta: {
        'Torso A': { color: '#3B82F6', sub: 'Fuerza' },
        'Pierna A': { color: 'not-a-color', sub: 'Tren inf.' },
      },
    });

    expect(Object.keys(settings.routines)).toEqual(['Torso A', 'Pierna A']);
    expect(settings.routineMeta).toEqual({
      'Torso A': { color: '#3B82F6', sub: 'Fuerza' },
      'Pierna A': { sub: 'Tren inf.' },
    });

    const a = analyze(
      [
        {
          id: 'row-1',
          sessionId: 'sess-1',
          ts: Date.UTC(2026, 10, 10, 18, 0),
          date: '2026-11-10',
          ref: 'name:Press banca mancuerna',
          sets: [{ w: 30, r: 8 }, { w: 30, r: 8 }],
          day: 'Torso A',
        },
      ],
      settings,
    );

    expect(Object.keys(a.byDay)).toEqual(['Torso A', 'Pierna A']);
    expect(a.byDay['Torso A'].map((e) => e.name)).toContain('Press banca mancuerna');
    expect(a.sessions[0]?.day).toBe('Torso A');
  });

  it('parseBackup conserva rutinas personalizadas en settings y strength.day', () => {
    const backup = parseBackup(
      JSON.stringify({
        version: 1,
        exportedAt: '2026-11-14T10:00:00Z',
        strength: [
          {
            id: 's1',
            sessionId: 'sess-fb',
            ts: 1794650400000,
            date: '2026-11-14',
            ref: 'name:Hip Thrust',
            sets: [{ w: 120, r: 10 }],
            day: 'Full Body',
          },
        ],
        cardio: [],
        measures: [],
        wellbeing: [],
        settings: {
          routines: {
            'Full Body': [{ name: 'Hip Thrust', sets: 3, reps: 10 }],
          },
          routineMeta: {
            'Full Body': { color: '#10B981', sub: 'Global' },
          },
        },
      }),
    );

    expect(Object.keys(backup.settings.routines)).toEqual(['Full Body']);
    expect(backup.settings.routineMeta?.['Full Body']).toEqual({ color: '#10B981', sub: 'Global' });
    expect(backup.strength[0]?.day).toBe('Full Body');
  });

  it('allExerciseNames devuelve ejercicios personalizados guardados en customNames', () => {
    const settings = sanitizeSettings({
      customNames: { [`manual:${norm('Remo en polea gironda')}`]: 'Remo en polea gironda' },
      muscles: { [norm('Remo en polea gironda')]: { p: 'Espalda', s: ['Bíceps'] } },
    });
    const fakeState = {
      settings,
      analysis: analyze([], settings),
    } as unknown as State;

    expect(allExerciseNames(fakeState)).toContain('Remo en polea gironda');
  });
});
