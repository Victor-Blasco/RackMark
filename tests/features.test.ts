import { describe, expect, it } from 'vitest';
import type { ChartConfiguration } from 'chart.js';
import { buildPrompt } from '../src/lib/ai';
import { analyze, judge, weeklyVolume } from '../src/lib/analysis';
import { parseBackup, sanitizeSettings } from '../src/lib/db';
import { importSamsungInWorker } from '../src/lib/samsung';
import { DEFAULT_MUSCLES, DEFAULT_SETTINGS, norm } from '../src/lib/seed';
import { viewAdherence, viewBody, viewCalc, viewVolume } from '../src/ui/analyticsViews';
import { ICON_PATHS } from '../src/ui/icons';
import { allExerciseNames, extractTargetWeight, fmtMMSS, initLogDraft, manualSessionId, renderRestTimerBar, viewLog } from '../src/ui/logView';
import { plannedWeeklyVolume, renderModals, renderPlanCatalogResults, viewPlan } from '../src/ui/planView';
import { moveItem } from '../src/ui/reorder';
import { activeTabTitle, renderMobileHeader, renderMobileNav, renderSidebar, syncStatusInfo } from '../src/ui/shellView';
import {
  inRange,
  isAiFreshForEx,
  movingAverage7d,
  normalizeChartConfig,
  rangePicker,
  resetCharts,
  resolveRange,
  routineShort,
  todayIso,
  weightDeltaColor,
  type State,
} from '../src/ui/shared';
import { buildBodyHomeChartConfig, buildCompChartConfig, buildHomeExChartConfig, renderAiReport, viewDay, viewHome } from '../src/ui/views';
import { viewSettings } from '../src/ui/settingsView';
import { initLiveWorkout, viewWorkout } from '../src/ui/workoutView';
import { filterSelectionOptions, groupSelectionOptions, normalizeSelectionText, sortRecentSelectionOptions } from '../src/ui/selection';
import {
  createWizardDraft,
  daysActivityFactor,
  goalCalorieDelta,
  goalPhaseName,
  recommendTemplate,
  renderWizardModal,
} from '../src/ui/wizardView';

describe('selection patterns', () => {
  it('normaliza tildes, busca aliases, agrupa y ordena recientes', () => {
    const options = [
      { id: 'bench', label: 'Press banca', aliases: ['bench press'], group: 'Pecho', lastUsedAt: 2 },
      { id: 'row', label: 'Remo sentado', aliases: ['seated row'], group: 'Espalda', lastUsedAt: 3 },
    ];
    expect(normalizeSelectionText('  Press BÁNCA  ')).toBe('press banca');
    expect(filterSelectionOptions(options, 'bench')).toEqual([options[0]]);
    expect([...groupSelectionOptions(options).keys()]).toEqual(['Pecho', 'Espalda']);
    expect(sortRecentSelectionOptions(options).map((option) => option.id)).toEqual(['row', 'bench']);
  });
});

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

describe('custom date range filter', () => {
  it('resuelve rangos predefinidos y rangos personalizados de fecha sin hora', () => {
    const todoState = { ranges: { home: 'Todo' } } as unknown as State;
    const todo = resolveRange(todoState, 'home');
    expect(todo).toEqual({ key: 'Todo', from: null, to: null, label: 'Todo', days: undefined });
    expect(inRange('2025-01-01', todo)).toBe(true);

    const presetState = {} as unknown as State;
    const def = resolveRange(presetState, 'home');
    expect(def.key).toBe('1M');
    expect(def.days).toBe(30);
    expect(def.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(def.to).toBeNull();

    const customState = {
      ranges: { home: 'Custom' },
      customRanges: { home: { from: '2026-10-01', to: '2026-10-15' } },
    } as unknown as State;
    const custom = resolveRange(customState, 'home');
    expect(custom).toEqual({
      key: 'Custom',
      from: '2026-10-01',
      to: '2026-10-15',
      label: '01/10–15/10',
      days: 15,
    });
    expect(inRange('2026-09-30', custom)).toBe(false);
    expect(inRange('2026-10-01', custom)).toBe(true);
    expect(inRange('2026-10-15', custom)).toBe(true);
    expect(inRange('2026-10-16', custom)).toBe(false);

    const swappedState = {
      ranges: { Push: 'Custom' },
      customRanges: { Push: { from: '2026-11-10', to: '2026-11-01' } },
    } as unknown as State;
    const swapped = resolveRange(swappedState, 'Push');
    expect(swapped.from).toBe('2026-11-01');
    expect(swapped.to).toBe('2026-11-10');
    expect(swapped.days).toBe(10);
    expect(inRange('2026-11-05', swapped)).toBe(true);
  });
});

describe('reorder helper', () => {
  it('mueve elementos entre posiciones válidas y rechaza índices fuera de rango o idénticos', () => {
    const list = ['Press', 'Remo', 'Sentadilla', 'Curl'];
    expect(moveItem(list, 0, 2)).toBe(true);
    expect(list).toEqual(['Remo', 'Sentadilla', 'Press', 'Curl']);

    expect(moveItem(list, 3, 1)).toBe(true);
    expect(list).toEqual(['Remo', 'Curl', 'Sentadilla', 'Press']);

    expect(moveItem(list, 1, 1)).toBe(false);
    expect(moveItem(list, -1, 2)).toBe(false);
    expect(moveItem(list, 0, 4)).toBe(false);
    expect(list).toEqual(['Remo', 'Curl', 'Sentadilla', 'Press']);
  });
});

describe('live logger draft, judge & ai freshness (P0)', () => {
  it('inicia series nuevas con done=false y separa sessionId por rutina en el mismo día', () => {
    const settings = sanitizeSettings({
      routines: {
        Push: [{ name: 'Press de banca', sets: 3, reps: 8 }, { name: 'Elevaciones laterales', sets: 3, reps: 12 }],
        Leg: [{ name: 'Sentadilla Hack', sets: 3, reps: 10 }],
      },
    });
    const savedPush = {
      id: 'manual-2026-11-15-push-press de banca',
      sessionId: manualSessionId('2026-11-15', 'Push'),
      ts: Date.UTC(2026, 10, 15, 10, 0),
      date: '2026-11-15',
      ref: 'name:Press de banca',
      day: 'Push',
      sets: [{ w: 80, r: 8 }, { w: 80, r: 8 }],
    };
    const fakeState = {
      settings,
      strength: [savedPush],
      analysis: analyze([savedPush], settings),
    } as unknown as State;

    expect(manualSessionId('2026-11-15', 'Push')).toBe('manual-2026-11-15-push');
    expect(manualSessionId('2026-11-15', 'Leg')).toBe('manual-2026-11-15-leg');

    const pushDraft = initLogDraft(fakeState, 'Push', '2026-11-15');
    expect(pushDraft.dirty).toBe(false);
    expect(pushDraft.exercises[0]?.done).toBe(true);
    expect(pushDraft.exercises[0]?.sets.every((s) => s.done)).toBe(true);
    expect(pushDraft.exercises[1]?.done).toBe(false);
    expect(pushDraft.exercises[1]?.sets.every((s) => s.done === false)).toBe(true);

    const legDraft = initLogDraft(fakeState, 'Leg', '2026-11-15');
    expect(legDraft.sessionId).toBe('manual-2026-11-15-leg');
    expect(legDraft.exercises[0]?.done).toBe(false);
    expect(legDraft.exercises[0]?.sets.every((s) => s.done === false)).toBe(true);
  });

  it('interpola last.top en judge() y detecta informes IA obsoletos', () => {
    const verdict = judge('Press de banca', [
      { date: '2026-11-01', sets: [{ w: 80, r: 8 }], top: 80, repsAtTop: 8, volume: 640, e1rm: 101.3 },
      { date: '2026-11-15', sets: [{ w: 30, r: 10 }], top: 30, repsAtTop: 10, volume: 300, e1rm: 40 },
    ]);
    expect(verdict.status).toBe('Cambio de carga');
    expect(verdict.prescription).toContain('(30 kg)');

    const settings = sanitizeSettings({
      ai: { date: '2026-11-10', byExercise: {} },
    });
    const fakeState = { settings } as unknown as State;
    expect(isAiFreshForEx(fakeState, { last: { date: '2026-11-10' } } as never)).toBe(true);
    expect(isAiFreshForEx(fakeState, { last: { date: '2026-11-15' } } as never)).toBe(false);
  });
});

describe('P1 analytics, trends & empty states', () => {
  it('calcula media móvil de 7 días naturales incluyendo huecos y ventana límite', () => {
    const out = movingAverage7d([
      { date: '2026-11-01', weight: 80 },
      { date: '2026-11-03', weight: 79 },
      { date: '2026-11-07', weight: 78 },
      { date: '2026-11-10', weight: 77 },
      { date: '2026-11-11', weight: undefined },
    ]);
    // 01/11: [80] -> 80
    // 03/11: [80, 79] -> 79.5
    // 07/11 (diff 6d desde 01/11): [80, 79, 78] -> 79
    // 10/11 (01/11 ya queda a 9d; entran 07/11 y 10/11? diff 07->10=3d, diff 03->10=7d > 6): [78, 77] -> 77.5
    // 11/11 (07/11=4d, 10/11=1d, 11/11=undef): [78, 77] -> 77.5
    expect(out).toEqual([80, 79.5, 79, 77.5, 77.5]);
  });

  it('colorea delta de peso coherentemente según la fase nutricional', () => {
    expect(weightDeltaColor(-0.5, 'Definición')).toBe('text-emerald-400');
    expect(weightDeltaColor(0.8, 'Definición')).toBe('text-amberGold');
    expect(weightDeltaColor(0.6, 'Volumen')).toBe('text-emerald-400');
    expect(weightDeltaColor(-0.5, 'Volumen')).toBe('text-amberGold');
    expect(weightDeltaColor(0.2, 'Mantenimiento')).toBe('text-emerald-400');
    expect(weightDeltaColor(1.2, 'Mantenimiento')).toBe('text-blue-300');
  });

  it('respeta el fallback de resolveRange y permite animaciones explícitas en Chart.js', () => {
    const emptyRanges = {} as unknown as State;
    expect(resolveRange(emptyRanges, 'home').key).toBe('1M');
    expect(resolveRange(emptyRanges, 'body', 'Todo').key).toBe('Todo');
    expect(resolveRange(emptyRanges, 'volume', '3M').key).toBe('3M');

    const cfg = normalizeChartConfig({
      type: 'line',
      data: { labels: ['01/11'], datasets: [{ label: 'Peso', data: [75] }] },
    });
    expect((cfg.options as Record<string, unknown>).animation).toBe(false);

    const explicitAnim = normalizeChartConfig({
      type: 'line',
      data: { labels: ['01/11'], datasets: [{ label: 'Peso', data: [75] }] },
      options: { animation: { duration: 120 } },
    });
    expect((explicitAnim.options as Record<string, unknown>).animation).toEqual({ duration: 120 });
  });

  it('muestra estados vacíos accionables sin gráficas ni tablas a cero y etiqueta ejemplos en calculadoras', () => {
    const settings = sanitizeSettings({});
    const emptyState: State = {
      tab: 'home',
      strength: [],
      cardio: [],
      measures: [],
      wellbeing: [],
      settings,
      analysis: analyze([], settings),
      sel: {},
      perimeter: 'arms',
      muscleSel: 'Pecho',
    };

    const volHtml = viewVolume(emptyState);
    expect(volHtml).toContain('+ Registrar entreno');
    expect(volHtml).toContain('Importar datos');
    expect(volHtml).not.toContain('<canvas');
    expect(volHtml).not.toContain('min-w-[640px]');

    const adhHtml = viewAdherence(emptyState);
    expect(adhHtml).toContain('+ Registrar entreno');
    expect(adhHtml).not.toContain('<canvas');
    expect(adhHtml).not.toContain('Calendario (últimas');

    const homeHtml = viewHome(emptyState);
    expect(homeHtml).toContain('+ Empezar primer entreno hoy');
    expect(homeHtml).not.toContain('<canvas');
    expect(homeHtml).not.toContain('ai-report');

    const calcHtml = viewCalc(emptyState);
    expect(calcHtml).toContain('Valores de ejemplo');

    const bodyHtml = viewBody(emptyState);
    expect(bodyHtml).toContain('Filtro temporal');

    resetCharts();
  });
});

describe('P2 desktop lab, routineShort & planned volume', () => {
  it('genera abreviaturas cortas sin colisiones y conserva Pu/Pl/Lg', () => {
    expect(routineShort('Push')).toBe('Pu');
    expect(routineShort('Pull')).toBe('Pl');
    expect(routineShort('Leg')).toBe('Lg');
    expect(routineShort('Full Body A')).toBe('FBA');
    expect(routineShort('Full Body B')).toBe('FBB');
    expect(routineShort('Pecho y Tríceps')).toBe('PT');
    expect(routineShort('Pecho')).toBe('Pe');
    expect(routineShort('Pierna')).toBe('Pi');
    expect(routineShort('')).toBe('·');
  });

  it('calcula el volumen semanal planificado sumando principal=1 y secundario=0,5', () => {
    const settings = sanitizeSettings({
      routines: {
        Torso: [
          { name: 'Press Banca X', sets: 4, reps: 8 },
          { name: 'Remo Barra X', sets: 4, reps: 10 },
        ],
      },
      muscles: {
        [norm('Press Banca X')]: { p: 'Pecho', s: ['Tríceps', 'Hombro'] },
        [norm('Remo Barra X')]: { p: 'Espalda', s: ['Bíceps'] },
      },
    });
    const vol = plannedWeeklyVolume(settings);
    expect(vol.get('Pecho')).toBe(4);
    expect(vol.get('Espalda')).toBe(4);
    expect(vol.get('Tríceps')).toBe(2);
    expect(vol.get('Hombro')).toBe(2);
    expect(vol.get('Bíceps')).toBe(2);
  });

  it('suma solo las series válidas registradas por músculo principal y secundario', () => {
    const settings = sanitizeSettings({
      muscles: {
        [norm('Press Banca X')]: { p: 'Pecho', s: ['Tríceps', 'Hombros', 'Tríceps'] },
      },
    });
    const rows = [
      {
        id: 's1',
        sessionId: 'ses1',
        ts: 1,
        date: '2026-11-16',
        ref: 'name:Press Banca X',
        sets: [
          { w: 80, r: 8 },
          { w: 82.5, r: 6 },
          { w: -5, r: 8 },
          { w: 70, r: 0 },
        ],
      },
    ] as Parameters<typeof weeklyVolume>[0];

    const vol = weeklyVolume(rows, settings);
    const week = '2026-11-16';
    expect(vol.get('Pecho')?.get(week)).toBe(2);
    expect(vol.get('Tríceps')?.get(week)).toBe(1);
    expect(vol.get('Hombros')?.get(week)).toBe(1);
  });

  it('no suma sesiones fuera del rango activo de la ventana Volumen', () => {
    const settings = sanitizeSettings({
      muscles: {
        [norm('Press Banca X')]: { p: 'Pecho', s: ['Tríceps'] },
      },
    });
    const rows = [
      { id: 'before', sessionId: 'before', ts: 1, date: '2026-11-12', ref: 'name:Press Banca X', sets: [{ w: 80, r: 8 }, { w: 80, r: 8 }] },
      { id: 'inside', sessionId: 'inside', ts: 2, date: '2026-11-16', ref: 'name:Press Banca X', sets: [{ w: 80, r: 8 }] },
      { id: 'after', sessionId: 'after', ts: 3, date: '2026-11-20', ref: 'name:Press Banca X', sets: [{ w: 80, r: 8 }, { w: 80, r: 8 }] },
    ] as Parameters<typeof weeklyVolume>[0];

    const vol = weeklyVolume(rows, settings, '2026-11-16', '2026-11-18');
    expect(vol.get('Pecho')?.get('2026-11-16')).toBe(1);
    expect(vol.get('Pecho')?.get('2026-11-09')).toBeUndefined();
  });

  it('renderiza Modo Laboratorio en viewPlan, modal de notas y cross-links sin card-itis', async () => {
    const settings = sanitizeSettings({
      routines: {
        Torso: [{ name: 'Press Banca X', sets: 4, reps: 8 }],
      },
      muscles: {
        [norm('Press Banca X')]: { p: 'Pecho', s: ['Tríceps'] },
        [norm('Sentadilla Hack')]: { p: 'Cuádriceps', s: ['Glúteo'] },
      },
    });
    const recentTs = Date.now() - 2 * 864e5;
    const recentDate = new Date(recentTs).toISOString().slice(0, 10);
    const strength = [
      { id: 's1', sessionId: 'ses1', ts: recentTs, date: recentDate, ref: 'name:Press Banca X', sets: [{ w: 80, r: 8 }] },
    ];
    const analysis = analyze(strength, settings);
    const state: State = {
      tab: 'plan',
      strength,
      cardio: [],
      measures: [{ date: recentDate, weight: 75, bf: 14 }],
      wellbeing: [],
      settings,
      analysis,
      sel: {},
      perimeter: 'waist',
      muscleSel: 'Pecho',
      planSearch: 'Hack',
      planTargetRoutine: 'Torso',
      noteModal: { exName: 'Press Banca X', value: 'Pausa 1s abajo' },
    };

    const planHtml = viewPlan(state);
    expect(planHtml).toContain('lg:grid-cols-12');
    expect(planHtml).toContain('Simulador de volumen semanal');
    expect(planHtml).toContain('id="planExSearch"');
    expect(planHtml).toContain('data-change="planTargetRoutine"');
    expect(planHtml).toContain('data-act="rtQuickAdd"');
    expect(planHtml).toContain('Sentadilla Hack');

    const emptySearchHtml = viewPlan({ ...state, planSearch: 'zzzznoexiste' });
    expect(emptySearchHtml).toContain('Sin resultados');

    const modalHtml = renderModals(state);
    expect(modalHtml).toContain('id="note-modal"');
    expect(modalHtml).toContain('id="f-note-modal"');
    expect(modalHtml).toContain('id="noteModalInput"');
    expect(modalHtml).toContain('Pausa 1s abajo');
    expect(modalHtml).not.toContain('backdrop-blur');

    const homeHtml = viewHome(state);
    expect(homeHtml).toContain('data-act="openExDetail"');
    expect(homeHtml).toContain('Torso|Press Banca X');

    const volHtml = viewVolume(state);
    expect(volHtml).toContain('hidden md:block');
    expect(volHtml).toContain('md:hidden');

    const adhHtml = viewAdherence(state);
    expect(adhHtml).toContain('hidden md:flex');
    expect(adhHtml).toContain('flex md:hidden');

    const calcHtml = viewCalc(state);
    expect(calcHtml).toContain('divide-white/10');

    const emptyImport = await importSamsungInWorker([]);
    expect(emptyImport.strength).toEqual([]);

    resetCharts();
  });
});

describe('onboarding wizard & athlete profile', () => {
  it('conserva campos válidos de objetivo, experiencia, frecuencia y onboardingCompleted y sanea inválidos', () => {
    const valid = sanitizeSettings({
      onboardingCompleted: true,
      profile: {
        sex: 'mujer',
        age: 29,
        height: 165,
        goal: 'cut',
        experience: 'beginner',
        daysPerWeek: 3,
      },
    });
    expect(valid.onboardingCompleted).toBe(true);
    expect(valid.profile.goal).toBe('cut');
    expect(valid.profile.experience).toBe('beginner');
    expect(valid.profile.daysPerWeek).toBe(3);

    const invalid = sanitizeSettings({
      onboardingCompleted: 'yes',
      profile: {
        sex: 'hombre',
        age: 30,
        height: 175,
        goal: 'olympia',
        experience: 'pro-max',
        daysPerWeek: 12,
      },
    });
    expect(invalid.onboardingCompleted).toBeUndefined();
    expect(invalid.profile.goal).toBeUndefined();
    expect(invalid.profile.experience).toBeUndefined();
    expect(invalid.profile.daysPerWeek).toBeUndefined();
  });

  it('calcula plantilla recomendada, fase inicial, ajuste calórico y factor de actividad', () => {
    expect(recommendTemplate(3, 'beginner')).toBe('fullBody');
    expect(recommendTemplate(3, 'intermediate')).toBe('ppl');
    expect(recommendTemplate(4, 'beginner')).toBe('upperLower');
    expect(recommendTemplate(5, 'advanced')).toBe('ppl');

    expect(goalPhaseName('bulk')).toBe('Volumen limpio');
    expect(goalPhaseName('cut')).toBe('Definición');
    expect(goalPhaseName('recomp')).toBe('Mantenimiento');
    expect(goalPhaseName('strength')).toBe('Fuerza');

    expect(goalCalorieDelta('bulk')).toBe('225');
    expect(goalCalorieDelta('cut')).toBe('-350');
    expect(goalCalorieDelta('recomp')).toBe('0');
    expect(goalCalorieDelta('strength')).toBe('225');

    expect(daysActivityFactor(3)).toBe('1.55');
    expect(daysActivityFactor(5)).toBe('1.65');
    expect(daysActivityFactor(6)).toBe('1.75');
  });

  it('renderiza los 3 pasos del wizard y los accesos manuales en Inicio y Ajustes', () => {
    const settings = sanitizeSettings({
      aiTone: 'simple',
      profile: { sex: 'mujer', age: 26, height: 164, goal: 'recomp', experience: 'beginner', daysPerWeek: 3 },
    });
    const baseState: State = {
      tab: 'home',
      strength: [],
      cardio: [],
      measures: [{ date: '2026-11-15', weight: 61.5, bf: 22 }],
      wellbeing: [],
      settings,
      analysis: analyze([], settings),
      sel: {},
      perimeter: 'waist',
      muscleSel: 'Pecho',
    };

    const draft = createWizardDraft(baseState);
    expect(draft.step).toBe(1);
    expect(draft.sex).toBe('mujer');
    expect(draft.weight).toBe('61.5');
    expect(draft.templateKey).toBe('fullBody');
    expect(draft.aiTone).toBe('simple');

    const step1Html = renderModals({ ...baseState, wizard: draft });
    expect(step1Html).toContain('id="wizard-modal"');
    expect(step1Html).toContain('id="f-wizard"');
    expect(step1Html).toContain('id="wizAge"');
    expect(step1Html).toContain('Omitir');
    expect(step1Html).toContain('wizard-modal-in');
    expect(step1Html).not.toContain('backdrop-blur');

    const step2Html = renderWizardModal({ ...baseState, wizard: { ...draft, step: 2, anim: 'next' } });
    expect(step2Html).toContain('Objetivo principal');
    expect(step2Html).toContain('data-act="wizardPickGoal"');
    expect(step2Html).toContain('data-act="wizardBack"');
    expect(step2Html).toContain('wizard-step-next');
    expect(step2Html).toContain('wizard-bar-fill');

    const stepBackHtml = renderWizardModal({ ...baseState, wizard: { ...draft, step: 1, anim: 'prev' } });
    expect(stepBackHtml).toContain('wizard-step-prev');

    const stepStaticHtml = renderWizardModal({ ...baseState, wizard: { ...draft, step: 2, anim: undefined } });
    expect(stepStaticHtml).not.toContain('wizard-step-next');
    expect(stepStaticHtml).not.toContain('wizard-step-prev');

    const step3Html = renderWizardModal({ ...baseState, wizard: { ...draft, step: 3, anim: undefined } });
    expect(step3Html).toContain('Recomendada');
    expect(step3Html).toContain('data-act="wizardPickTpl"');
    expect(step3Html).toContain('data-act="wizardPickTone"');

    const homeHtml = viewHome({ ...baseState, measures: [] });
    expect(homeHtml).toContain('data-act="openWizard"');

    const settingsHtml = viewSettings(baseState);
    expect(settingsHtml).toContain('data-act="openWizard"');
    expect(settingsHtml).toContain('data-change="pfGoal"');
    expect(settingsHtml).toContain('data-change="pfExp"');
    expect(settingsHtml).toContain('data-change="pfDays"');

    resetCharts();
  });

  it('corrige P0: todayIso local, extractTargetWeight sin falsos deltas, telemetría en initLogDraft y timer estable', () => {
    const earlyLocal = new Date(2026, 10, 15, 0, 15, 0);
    expect(todayIso(earlyLocal)).toBe('2026-11-15');
    expect(todayIso(new Date(2026, 0, 5, 23, 59, 0))).toBe('2026-01-05');

    expect(extractTargetWeight('Buen progreso (+2.5 kg vs media reciente)')).toBeNull();
    expect(extractTargetWeight('Sube a 82.5 kg en la próxima sesión')).toBe(82.5);
    expect(extractTargetWeight('Usa 45,5 kg y controla la bajada')).toBe(45.5);
    expect(extractTargetWeight('Objetivo: 100 kg')).toBe(100);

    const settings = sanitizeSettings({});
    const samsungRow = {
      id: 'sam-123',
      sessionId: 'sess-sam-1',
      ts: 1763200000000,
      date: '2026-11-15',
      ref: 'type:10011',
      day: 'Empuje' as const,
      sets: [{ w: 80, r: 8 }, { w: 80, r: 7 }],
      durMin: 18,
      avgHr: 128,
      maxHr: 152,
      minHr: 96,
      kcal: 145,
      note: 'buena técnica',
    };
    const state: State = {
      tab: 'log',
      strength: [samsungRow],
      cardio: [],
      measures: [],
      wellbeing: [],
      settings,
      analysis: analyze([samsungRow], settings),
      sel: {},
      perimeter: 'waist',
      muscleSel: 'Pecho',
    };

    const draft = initLogDraft(state, 'Empuje', '2026-11-15', 'sess-sam-1');
    const bench = draft.exercises.find((e) => e.meta?.id === 'sam-123');
    expect(bench).toBeDefined();
    expect(bench?.meta).toEqual({
      id: 'sam-123',
      ts: 1763200000000,
      durMin: 18,
      avgHr: 128,
      maxHr: 152,
      minHr: 96,
      kcal: 145,
    });

    expect(fmtMMSS(95)).toBe('1:35');
    expect(fmtMMSS(0)).toBe('0:00');
    const live = initLiveWorkout(state, 'Push');
    const runningHtml = renderRestTimerBar({ ...live, restUntil: Date.now() + 65_000 });
    expect(runningHtml).toContain('data-rest-state="running"');
    expect(runningHtml).toContain('id="rest-timer-val"');
    expect(renderRestTimerBar({ ...live, restUntil: Date.now() - 1000 })).toContain('data-rest-state="done"');
    expect(renderRestTimerBar({ ...live, restUntil: undefined })).toContain('data-rest-state="idle"');

    const logHtml = viewLog({ ...state, logDraft: draft });
    expect(logHtml).not.toContain('id="rest-timer-bar"');
    expect(logHtml).toContain('data-log-rest="');
    expect(logHtml).toContain('data-act="tab" data-arg="workout"');
    expect(logHtml).toContain('Peso (kg)');
    expect(logHtml).toContain('Reps');
    expect(logHtml).toContain('flex-wrap sm:flex-nowrap items-center gap-1.5 rounded-xl p-1.5');
    expect(logHtml).toContain('min-w-[132px]');
    expect(logHtml).toContain('min-h-[44px]');
    expect(logHtml).not.toContain('!min-h-[44px]');
    expect(logHtml).toContain('min-w-[44px]');
  });
});

describe('live workout & manual rest separation', () => {
  const makeState = (strengthRows: State['strength'] = []): State => ({
    tab: 'workout',
    strength: strengthRows,
    cardio: [],
    measures: [],
    wellbeing: [],
    settings: structuredClone(DEFAULT_SETTINGS),
    analysis: analyze(strengthRows, DEFAULT_SETTINGS),
    sel: {},
    perimeter: 'waist',
    muscleSel: '',
  });

  it('muestra selector de rutina y sugiere Toca hoy cuando no hay liveWorkout activo', () => {
    const pushSession = {
      id: 's1',
      sessionId: 'manual-2026-11-10-Push',
      ts: Date.parse('2026-11-10T12:00:00Z'),
      date: '2026-11-10',
      ref: 'name:Press Banca',
      day: 'Push',
      sets: [{ w: 80, r: 8, restSec: 105 }],
    };
    const state = makeState([pushSession]);
    const html = viewWorkout(state);
    expect(html).toContain('Iniciar entrenamiento');
    expect(html).toContain('Toca hoy');
    expect(html).toContain('data-act="liveStart" data-arg="Pull"');
    expect(html).toContain('data-act="liveStart" data-arg="Libre"');
    expect(html).toContain('data-act="tab" data-arg="log"');

    const homeHtml = viewHome(state);
    expect(homeHtml).toContain('data-act="startWorkout"');
    expect(homeHtml).toContain('data-act="goLog"');
  });

  it('renderiza solo el ejercicio activo en liveWorkout, paneles swap/add, aviso de avance y conserva restSec', () => {
    const state = makeState([
      {
        id: 's1',
        sessionId: 'manual-2026-11-10-Push',
        ts: Date.parse('2026-11-10T12:00:00Z'),
        date: '2026-11-10',
        ref: 'name:Press horizontal en máquina',
        day: 'Push',
        sets: [
          { w: 80, r: 8, restSec: 110 },
          { w: 80, r: 8, restSec: 95, rir: 2 },
        ],
      },
    ]);

    const live = initLiveWorkout(state, 'Push');
    expect(live.exercises.length).toBeGreaterThan(1);
    const step1Html = viewWorkout({ ...state, liveWorkout: live });
    expect(step1Html).toContain('id="rest-timer-bar"');
    expect(step1Html).toContain('data-live-set="0|0"');
    expect(step1Html).toContain('data-live-rest="0|0"');
    expect(step1Html).toContain('Peso (kg)');
    expect(step1Html).toContain('Reps');
    expect(step1Html).toContain('data-act="liveToggleMenu"');
    expect(step1Html).not.toContain('role="tablist"');
    expect(step1Html).not.toContain('bg-cardDark');
    expect(step1Html).toContain('id="live-ex-menu-wrap" data-open="false"');
    expect(step1Html).toContain('grid-rows-[0fr]');
    expect(step1Html).toContain('data-act="liveAddSet"');
    expect(step1Html).toContain('data-act="liveOpenPicker" data-arg="swap"');
    expect(step1Html).toContain('data-act="liveOpenPicker" data-arg="add"');
    expect(step1Html).not.toContain('data-live-set="1|0"');

    const menuHtml = viewWorkout({
      ...state,
      liveWorkout: { ...live, exMenuOpen: true },
    });
    expect(menuHtml).toContain('id="live-ex-menu-wrap" data-open="true"');
    expect(menuHtml).toContain('grid-rows-[1fr]');
    expect(menuHtml).toContain('id="live-ex-menu"');
    expect(menuHtml).toContain('rounded-2xl');
    expect(menuHtml).toContain('data-act="liveGoEx" data-arg="1"');
    expect(menuHtml).toContain('Obj 2×10');
    expect(menuHtml).toContain('Últ. 80 kg × 8');

    const step2Html = viewWorkout({
      ...state,
      liveWorkout: { ...live, curIdx: 1, lastCompletedExIdx: 0 },
    });
    expect(step2Html).toContain('data-live-set="1|0"');
    expect(step2Html).not.toContain('data-live-set="0|0"');
    expect(step2Html).toContain('data-act="liveAddExtraSetPrev"');

    const swapHtml = viewWorkout({
      ...state,
      liveWorkout: { ...live, pickerMode: 'swap' },
    });
    expect(swapHtml).toContain('Cambiar &quot;');
    expect(swapHtml).toContain('id="livePickerSelect"');
    expect(swapHtml).toContain('id="livePickerCustom"');

    const libreLive = initLiveWorkout(state, 'Libre');
    const libreHtml = viewWorkout({ ...state, liveWorkout: libreLive });
    expect(libreHtml).toContain('Añadir ejercicio a este entreno');

    // Round-trip de restSec en initLogDraft y parseBackup
    const logDraft = initLogDraft(state, 'Push', '2026-11-10', 'manual-2026-11-10-Push');
    expect(logDraft.exercises[0].sets[0].restSec).toBe(110);
    expect(logDraft.exercises[0].sets[1].restSec).toBe(95);

    const parsed = parseBackup(
      JSON.stringify({
        version: 1,
        exportedAt: '2026-11-10T12:00:00Z',
        strength: [
          {
            id: 'r1',
            sessionId: 's1',
            ts: 1700000000000,
            date: '2026-11-10',
            ref: 'name:Press Banca',
            sets: [
              { w: 80, r: 8, restSec: 95, rir: 2 },
              { w: 80, r: 8, restSec: -5 },
            ],
          },
        ],
        cardio: [],
        measures: [],
        settings: DEFAULT_SETTINGS,
      }),
    );
    expect(parsed.strength[0].sets[0].restSec).toBe(95);
    expect(parsed.strength[0].sets[0].rir).toBe(2);
    expect(parsed.strength[0].sets[1].restSec).toBeUndefined();
  });

  it('incluye anclajes DOM de parcheo en viewWorkout, filtro parcial de catálogo y DEFAULT_SETTINGS sin fases personales', () => {
    expect(DEFAULT_SETTINGS.phases).toEqual([]);

    const state = makeState();
    const live = initLiveWorkout(state, 'Push');
    const html = viewWorkout({ ...state, liveWorkout: live });
    expect(html).toContain('id="liveCountSummary"');
    expect(html).toContain('id="liveFinishLabel"');
    expect(html).toContain('id="liveMenuSummary"');
    expect(html).toContain('data-live-ex-counter="0"');
    expect(html).toContain('data-live-set-lbl="0|0"');
    expect(html).toContain('data-live-menu-info="0"');
    expect(html).toContain('data-live-menu-count="0"');

    const byName = renderPlanCatalogResults({ ...state, planSearch: 'hack' });
    expect(byName.countText).toMatch(/^\d+\/\d+$/);
    expect(byName.listHtml).toContain('Sentadilla Hack');
    expect(byName.listHtml).not.toContain('Press Banca');

    const byMuscle = renderPlanCatalogResults({ ...state, planSearch: 'bíceps' });
    expect(byMuscle.listHtml).toContain('Bíceps');

    const noMatch = renderPlanCatalogResults({ ...state, planSearch: 'xyznomatch123' });
    expect(noMatch.countText.startsWith('0/')).toBe(true);
    expect(noMatch.listHtml).toContain('Sin resultados');
  });
});

describe('Bloque 2 tokens, contraste y accesibilidad', () => {
  it('usa tokens de superficie, colores semánticos correctos en métricas y role="option" en viewDay', () => {
    const today = todayIso();
    const settings = sanitizeSettings({});
    const strength = [
      {
        id: 's-b2',
        sessionId: 'sess-b2',
        ts: Date.now(),
        date: today,
        ref: 'name:Press horizontal en máquina',
        sets: [{ w: 60, r: 10 }],
        day: 'Push',
      },
    ];
    const state: State = {
      tab: 'home',
      strength,
      cardio: [],
      measures: [{ date: today, weight: 78, bf: 14.5 }],
      wellbeing: [{ date: today, rhr: 54 }],
      settings,
      analysis: analyze(strength, settings),
      sel: {},
      perimeter: 'arms',
      muscleSel: 'Pecho',
    };

    try {
      const homeHtml = viewHome(state);
      expect(homeHtml).toContain('% Grasa');
      expect(homeHtml).toContain('text-amberGold');
      expect(homeHtml).toContain('Pulso');
      expect(homeHtml).toContain('text-cyan-300');
      expect(homeHtml).not.toContain('text-coralRed');
      expect(homeHtml).not.toContain('#0D1320');
      expect(homeHtml).not.toContain('text-gray-500');

      const bodyHtml = viewBody(state);
      expect(bodyHtml).not.toContain('text-gray-500');

      const dayHtml = viewDay(state, 'Push');
      expect(dayHtml).toContain('role="listbox"');
      expect(dayHtml).toMatch(/role="option"[^>]*data-act="selEx"|data-act="selEx"[^>]*role="option"/);
      expect(dayHtml).not.toContain('bg-[#0D1320]');

      const live = initLiveWorkout(state, 'Push');
      const liveHtml = viewWorkout({ ...state, liveWorkout: { ...live, exMenuOpen: true } });
      expect(liveHtml).toContain('bg-floatDark');
      expect(liveHtml).not.toContain('bg-[#0E1525]');
      expect(liveHtml).not.toContain('text-gray-500');
      expect(liveHtml).not.toContain('placeholder-gray-500');

      const wizardHtml = renderWizardModal({
        ...state,
        wizard: createWizardDraft(state),
      });
      expect(wizardHtml).toContain('bg-modalDark');
      expect(wizardHtml).not.toContain('bg-[#0F1624]');
    } finally {
      resetCharts();
    }
  });
});

describe('Bloque 3 gráficas, shellView e iconos', () => {
  it('elimina iconos muertos, separa escalas en composición corporal y renderiza shellView', () => {
    expect('sparkle' in ICON_PATHS).toBe(false);
    expect('info' in ICON_PATHS).toBe(false);

    const onlyWeight = buildBodyHomeChartConfig([{ date: '2026-11-10', weight: 75 }]);
    expect(onlyWeight?.data.datasets.map((d) => d.label)).toEqual(['Tendencia 7d (kg)', 'Peso diario (kg)']);
    expect((onlyWeight?.options?.scales as Record<string, unknown>)?.y1).toBeUndefined();

    const ms = [{ date: '2026-11-10', weight: 75, muscle: 35 }];
    const weightMode = buildCompChartConfig(ms, 'weight');
    expect(weightMode?.data.datasets.map((d) => d.label)).toEqual(['Tendencia 7d (kg)', 'Peso diario (kg)']);
    expect((weightMode?.options?.scales as Record<string, unknown>)?.y1).toBeUndefined();

    const muscleMode = buildCompChartConfig(ms, 'muscle');
    expect(muscleMode?.data.datasets.map((d) => d.label)).toEqual(['Masa muscular (kg)']);
    expect((muscleMode?.options?.scales as Record<string, unknown>)?.y1).toBeUndefined();

    const settings = sanitizeSettings({});
    const state: State = {
      tab: 'body',
      strength: [],
      cardio: [],
      measures: [],
      wellbeing: [],
      settings,
      analysis: analyze([], settings),
      sel: {},
      perimeter: 'arms',
      muscleSel: 'Pecho',
    };
    expect(activeTabTitle(state)).toBe('Cuerpo');
    expect(syncStatusInfo(state, false, true).text).toBe('Solo local');
    expect(renderSidebar(state, 'sin datos', 0, 0, false)).toContain('bg-navDark');
    const mobHead = renderMobileHeader(state, 'sin datos', false);
    expect(mobHead).toContain('<h1');
    expect(mobHead).toContain('role="tablist"');
    expect(renderMobileNav(state, 0, 0, 'Push', 'body')).toContain('bg-navDark');
  });

  it('evita crash en viewCalc ante sets vacíos y aplica 16px / 44px en inputs de descanso', () => {
    const settings = sanitizeSettings({});
    const baseState: State = {
      tab: 'calc',
      strength: [{ id: 'bad', sessionId: 's-bad', ts: 1, date: '2026-11-16', ref: 'name:Press horizontal en máquina', sets: [], day: 'Push' }],
      cardio: [],
      measures: [],
      wellbeing: [],
      settings,
      analysis: analyze([{ id: 'bad', sessionId: 's-bad', ts: 1, date: '2026-11-16', ref: 'name:Press horizontal en máquina', sets: [], day: 'Push' }], settings),
      sel: {},
      perimeter: 'arms',
      muscleSel: 'Pecho',
    };
    expect(() => viewCalc(baseState)).not.toThrow();

    const liveHtml = viewWorkout({ ...baseState, tab: 'workout', liveWorkout: initLiveWorkout(baseState, 'Push') });
    expect(liveHtml).toMatch(/data-live-rest="0\|0"[^>]*>|text-base sm:text-xs[^"]*data-live-rest="0\|0"|min-h-\[44px\][^"]*text-base sm:text-xs[^"]*data-live-rest="0\|0"/);
    expect(liveHtml).toContain('min-h-[44px]');
    expect(liveHtml).not.toContain('min-h-[38px]');
    expect(liveHtml).not.toContain('h-11 w-10 sm:w-11');

    const logHtml = viewLog({ ...baseState, tab: 'log', logDraft: initLogDraft(baseState, 'Push', '2026-11-16') });
    expect(logHtml).toContain('text-base sm:text-xs font-semibold tabular-nums');
  });
});

describe('Bloque Usuario Final: Día 1, copy deportista y persistencia calc', () => {
  it('dirige el Día 1 a En vivo, muestra ejercicios planificados en Rutinas y abre selector si la rutina está vacía', () => {
    const settings = sanitizeSettings({
      routines: {
        ...DEFAULT_SETTINGS.routines,
        Vacía: [],
      },
      profile: { sex: 'hombre', age: 28, height: 178, goal: 'cut', daysPerWeek: 3 },
    });
    const emptyState: State = {
      tab: 'home',
      strength: [],
      cardio: [],
      measures: [],
      wellbeing: [],
      settings,
      analysis: analyze([], settings),
      sel: {},
      perimeter: 'arms',
      muscleSel: 'Pecho',
    };

    try {
      const homeHtml = viewHome(emptyState);
      expect(homeHtml).toContain('data-act="startWorkout">+ Empezar primer entreno hoy');
      expect(homeHtml).toContain('data-act="startWorkout" data-arg="Push"');

      const dayHtml = viewDay(emptyState, 'Push');
      expect(dayHtml).toContain('Press horizontal en máquina');
      expect(dayHtml).toContain('Pendiente de estrenar');
      expect(dayHtml).toContain('Sin estrenar');
      expect(dayHtml).not.toContain('No hay ejercicios con datos para esta rutina');

      const liveEmpty = initLiveWorkout(emptyState, 'Vacía');
      expect(liveEmpty.pickerMode).toBe('add');

      const settingsHtml = viewSettings(emptyState);
      expect(settingsHtml).not.toContain('VITE_RECAPTCHA_SITE_KEY');
      expect(settingsHtml).not.toContain('App Check');
      expect(settingsHtml).not.toContain('Firebase AI Logic');
      expect(settingsHtml).toContain('2 días');

      const calcHtml = viewCalc({ ...emptyState, tab: 'calc' });
      expect(calcHtml).toContain('value="1.55" selected');
      expect(calcHtml).toContain('value="-350" selected');
      expect(calcHtml).toContain('Estima el peso máximo que podrías mover a 1 repetición');

      const liveFirstTime = initLiveWorkout(emptyState, 'Push');
      const liveHtml = viewWorkout({ ...emptyState, tab: 'workout', liveWorkout: liveFirstTime });
      expect(liveHtml).toContain('Primera vez: empieza con un peso cómodo');
      expect(liveHtml).toContain('Desc. real');

      const summaryModalHtml = renderModals({
        ...emptyState,
        workoutSummary: {
          day: 'Push',
          durationMin: 42,
          exercises: 5,
          sets: 14,
          tonnageKg: 3250,
          prNames: ['Press horizontal en máquina'],
        },
      });
      expect(summaryModalHtml).toContain('id="workout-summary-modal"');
      expect(summaryModalHtml).toContain('¡Entreno completado!');
      expect(summaryModalHtml).toContain('Nuevas marcas personales (1)');

      expect(DEFAULT_MUSCLES.aductores?.p).toBe('Aductores');
      expect(DEFAULT_MUSCLES.adductores?.p).toBe('Aductores');

      const freeStrength = [
        {
          id: 'free-1',
          sessionId: 'manual-2026-11-10-libre',
          ts: Date.parse('2026-11-10T10:00:00Z'),
          date: '2026-11-10',
          ref: 'name:Ejercicio Libre Nuevo',
          sets: [{ w: 40, r: 10 }],
        },
      ];
      const freeState: State = {
        ...emptyState,
        strength: freeStrength,
        analysis: analyze(freeStrength, settings),
      };
      expect(buildHomeExChartConfig(freeState)).not.toBeNull();
    } finally {
      resetCharts();
    }
  });
});

describe('Fase 4 M1: accesibilidad WCAG, contraste y limpieza CSS !important', () => {
  it('asigna id="wizardNext" estable sin data-act en el botón submit del wizard', () => {
    const settings = sanitizeSettings({});
    const state: State = {
      tab: 'home',
      strength: [],
      cardio: [],
      measures: [],
      wellbeing: [],
      settings,
      analysis: analyze([], settings),
      sel: {},
      perimeter: 'arms',
      muscleSel: 'Pecho',
    };
    const wizardHtml = renderWizardModal({ ...state, wizard: createWizardDraft(state) });
    expect(wizardHtml).toMatch(/<button\s+id="wizardNext"\s+type="submit"\s+class="btn-primary min-h-\[44px\] px-5">/);
    expect(wizardHtml).not.toMatch(/id="wizardNext"[^>]*data-act=/);
  });

  it('mantiene jerarquía de encabezados h2/h3 continua en viewCalc, viewSettings y viewHome', () => {
    const settings = sanitizeSettings({
      ai: {
        date: '2026-11-15',
        tone: 'technical',
        summary: 'Resumen de progreso.',
        overview: {
          overallStatus: 'Progresando',
          highlights: ['Buena constancia'],
          sections: [{ title: 'Rendimiento de fuerza', verdict: 'good', text: 'Progresión estable.' }],
        },
        byExercise: {},
      },
    });
    const strength = [
      {
        id: 'm1-s1',
        sessionId: 'manual-2026-11-15-push',
        ts: Date.parse('2026-11-15T10:00:00Z'),
        date: '2026-11-15',
        ref: 'name:Press horizontal en máquina',
        day: 'Push',
        sets: [{ w: 70, r: 8 }],
      },
    ];
    const state: State = {
      tab: 'home',
      strength,
      cardio: [],
      measures: [{ date: '2026-11-15', weight: 76, bf: 15 }],
      wellbeing: [],
      settings,
      analysis: analyze(strength, settings),
      sel: {},
      perimeter: 'arms',
      muscleSel: 'Pecho',
    };

    try {
      const calcHtml = viewCalc(state);
      expect(calcHtml).toContain('<h2 class="font-bold text-white">Calculadora de fuerza máxima (1RM)</h2>');
      expect(calcHtml).toContain('<h2 class="font-bold text-white">Planificador nutricional');
      expect(calcHtml).not.toContain('<h3');

      const settingsOut = viewSettings(state);
      expect(settingsOut).toContain('<h2 class="font-bold text-white">Cuenta y sincronización</h2>');
      expect(settingsOut).toContain('<h2 class="font-bold text-white">Perfil del atleta</h2>');
      expect(settingsOut).toContain('<h2 class="font-bold text-white">Preferencias del Coach IA</h2>');
      expect(settingsOut).toContain('<h2 class="text-sm font-bold text-white">Accesos relacionados</h2>');
      expect(settingsOut).not.toContain('<h3');

      const homeWithAi = viewHome(state);
      expect(homeWithAi).toContain('<h2 class="text-base sm:text-lg font-extrabold text-white">Informe IA</h2>');
      expect(homeWithAi).toContain('<h2 class="text-base font-bold text-white">Evolución de cargas</h2>');
      expect(homeWithAi).toContain('<h2 class="text-base font-bold text-white">Peso y % de grasa</h2>');
      expect(homeWithAi).toContain('<h2 class="text-base font-bold text-white">Control de cargas del bloque</h2>');
      expect(homeWithAi).not.toContain('<h4');

      const homeNoAi = viewHome({
        ...state,
        settings: sanitizeSettings({}),
      });
      expect(homeNoAi).toContain('<h2 class="text-base font-extrabold text-white">Informe IA</h2>');
      expect(homeNoAi).not.toContain('<h3');
    } finally {
      resetCharts();
    }
  });

  it('vincula ai-tabpanel con aria-labelledby solo cuando hay múltiples pestañas y configura listbox en viewDay', () => {
    const settingsMulti = sanitizeSettings({
      ai: {
        date: '2026-11-15',
        tone: 'simple',
        summary: 'Bien.',
        overview: {
          overallStatus: 'En ruta',
          highlights: [],
          sections: [{ title: 'Fuerza', verdict: 'good', text: 'Sube 2,5 kg.' }],
        },
        byExercise: {},
      },
    });
    const base: State = {
      tab: 'home',
      strength: [],
      cardio: [],
      measures: [],
      wellbeing: [],
      settings: settingsMulti,
      analysis: analyze([], settingsMulti),
      sel: {},
      perimeter: 'arms',
      muscleSel: 'Pecho',
      aiTab: 1,
    };

    const multiHtml = renderAiReport(base);
    expect(multiHtml).toContain('id="ai-tab-1"');
    expect(multiHtml).toContain('aria-controls="ai-tabpanel"');
    expect(multiHtml).toContain('id="ai-tabpanel" role="tabpanel" aria-labelledby="ai-tab-1"');
    expect(multiHtml).toContain('<h3 class="text-base sm:text-lg font-bold text-emerald-300">Fuerza</h3>');

    const singleSettings = sanitizeSettings({
      ai: {
        date: '2026-11-15',
        tone: 'simple',
        summary: 'Solo resumen.',
        byExercise: {},
      },
    });
    const singleHtml = renderAiReport({ ...base, settings: singleSettings });
    expect(singleHtml).not.toContain('role="tabpanel"');
    expect(singleHtml).not.toContain('aria-labelledby="ai-tab-');

    try {
      const dayHtml = viewDay(base, 'Push');
      expect(dayHtml).toContain('role="listbox" aria-orientation="vertical"');
      expect(dayHtml).toContain('id="day-opt-0" role="option" tabindex="0" data-act="selEx"');
      expect(dayHtml).toContain('id="day-opt-1" role="option" tabindex="-1" data-act="selEx"');
    } finally {
      resetCharts();
    }
  });

  it('mejora contraste de quitar serie en vivo y elimina modificadores ! de .btn/.inp/.tab', () => {
    const settings = sanitizeSettings({});
    const state: State = {
      tab: 'workout',
      strength: [],
      cardio: [],
      measures: [{ date: '2026-11-15', weight: 75 }],
      wellbeing: [],
      settings,
      analysis: analyze([], settings),
      sel: {},
      perimeter: 'arms',
      muscleSel: 'Pecho',
      ranges: { home: 'Custom' },
    };

    try {
      const live = initLiveWorkout(state, 'Push');
      const liveHtml = viewWorkout({ ...state, liveWorkout: live });
      expect(liveHtml).toContain('text-rose-300 hover:text-rose-200');
      expect(liveHtml).not.toContain('text-coralRed/90');
      expect(liveHtml).toContain('inp-stepper border-white/15 bg-transparent text-base');
      expect(liveHtml).not.toMatch(/class="[^"]*\b(?:btn|btn-primary|inp|inp-stepper|tab)\b[^"]*!/);
      expect(liveHtml.match(/![a-zA-Z0-9-[\]]+/g)).toEqual(['!mt-0']);

      const logHtml = viewLog({ ...state, tab: 'log', logDraft: initLogDraft(state, 'Push', '2026-11-15') });
      expect(logHtml).toContain('inp-stepper min-w-[44px]');
      expect(logHtml).toContain('btn btn-accent');
      expect(logHtml).not.toMatch(/class="[^"]*\b(?:btn|btn-primary|inp|inp-stepper|tab)\b[^"]*!/);

      const planHtml = viewPlan({ ...state, tab: 'plan', planTab: 'routines' });
      const planExHtml = viewPlan({ ...state, tab: 'plan', planTab: 'exercises' });
      const bodyHtml = viewBody({ ...state, tab: 'body' });
      const pickerHtml = rangePicker('home', 'Custom', {});
      for (const html of [planHtml, planExHtml, bodyHtml, pickerHtml]) {
        expect(html).not.toMatch(/class="[^"]*\b(?:btn|btn-primary|inp|inp-stepper|tab)\b[^"]*!/);
      }
    } finally {
      resetCharts();
    }
  });
});
