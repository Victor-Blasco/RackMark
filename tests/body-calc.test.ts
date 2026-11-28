import { h } from 'preact';
import renderToString from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import type { ChartConfiguration } from 'chart.js';
import { buildPayload, buildPrompt } from '../src/lib/ai';
import {
  analyze,
  effectiveMuscleCredits,
  findAnalyzedExercise,
  isoWeekStart,
  judge,
} from '../src/lib/analysis';
import { parseBackup, sanitizeSettings } from '../src/lib/db';
import {
  ACTIVITY_OPTIONS,
  NUTRITION_PHASES,
  calculateNutrition,
  recommendActivityFactor,
} from '../src/lib/nutrition';
import {
  DEFAULT_SETTINGS,
  daysAgoIso,
  diffIsoDays,
  parseDecimal,
} from '../src/lib/seed';
import { ModalHost } from '../src/components/modals/ModalHost';
import { buildAdherenceViewModel } from '../src/store/adherenceSelectors';
import { buildCompChartConfig } from '../src/store/bodyChartConfigs';
import { buildCalcViewModel } from '../src/store/calcSelectors';
import { buildBodyViewModel } from '../src/store/bodySelectors';
import { buildBodyHomeChartConfig, exerciseChartConfig, filterExByRange } from '../src/store/homeChartConfigs';
import { buildDayRoutineViewModel } from '../src/store/daySelectors';
import { buildHomeViewModel } from '../src/store/homeSelectors';
import { createLogHistoryActions } from '../src/store/logHistoryActions';
import { initLogDraft } from '../src/store/logSelectors';
import { createProfileActions } from '../src/store/profileActions';
import { buildWorkoutSummary } from '../src/store/sessionPersistence';
import { buildVolumeViewModel, weeksForBounds } from '../src/store/volumeSelectors';
import { createWizardDraft, daysActivityFactor } from '../src/store/wizardSelectors';
import { normalizeChartConfig } from '../src/ui/charts';
import {
  inRange,
  movingAverage7d,
  movingAverage7dFor,
  resolveRange,
  todayIso,
  weightDeltaColor,
  type State,
} from '../src/ui/shared';
import { AdherenceView } from '../src/views/AdherenceView';
import { BodyView } from '../src/views/BodyView';
import { CalcView } from '../src/views/CalcView';
import { DataView } from '../src/views/DataView';
import { DayRoutineView } from '../src/views/DayRoutineView';
import { HomeView } from '../src/views/HomeView';
import { LogWorkoutView } from '../src/views/LogWorkoutView';
import { PlanView } from '../src/views/PlanView';
import { SettingsView } from '../src/views/SettingsView';
import { VolumeView } from '../src/views/VolumeView';

describe('ai tone & chart axis offset', () => {
  it('adapta el prompt de IA según el tono simple o técnico manteniendo la estructura JSON', () => {
    const samplePayload = { fase: 'Definición' };
    const simplePrompt = buildPrompt(samplePayload, 'simple');
    const techPrompt = buildPrompt(samplePayload, 'technical');

    expect(simplePrompt).toContain('"summary"');
    expect(simplePrompt).toContain('"byExercise"');
    expect(simplePrompt).toContain('Peso y forma física');
    expect(simplePrompt).toContain('sin jerga ni siglas técnicas');
    expect(simplePrompt).not.toContain('Fatiga Sistémica');

    expect(techPrompt).toContain('"summary"');
    expect(techPrompt).toContain('"byExercise"');
    expect(techPrompt).toContain('Composición Corporal y Balance Energético');
    expect(techPrompt).toContain('Fatiga Sistémica');
  });

  it('calcula volumen semanal con DEFAULT_MUSCLES, restSec y resumen_composicion en buildPayload', () => {
    const settings = structuredClone(DEFAULT_SETTINGS);
    settings.muscles = {};
    const dPrev = todayIso(new Date(Date.now() - 14 * 864e5));
    const dCur = todayIso(new Date(Date.now() - 1 * 864e5));
    const analysis = analyze(
      [
        {
          id: 's-1',
          sessionId: 'sess-1',
          ts: Date.now(),
          date: dCur,
          ref: 'name:Press de banca',
          sets: [{ w: 80, r: 8, rir: 2, restSec: 120 }, { w: 80, r: 8, restSec: 120 }],
          day: 'Push',
        },
      ],
      settings,
    );
    const payload = buildPayload(
      analysis,
      [
        { date: dPrev, weight: 80, waist: 86 },
        { date: dCur, weight: 79, waist: 85 },
      ],
      settings,
    );

    expect(payload.volumen_semanal?.series_efectivas_semana.Pecho).toBeGreaterThan(0);
    const bench = (payload.ejercicios as Record<string, { musculo?: string; sesiones: { series: string[] }[] }>)['Press de banca'];
    expect(bench.musculo).toBe('Pecho');
    expect(bench.sesiones[0].series[0]).toContain('· 120s');
    expect(payload.resumen_composicion).toMatchObject({
      peso_media_7d_kg: 79,
      cambio_cintura_cm: -1,
      cintura_previa_fecha: dPrev,
    });
    expect(payload.resumen_composicion.ritmo_semanal_kg).toBeCloseTo(-0.54, 1);
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
    const denseX = (dense.options!.scales as Record<string, Record<string, unknown>>).x.ticks as Record<string, unknown>;
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
    const multiLegend = (multi.options!.plugins as Record<string, Record<string, unknown>>).legend;
    const multiLabels = multiLegend.labels as Record<string, unknown>;
    expect(multiDs.pointRadius).toBe(2.5);
    expect(multiLegend.display).toBe(true);
    expect(multiLabels.usePointStyle).toBe(true);
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

    const volHtml = renderToString(h(VolumeView, { state: emptyState }));
    expect(volHtml).toContain('+ Registrar entreno');
    expect(volHtml).toContain('Importar datos');
    expect(volHtml).not.toContain('<canvas');
    expect(volHtml).not.toContain('min-w-[640px]');

    const adhHtml = renderToString(h(AdherenceView, { state: emptyState }));
    expect(adhHtml).toContain('+ Registrar entreno');
    expect(adhHtml).not.toContain('<canvas');
    expect(adhHtml).not.toContain('Calendario (últimas');

    const homeHtml = renderToString(h(HomeView, { state: emptyState }));
    expect(homeHtml).toContain('+ Empezar entreno en vivo');
    expect(homeHtml).not.toContain('<canvas');
    expect(homeHtml).not.toContain('ai-report');

    const calcHtml = renderToString(h(CalcView, { state: emptyState }));
    expect(calcHtml).toContain('Valores de ejemplo');

    const bodyHtml = renderToString(h(BodyView, { state: emptyState }));
    expect(bodyHtml).toContain('Filtro temporal');
  });
});

describe('calculadora nutricional', () => {
  it('calcula TMB, TDEE, objetivos, macros y reparto por comidas', () => {
    const result = calculateNutrition(70, 15, 1.65, 225, 2.2, 1, 4);
    expect(result.bmr).toBeGreaterThan(1000);
    expect(result.target).toBe(result.tdee + 225);
    expect(result.proteinG).toBe(154);
    expect(result.fatG).toBe(70);
    expect(result.perMeal.proteinG).toBe(39);
    expect(result.perMeal.fatG).toBe(18);
    expect(result.proteinPct + result.fatPct + result.carbsPct).toBe(100);
  });

  it('incluye recomposición y guarda rangos seguros de actividad', () => {
    expect(NUTRITION_PHASES.find((phase) => phase.id === 'recomp')?.delta).toBe(-150);
    expect(ACTIVITY_OPTIONS.map((option) => option.factor)).toEqual([1.55, 1.65, 1.75]);
    expect(calculateNutrition(70, 15, 99, -500, 2.4, 1.2, 5).target).toBeGreaterThan(0);
  });

  it('recomienda actividad según fuerza reciente y pasos', () => {
    expect(recommendActivityFactor(2, 7000)).toBe(1.55);
    expect(recommendActivityFactor(4, 7000)).toBe(1.65);
    expect(recommendActivityFactor(6, 7000)).toBe(1.75);
    expect(recommendActivityFactor(2, 12000)).toBe(1.65);
  });

  it('renderiza radiogroups nutricionales y el hero de calorías', () => {
    const settings = sanitizeSettings({
      profile: { sex: 'hombre', age: 25, height: 170, goal: 'bulk', daysPerWeek: 5 },
    });
    const state = {
      tab: 'calc',
      strength: [],
      cardio: [],
      measures: [{ date: '2026-11-15', weight: 70, bf: 15 }],
      wellbeing: [],
      settings,
      analysis: analyze([], settings),
      sel: {},
      perimeter: 'waist',
      muscleSel: 'Pecho',
    } as State;
    const html = renderToString(h(CalcView, { state }));
    expect(html).toContain('aria-label="Factor de actividad"');
    expect(html).toContain('aria-label="Fase energética"');
    expect(html).toContain('aria-label="Número de comidas"');
    expect(html).toContain('id="nuMeals"');
    expect(html).toContain('role="radio"');
    expect(html).toContain('whitespace-nowrap');
    expect(html).toContain('items-stretch gap-3');
    expect(html).toContain('flex h-full flex-col');
    expect(html).toContain('lbl leading-4');
  });
});

describe('cuerpo, calculadoras, adherencia y analítica', () => {
  it('soporta ejercicios de peso corporal (0 kg) en judge, summary y gráficas, y evita alertas falsas al lastrar', () => {
    const bwSessions = [
      { date: '2026-11-01', sets: [{ w: 0, r: 10 }], top: 0, repsAtTop: 10, volume: 0, e1rm: 0 },
      { date: '2026-11-08', sets: [{ w: 0, r: 12 }], top: 0, repsAtTop: 12, volume: 0, e1rm: 0 },
    ];
    const bwVerdict = judge(bwSessions, { name: 'Dominadas', sets: 3, reps: 15 });
    expect(bwVerdict.status).toBe('Récord personal (reps)');
    expect(bwVerdict.prescription).not.toContain('0 kg');

    const bwHit = judge(bwSessions, { name: 'Dominadas', sets: 1, reps: 12 });
    expect(bwHit.status).toBe('Añadir lastre o reps');

    const weightedTransition = judge([
      ...bwSessions,
      { date: '2026-11-15', sets: [{ w: 10, r: 8 }], top: 10, repsAtTop: 8, volume: 80, e1rm: 12.7 },
    ], { name: 'Dominadas', sets: 3, reps: 10 });
    expect(weightedTransition.status).toBe('Progresando (+10 kg)');

    const bwChart = exerciseChartConfig(bwSessions, '#10B981');
    expect(bwChart.data.datasets[0].label).toBe('Reps máx');
    expect(bwChart.data.datasets[0].data).toEqual([10, 12]);
    expect(bwChart.data.datasets[1].label).toBe('Reps totales');

    const settings = sanitizeSettings({ routines: { Pull: [{ name: 'Dominadas', sets: 2, reps: 12 }] } });
    const rows = [{
      id: 'bw-1', sessionId: 's1', ts: 1000, date: '2026-11-01', ref: 'name:Dominadas', day: 'Pull',
      sets: [{ w: 0, r: 10, done: true }],
    }];
    const state: State = {
      tab: 'workout', strength: rows, cardio: [], measures: [], wellbeing: [],
      settings, analysis: analyze(rows, settings), sel: {}, perimeter: 'arms', muscleSel: 'Espalda',
    };
    const summary = buildWorkoutSummary(state, {
      date: '2026-11-08', day: 'Pull', startedAt: Date.now() - 600000, curIdx: 0, targetRestSec: 90,
      exercises: [{ name: 'Dominadas', done: true, note: '', sets: [{ w: 0, r: 13, done: true }] }],
    }, 1);
    expect(summary.prNames).toContain('Dominadas');
  });

  it('corrige 1RM (RIR 0, comas, presets), nutrición (suelo 1000 kcal), daysActivityFactor y override de perfil', async () => {
    const settings = sanitizeSettings({
      routines: { Push: [{ name: 'Press banca', sets: 3, reps: 10 }], EmpujeB: [{ name: 'press banca', sets: 3, reps: 8 }] },
      profile: { sex: 'hombre', age: 28, height: 176, goal: 'bulk', daysPerWeek: 4 },
    });
    const strength = [
      { id: 'r1', sessionId: 's1', ts: 1000, date: '2026-11-15', ref: 'name:Press banca', day: 'Push', sets: [{ w: 100, r: 1, done: true }] },
      { id: 'r2', sessionId: 's2', ts: 2000, date: '2026-11-16', ref: 'name:press banca', day: 'EmpujeB', sets: [{ w: 100, r: 1, done: true }] },
    ];
    const analysis = analyze(strength, settings);
    // Canonicaliza mayúsculas bajo 'Press banca'
    expect([...analysis.exercises.keys()]).toEqual(['Press banca']);

    const state: State = {
      tab: 'calc', strength, cardio: [], measures: [{ date: '2026-11-15', weight: 70, bf: 15 }], wellbeing: [],
      settings, analysis, sel: {}, perimeter: 'arms', muscleSel: 'Pecho',
      calcDraft: { w: '72,5', r: '1', rir: '0', goal: '0', act: '1.55' },
    };
    const vm = buildCalcViewModel(state);
    expect(vm.presets.filter((p) => p.n.toLowerCase() === 'press banca')).toHaveLength(1);
    expect(vm.oneRm).toBeCloseTo(72.5, 5);
    expect(vm.oneRmRir).toBeCloseTo(72.5, 5);
    expect(daysActivityFactor(4)).toBe('1.65');

    // Proyección semanal respeta suelo 1000 kcal
    const lowCal = calculateNutrition(45, 25, 1.55, -2000);
    expect(lowCal.target).toBe(1000);
    expect(lowCal.weeklyProjectionKg).toBeGreaterThan(-((lowCal.tdee - 1000) / 7700 * 7) - 0.01);

    // profileActions limpia override goal/act de calcDraft
    const profileActions = createProfileActions({ getState: () => state, persist: async () => {}, render: () => {}, toast: () => {} });
    await profileActions.updateProfileGoal('cut');
    await profileActions.updateProfileDays('5');
    expect(state.calcDraft?.goal).toBeUndefined();
    expect(state.calcDraft?.act).toBeUndefined();
  });

  it('calcula media móvil 7d sin perder 6 días previos, amplía 1A/Todo y racha completa en Adherencia', () => {
    const today = todayIso();
    const daysAgo = (n: number) => todayIso(new Date(Date.now() - n * 864e5));
    const measures = [
      { date: daysAgo(35), weight: 80 },
      { date: daysAgo(33), weight: 78 },
      { date: daysAgo(29), weight: 78 },
    ];
    const visible = measures.slice(1);
    const avgs = movingAverage7dFor(visible, measures);
    // El día -33 debe incluir también el registro -35 (dentro de 6 días): (80+78)/2 = 79
    expect(avgs[0]).toBe(79);
    const bodyHomeCfg = buildBodyHomeChartConfig(visible, measures)!;
    expect(bodyHomeCfg.data.datasets[0].data[0]).toBe(79);
    const compCfg = buildCompChartConfig(visible, 'weight', measures)!;
    expect(compCfg.data.datasets[0].data[0]).toBe(79);

    const wYear = weeksForBounds({ key: '1A', from: daysAgo(365), to: null, label: '1A', days: 365 }, [daysAgo(365)], 12, 4, 104);
    expect(wYear.length).toBeGreaterThan(26);

    // Racha de 6 semanas en historial aunque el filtro activo sea 1M (4 semanas)
    const settings = sanitizeSettings({});
    const curWkMs = Date.parse(`${isoWeekStart(today)}T00:00:00Z`);
    const streakRows = [];
    for (let w = 1; w <= 6; w++) {
      for (let d = 0; d < 3; d++) {
        const dt = new Date(curWkMs - w * 7 * 864e5 + d * 864e5).toISOString().slice(0, 10);
        streakRows.push({
          id: `st-${w}-${d}`, sessionId: `sess-${w}-${d}`, ts: Date.parse(`${dt}T10:00:00Z`),
          date: dt, ref: 'name:Press de banca', day: 'Push', sets: [{ w: 80, r: 8, done: true }],
        });
      }
    }
    const adhVm = buildAdherenceViewModel({
      tab: 'adherence', strength: streakRows, cardio: [], wellbeing: [], measures: [],
      settings, analysis: analyze(streakRows, settings), sel: {}, perimeter: 'arms', muscleSel: 'Pecho',
      ranges: { adherence: '1M' },
    });
    expect(adhVm.streak).toBe(6);

    const homeVm = buildHomeViewModel({
      tab: 'home', strength: streakRows, cardio: [],
      wellbeing: [{ date: today, steps: 9500 }], measures: [],
      settings, analysis: analyze(streakRows, settings), sel: {}, perimeter: 'arms', muscleSel: 'Pecho',
      ranges: { home: 'Todo' },
    });
    expect(homeVm.fourthMetric.lbl).toBe('Sueño / Pasos (7d)');

    // filterExByRange recalcula el veredicto del rango
    const ex = analyze(streakRows, settings).exercises.get('Press de banca')!;
    const filteredEx = filterExByRange(ex, { key: 'Custom', from: daysAgo(1), to: daysAgo(1), label: 'Custom' });
    expect(filteredEx.status).toBe('Sin datos');
  });

  it('mejoras UX: historial de cuerpo móvil/grupos, volumen sin corte móvil, adherencia sesiones recientes y alta simplificada', async () => {
    const settings = sanitizeSettings(DEFAULT_SETTINGS);
    const today = todayIso();
    const strength = [
      { id: 's1', ts: 1, date: today, ref: 'name:Press de banca', day: 'Push' as const, sets: [{ w: 80, r: 8 }, { w: 80, r: 8 }], sessionId: `manual-${today}-Push`, durMin: 45, avgHr: 124, kcal: 320 },
      { id: 's2', ts: 2, date: today, ref: 'name:Dominadas', day: 'Pull' as const, sets: [{ w: 10, r: 8 }], sessionId: `manual-${today}-Pull` },
    ];
    const measures = [
      { date: today, weight: 75.5, bf: 14.5, muscle: 35.6, waist: 80.1, torso: 103, armL: 36.5, armR: 36.8, thighL: 57.5, thighR: 57.8 },
    ];
    const cardio = [
      { id: 'c1', ts: 3, date: today, type: 1, durMin: 30, distKm: 4.5, avgHr: 142, kcal: 310, vo2: 47.2 },
    ];
    const base: State = {
      tab: 'body',
      strength,
      cardio,
      measures,
      wellbeing: [],
      settings,
      analysis: analyze(strength, settings),
      sel: {},
      ranges: { volume: '6M', adherence: '3M' },
      perimeter: 'arms',
      muscleSel: 'Pecho',
    };

    // 1. Cuerpo: lista móvil con acordeón de perímetros completos + pestañas en escritorio sin table-fixed
    const bodyHtml = renderToString(h(BodyView, { state: base }));
    expect(bodyHtml).toContain('Ver perímetros (5)');
    expect(bodyHtml).toContain('Brazo izq.');
    expect(bodyHtml).toContain('Muslo der.');
    expect(bodyHtml).toContain('grid-rows-[0fr]');
    expect(bodyHtml).toContain('role="radiogroup" aria-label="Columnas del historial de mediciones"');
    expect(bodyHtml).toContain('Tren superior');
    expect(bodyHtml).toContain('Tren inferior');
    expect(bodyHtml).toContain('relative hidden md:block overflow-x-auto');
    expect(bodyHtml).not.toContain('table-fixed');

    // 2. Volumen: rango 6M renderiza todas las semanas (~26) sin recorte móvil y con columna Músculo fija
    const volHtml = renderToString(h(VolumeView, { state: { ...base, tab: 'volume' } }));
    const thCount = (volHtml.match(/<th scope="col"/g) ?? []).length;
    expect(thCount).toBeGreaterThan(20);
    expect(volHtml).toContain('sticky left-0 z-10 bg-bgDark');
    expect(volHtml).toContain('relative overflow-x-auto');
    expect(volHtml).not.toContain('hidden md:block');

    // 3. Adherencia: Sesiones recientes combinando rutinas y cardio con chips de filtro y apertura hacia Registrar hecho
    const adhHtml = renderToString(h(AdherenceView, { state: { ...base, tab: 'adherence' } }));
    expect(adhHtml).toContain('Sesiones recientes (3)');
    expect(adhHtml).toContain('aria-label="Filtrar sesiones recientes"');
    expect(adhHtml).toContain('1 ej. · 2 series');
    expect(adhHtml).toContain('30 min · 4,5 km');
    expect(adhHtml).toContain('Abrir sesión Push del');

    let switchedTab = 'adherence';
    let committed: State['logDraft'] | undefined;
    const histActions = createLogHistoryActions(
      {
        getState: () => ({ ...base, tab: switchedTab }),
        commitDraft: (d) => { committed = d; },
        reload: async () => {},
        setTab: (t) => { switchedTab = t; },
        queueSync: () => {},
        toast: () => {},
        askConfirm: async () => true,
      },
      () => initLogDraft(base, 'Push', today),
      async () => true,
    );
    await histActions.editHistorySession(`manual-${today}-Push`, today, 'Push');
    expect(switchedTab).toBe('log');
    expect(committed?.day).toBe('Push');

    // 4. Registrar hecho: bloque simplificado + diseño compacto Opción C
    const draftBase = initLogDraft(base, 'Push', today);
    const enrichedDraft = {
      ...draftBase,
      exercises: draftBase.exercises.map((e, idx) =>
        idx === 0
          ? {
              ...e,
              note: 'Buen control excéntrico',
              sets: e.sets.map((s) => ({ ...s, rir: 2, restSec: 90 })),
            }
          : e,
      ),
    };
    const logHtml = renderToString(
      h(LogWorkoutView, { state: { ...base, tab: 'log', logDraft: enrichedDraft } }),
    );
    expect(logHtml).toContain('+ Añadir ejercicio (');
    expect(logHtml).not.toContain('+ Añadir rápido');
    expect(logHtml).not.toContain('+ Crear ejercicio nuevo');
    expect(logHtml).toContain('flex items-center gap-1.5 overflow-x-auto no-scrollbar');
    // LogSessionHeader aligerada en móvil pero Guardar siempre visible
    expect(logHtml).toContain('btn btn-accent hidden lg:inline-flex');
    expect(logHtml).toContain('Guardar (');
    // LogExerciseHeader con flechas ^/v inline + menú contextual ⋯
    expect(logHtml).toContain('aria-haspopup="menu" aria-expanded="false" aria-label="Opciones de');
    expect(logHtml).toContain('aria-label="Subir ');
    expect(logHtml).toContain('aria-label="Bajar ');
    expect(logHtml).toContain('data-sort-key="');
    // Cabecera compartida única y labels individuales en sr-only
    expect(logHtml).toContain('class="sr-only">Peso (kg)');
    expect(logHtml).toContain('RIR · Desc. · 2');
    // Primer ejercicio con nota -> grid-rows-[1fr]; ejercicios sin nota -> grid-rows-[0fr]
    expect(logHtml).toContain('transition-[grid-template-rows,opacity]');
    expect(logHtml).toContain('grid-rows-[1fr]');
    expect(logHtml).toContain('grid-rows-[0fr]');
  });

  it('HomeView unifica el selector de ejercicio en un único botón con modal homeExercisePicker', () => {
    const settings = sanitizeSettings(DEFAULT_SETTINGS);
    const strength = [
      { id: 'h1', sessionId: 'sh1', ts: 1, date: todayIso(), ref: 'name:Press de banca', day: 'Push' as const, sets: [{ w: 80, r: 8 }] },
      { id: 'h2', sessionId: 'sh2', ts: 2, date: todayIso(), ref: 'name:Dominadas', day: 'Pull' as const, sets: [{ w: 10, r: 8 }] },
    ];
    const state: State = {
      tab: 'home',
      strength,
      cardio: [],
      measures: [],
      wellbeing: [],
      settings,
      analysis: analyze(strength, settings),
      sel: { home: 'Press de banca' },
      perimeter: 'arms',
      muscleSel: 'Pecho',
    };

    const homeHtml = renderToString(h(HomeView, { state }));
    expect(homeHtml).toContain('Seleccionar ejercicio para gráfica: Press de banca');
    expect(homeHtml).not.toContain('<select');
    expect(homeHtml).not.toContain('Buscar ejercicio para gráfica');

    const modalHtml = renderToString(
      h(ModalHost, { state: { ...state, activeModal: { type: 'homeExercisePicker' } } }),
    );
    expect(modalHtml).toContain('Elegir ejercicio para gráfica');
    expect(modalHtml).toContain('Actual');
    expect(modalHtml).toContain('Elegir');
    expect(modalHtml).not.toContain('+ Crear ejercicio');
  });

  it('mantiene onboarding con medidas sin entrenos, muestra IA en 1M, adapta racha, Cuerpo, Volumen y sincroniza fases', async () => {
    const today = todayIso();
    const settings = sanitizeSettings({
      aiTone: 'simple',
      profile: { sex: 'hombre', age: 30, height: 175, goal: 'bulk', daysPerWeek: 2, experience: 'beginner' },
      ai: {
        date: today,
        tone: 'simple',
        summary: 'Buen progreso',
        overview: { overallStatus: 'Bien', highlights: [], sections: [] },
        byExercise: {
          'Press de banca': {
            status: 'Listo para subir',
            prescription: 'Sube a 82,5 kg',
            biomech: 'Retracción escapular',
          },
        },
      },
    });

    // 1. Con medidas iniciales pero 0 entrenos sigue en OnboardingHome
    const onboardingWithWeight: State = {
      tab: 'home',
      strength: [],
      cardio: [],
      measures: [{ date: today, weight: 75 }],
      wellbeing: [],
      settings,
      analysis: analyze([], settings),
      sel: {},
      perimeter: 'arms',
      muscleSel: 'Pecho',
    };
    expect(buildHomeViewModel(onboardingWithWeight).isOnboarding).toBe(true);

    // 2. Con sesiones y filtro por defecto 1M mantiene consejos IA visibles en Home y Rutinas
    const strength = [
      { id: 's1', sessionId: 'sess-1', ts: Date.now() - 864e5, date: today, ref: 'name:Press de banca', day: 'Push' as const, sets: [{ w: 80, r: 8, done: true }] },
    ];
    const activeState: State = {
      ...onboardingWithWeight,
      strength,
      analysis: analyze(strength, settings),
    };
    const homeVm = buildHomeViewModel(activeState);
    expect(homeVm.hasFilter).toBe(true);
    expect(homeVm.rows.find((r) => r.e.name === 'Press de banca')?.aiStatus).toBe('Listo para subir');
    const dayVm = buildDayRoutineViewModel(activeState, 'Push');
    expect(dayVm.hasFilter).toBe(true);
    expect(dayVm.aiFor(dayVm.primary[0])?.prescription).toBe('Sube a 82,5 kg');

    // 3. Adherencia usa daysPerWeek del perfil (2 días/semana -> racha >= 2)
    const curWkMs = Date.parse(`${isoWeekStart(today)}T00:00:00Z`);
    const twoDayRows = [1, 2, 3].flatMap((w) =>
      [0, 2].map((d, i) => {
        const dt = new Date(curWkMs - w * 7 * 864e5 + d * 864e5).toISOString().slice(0, 10);
        return { id: `td-${w}-${i}`, sessionId: `tds-${w}-${i}`, ts: Date.parse(`${dt}T10:00:00Z`), date: dt, ref: 'name:Press de banca', day: 'Push' as const, sets: [{ w: 70, r: 8, done: true }] };
      }),
    );
    const adhVm = buildAdherenceViewModel({ ...activeState, strength: twoDayRows, analysis: analyze(twoDayRows, settings) });
    expect(adhVm.targetDays).toBe(2);
    expect(adhVm.streak).toBe(3);

    // 4. Cuerpo colapsa MeasureForm si hay registros previos y lo sitúa antes de gráficas; Volumen etiqueta En curso; Plan ligero usa 6-16
    expect(buildBodyViewModel(activeState).hasAnyPerim).toBe(false);
    const bodyHtml = renderToString(h(BodyView, { state: activeState }));
    expect(bodyHtml.indexOf('+ Registrar peso / medidas de hoy')).toBeLessThan(bodyHtml.indexOf('Composición corporal'));
    expect(bodyHtml).not.toContain('Medidas con cinta (cm)');

    const volHtml = renderToString(h(VolumeView, { state: activeState }));
    expect(volHtml).toContain('En curso');
    expect(buildVolumeViewModel(activeState).summaryText).toContain('Esta semana (en curso)');
    expect(buildVolumeViewModel({ ...activeState, strength: twoDayRows, analysis: analyze(twoDayRows, settings) }).summaryText).toContain('Última semana completa');

    const planHtml = renderToString(h(PlanView, { state: { ...activeState, tab: 'plan', planTab: 'routines' } }));
    expect(planHtml).toContain('(plan ligero)');
    expect(planHtml).toContain('6–16');

    // 5. Sincronizar objetivo del perfil con Fases + textos limpios
    const syncState: State = { ...activeState, settings: sanitizeSettings({ profile: { goal: 'bulk' } }) };
    const profileActions = createProfileActions({
      getState: () => syncState,
      persist: async () => {},
      render: () => {},
      toast: () => {},
    });
    await profileActions.updateProfileGoal('cut');
    expect(syncState.settings.phases.some((p) => p.name === 'Definición' && p.start === today)).toBe(true);

    const settingsHtml = renderToString(h(SettingsView, { state: activeState }));
    expect(settingsHtml).not.toContain('Reloj GPS Polar');
    expect(createWizardDraft(onboardingWithWeight).aiTone).toBe('simple');
    expect(
      createWizardDraft({
        ...onboardingWithWeight,
        settings: sanitizeSettings({}),
      }).aiTone,
    ).toBe('simple');
    expect(renderToString(h(HomeView, { state: { ...activeState, settings: { ...settings, ai: undefined } } }))).toContain(
      'Inicia sesión para generar análisis IA',
    );
  });

  it('Bloques A, B y C: simulador temporal en Calculadoras, referencias limpias en Cuerpo, CSV/Unificar y textos claros', () => {
    const today = todayIso();
    const settings = sanitizeSettings({
      routines: { Push: [{ name: 'Press de banca', sets: 3, reps: 8 }] },
    });
    const base: State = {
      tab: 'calc',
      strength: [{ id: 's1', sessionId: 'sess-abc', ts: Date.now(), date: today, ref: 'name:Press de banca', day: 'Push', sets: [{ w: 80, r: 8, done: true }], note: 'Hombro OK' }],
      cardio: [{ id: 'c1', ts: Date.now(), date: today, type: 1001, distKm: 4, durMin: 25, avgHr: 140, kcal: 210, vo2: 47 }],
      wellbeing: [{ date: today, sleepMin: 450, hrv: 65, steps: 8000 }],
      measures: [{ date: today, weight: 78, bf: 16 }],
      settings,
      analysis: analyze([], settings),
      sel: {},
      perimeter: 'arms',
      muscleSel: 'Pecho',
    };
    base.analysis = analyze(base.strength, settings);

    // A1: simulación temporal en Calc sin modificar measures
    const simState: State = { ...base, calcDraft: { bodyW: '72,5', bodyBf: '12' } };
    const calcVm = buildCalcViewModel(simState);
    expect(calcVm.w).toBe(72.5);
    expect(calcVm.bf).toBe(12);
    expect(calcVm.hasBodyOverride).toBe(true);
    const calcHtml = renderToString(h(CalcView, { state: simState }));
    expect(calcHtml).toContain('Peso simulación (kg)');
    expect(calcHtml).toContain('% Grasa simulación');
    expect(calcHtml).toContain('Usar mi última medida');

    const calcActions = createProfileActions({ getState: () => simState, persist: async () => {}, render: () => {}, toast: () => {} });
    calcActions.resetCalcBody();
    expect(simState.calcDraft?.bodyW).toBeUndefined();
    expect(buildCalcViewModel(simState).w).toBe(78);

    // A2: placeholder '—' y lastLabel fuera + guía de perímetros en Cuerpo (abierto al editar y colapsado por defecto con registros)
    const bodyVm = buildBodyViewModel(base);
    expect(bodyVm.getFieldInputMeta('weight')).toEqual({ value: '78', placeholder: '—', lastLabel: 'Últ: 78' });
    const bodyClosedHtml = renderToString(h(BodyView, { state: base }));
    expect(bodyClosedHtml).toContain('+ Registrar peso / medidas de hoy');
    const bodyHtml = renderToString(h(BodyView, { state: { ...base, measureDate: today } }));
    expect(bodyHtml).toContain('Referencia rápida: Cintura a la altura del ombligo');

    // B: Unificar con placeholders claros y vista previa + plantilla CSV
    const planExHtml = renderToString(h(PlanView, { state: { ...base, tab: 'plan', planTab: 'exercises', mergeFrom: 'Sóleo Sentado', mergeTo: 'Elevación de gemelos sentado' } }));
    expect(planExHtml).toContain('Todo el historial de');
    expect(planExHtml).toContain('se eliminará');
    const dataHtml = renderToString(h(DataView, { state: { ...base, tab: 'data' } }));
    expect(dataHtml).toContain('Descargar plantilla CSV');
    expect(dataHtml).toContain('Samsung Health → Ajustes');

    // C: HRV/VO2, notas diferenciadas y texto suavizado de volumen
    const adhHtml = renderToString(h(AdherenceView, { state: { ...base, tab: 'adherence' } }));
    expect(adhHtml).toContain('HRV (variabilidad cardíaca)');
    expect(adhHtml).toContain('VO2 máx: capacidad aeróbica estimada');
    const logHtml = renderToString(h(LogWorkoutView, { state: { ...base, tab: 'log', logDraft: initLogDraft(base, 'Push', today) } }));
    expect(logHtml).toContain('Nota de hoy');
    const dayHtml = renderToString(h(DayRoutineView, { day: 'Push', state: { ...base, tab: 'Push' } }));
    expect(dayHtml).toContain('Nota fija');
    expect(dayHtml).toContain('Nota de la última sesión:');
    const volHtml = renderToString(h(VolumeView, { state: { ...base, tab: 'volume' } }));
    expect(volHtml).toContain('Principal = 1 · Apoyo = 0,5');
  });

  it('lote 2 DRY y tipos: effectiveMuscleCredits, parseDecimal, diffIsoDays, cleanIso estricto y findAnalyzedExercise', () => {
    expect(effectiveMuscleCredits({ p: 'Pecho', s: ['Tríceps', 'Pecho', 'Tríceps', 'Hombros'] })).toEqual([
      ['Pecho', 1],
      ['Tríceps', 0.5],
      ['Hombros', 0.5],
    ]);

    expect(parseDecimal('72,5')).toBe(72.5);
    expect(parseDecimal('   ')).toBeUndefined();
    expect(diffIsoDays('2026-11-20', '2026-11-24')).toBe(5);
    expect(daysAgoIso(0, Date.parse('2026-11-24T12:00:00Z'))).toBe('2026-11-24');

    const settings = sanitizeSettings({});
    const today = todayIso();
    const strength = [
      { id: 'f1', sessionId: 'fs1', ts: 1000, date: today, ref: 'name:Press de banca', day: 'Push' as const, sets: [{ w: 80, r: 8, done: true }] },
    ];
    const analysis = analyze(strength, settings);
    expect(findAnalyzedExercise(analysis, 'Press de banca')?.n).toBe(1);
    expect(findAnalyzedExercise(analysis, '  press   de banca ')?.n).toBe(1);

    const invalidRangeState: State = {
      tab: 'home',
      strength,
      cardio: [],
      measures: [],
      wellbeing: [],
      settings,
      analysis,
      sel: {},
      perimeter: 'arms',
      muscleSel: 'Pecho',
      ranges: { home: 'Custom' },
      customRanges: { home: { from: '2026-02-31', to: today } },
    };
    expect(resolveRange(invalidRangeState, 'home').from).toBeNull();

    const firstDayAdh = buildAdherenceViewModel({
      ...invalidRangeState,
      tab: 'adherence',
      ranges: { adherence: '1M' },
      customRanges: undefined,
    });
    expect(firstDayAdh.isCurrentWeekOnly).toBe(true);
    expect(firstDayAdh.avg).toBe(1);

    const sleepOnlyAdh = buildAdherenceViewModel({
      ...invalidRangeState,
      tab: 'adherence',
      ranges: { adherence: '1M' },
      customRanges: undefined,
      wellbeing: [{ date: today, sleepMin: 450, steps: 8500 }],
    });
    expect(sleepOnlyAdh.sleepChartCfg?.data.datasets.map((d) => d.label)).toEqual(['Sueño (h)']);
    expect(sleepOnlyAdh.sleepChartCfg?.options).toBeUndefined();
    expect(sleepOnlyAdh.stepsChartCfg?.data.datasets[0]?.backgroundColor).toBe('#2DD4BF');

    expect(daysAgoIso(5, Date.parse('2026-11-26T12:00:00Z'))).toBe('2026-11-21');
  });
});
