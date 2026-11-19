import { h } from 'preact';
import renderToString from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import type { ChartConfiguration } from 'chart.js';
import { buildPrompt } from '../src/lib/ai';
import { analyze, judge, weeklyVolume } from '../src/lib/analysis';
import { parseBackup, sanitizeSettings } from '../src/lib/db';
import { ACTIVITY_OPTIONS, NUTRITION_PHASES, calculateNutrition, recommendActivityFactor } from '../src/lib/nutrition';
import { importSamsungInWorker } from '../src/lib/samsung';
import { DEFAULT_MUSCLES, DEFAULT_SETTINGS, norm } from '../src/lib/seed';
import { AiCoachPanel } from '../src/components/home/AiCoachPanel';
import { MobileHeader } from '../src/components/layout/MobileHeader';
import { MobileBottomNav } from '../src/components/layout/MobileNav';
import { Sidebar } from '../src/components/layout/Sidebar';
import { ModalHost } from '../src/components/modals/ModalHost';
import { WizardModal } from '../src/components/modals/WizardModal';
import { PlanCatalogList } from '../src/components/plan/PlanCatalogList';
import { RangePicker } from '../src/components/common/RangePicker';
import { RestTimerBar } from '../src/components/workout/RestTimerBar';
import { fmtMMSS } from '../src/hooks/useRestTimer';
import { buildCompChartConfig } from '../src/store/bodyChartConfigs';
import { allExerciseNames, extractTargetWeight, manualSessionId } from '../src/store/exerciseCatalog';
import { buildBodyHomeChartConfig, buildHomeExChartConfig } from '../src/store/homeChartConfigs';
import { initLogDraft } from '../src/store/logSelectors';
import { activeTabTitle, syncStatusInfo } from '../src/store/navigation';
import { getPlanCatalogData, plannedWeeklyVolume } from '../src/store/planSelectors';
import {
  createWizardDraft,
  daysActivityFactor,
  goalCalorieDelta,
  goalPhaseName,
  recommendTemplate,
} from '../src/store/wizardSelectors';
import { initLiveWorkout } from '../src/store/workoutSelectors';
import { ICON_PATHS } from '../src/ui/icons';
import { moveItem } from '../src/ui/reorder';
import { filterSelectionOptions, groupSelectionOptions, normalizeSelectionText, sortRecentSelectionOptions } from '../src/ui/selection';
import {
  inRange,
  isAiFreshForEx,
  movingAverage7d,
  normalizeChartConfig,
  resolveRange,
  routineShort,
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
import { LiveWorkoutView } from '../src/views/LiveWorkoutView';
import { LogWorkoutView } from '../src/views/LogWorkoutView';
import { PlanView } from '../src/views/PlanView';
import { SettingsView } from '../src/views/SettingsView';
import { VolumeView } from '../src/views/VolumeView';

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
    expect(homeHtml).toContain('+ Empezar primer entreno hoy');
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
    expect(html).toContain('items-end gap-3');
    expect(html).toContain('lbl min-h-8 leading-4');
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

  it('mantiene la zona de peligro plana y roja solo en borde y textos', () => {
    const html = renderToString(
      h(DataView, {
        state: {
          analysis: { unmapped: [] },
          strength: [],
          cardio: [],
          wellbeing: [],
          measures: [],
          user: null,
        } as unknown as State,
      }),
    );
    expect(html).toContain('border-coralRed/30');
    expect(html).toContain('text-coralRed');
    expect(html).not.toContain('bg-coralRed/5');
  });

  it('renderiza Modo Laboratorio en PlanView, modal de notas y cross-links sin card-itis', async () => {
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
      activeModal: { type: 'note', exName: 'Press Banca X', value: 'Pausa 1s abajo' },
    };

    const planHtml = renderToString(h(PlanView, { state }));
    expect(planHtml).toContain('lg:grid-cols-12');
    expect(planHtml).toContain('Simulador de volumen semanal');
    expect(planHtml).toContain('id="planExSearch"');
    expect(planHtml).toContain('aria-label="Rutina destino"');
    expect(planHtml).toContain('+ Añadir');
    expect(planHtml).toContain('Sentadilla Hack');

    const exerciseMapHtml = renderToString(h(PlanView, { state: { ...state, tab: 'plan', planTab: 'exercises' } }));
    expect(exerciseMapHtml).toContain('min-w-0 space-y-3');
    expect(exerciseMapHtml).not.toContain('space-y-3 overflow-x-auto');

    const emptySearchHtml = renderToString(h(PlanView, { state: { ...state, planSearch: 'zzzznoexiste' } }));
    expect(emptySearchHtml).toContain('Sin resultados');

    const modalHtml = renderToString(h(ModalHost, { state }));
    expect(modalHtml).toContain('id="note-modal"');
    expect(modalHtml).toContain('id="f-note-modal"');
    expect(modalHtml).toContain('id="noteModalInput"');
    expect(modalHtml).toContain('Pausa 1s abajo');
    expect(modalHtml).not.toContain('backdrop-blur');

    const homeHtml = renderToString(h(HomeView, { state }));
    expect(homeHtml).toContain('role="button"');
    expect(homeHtml).toContain('Torso');
    expect(homeHtml).toContain('Press Banca X');

    const volHtml = renderToString(h(VolumeView, { state }));
    expect(volHtml).toContain('hidden md:block');
    expect(volHtml).toContain('md:hidden');

    const adhHtml = renderToString(h(AdherenceView, { state }));
    expect(adhHtml).toContain('hidden md:flex');
    expect(adhHtml).toContain('flex md:hidden');

    const calcHtml = renderToString(h(CalcView, { state }));
    expect(calcHtml).toContain('divide-white/10');

    const emptyImport = await importSamsungInWorker([]);
    expect(emptyImport.strength).toEqual([]);
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

    const renderWizard = (wizardDraft: ReturnType<typeof createWizardDraft>) =>
      renderToString(
        h(WizardModal, {
          draft: wizardDraft,
          onboardingCompleted: Boolean(baseState.settings.onboardingCompleted),
          onPatch: () => {},
          onBack: () => {},
          onSubmitStep: () => {},
          onSkip: () => {},
        }),
      );

    const step1Html = renderToString(h(ModalHost, { state: { ...baseState, activeModal: { type: 'wizard', draft } } }));
    expect(step1Html).toContain('id="wizard-modal"');
    expect(step1Html).toContain('id="f-wizard"');
    expect(step1Html).toContain('id="wizAge"');
    expect(step1Html).toContain('Omitir');
    expect(step1Html).toContain('wizard-modal-in');
    expect(step1Html).not.toContain('backdrop-blur');

    const step2Html = renderWizard({ ...draft, step: 2, anim: 'next' });
    expect(step2Html).toContain('Objetivo principal');
    expect(step2Html).toContain('aria-label="Objetivo principal"');
    expect(step2Html).toContain('← Anterior');
    expect(step2Html).toContain('wizard-step-next');
    expect(step2Html).toContain('wizard-bar-fill');

    const stepBackHtml = renderWizard({ ...draft, step: 1, anim: 'prev' });
    expect(stepBackHtml).toContain('wizard-step-prev');

    const stepStaticHtml = renderWizard({ ...draft, step: 2, anim: undefined });
    expect(stepStaticHtml).not.toContain('wizard-step-next');
    expect(stepStaticHtml).not.toContain('wizard-step-prev');

    const step3Html = renderWizard({ ...draft, step: 3, anim: undefined });
    expect(step3Html).toContain('Recomendada');
    expect(step3Html).toContain('aria-label="Plantilla de rutina"');
    expect(step3Html).toContain('aria-label="Tono del Coach IA"');

    const homeHtml = renderToString(h(HomeView, { state: { ...baseState, measures: [] } }));
    expect(homeHtml).toContain('Configurar perfil y objetivo');

    const settingsHtml = renderToString(h(SettingsView, { state: baseState }));
    expect(settingsHtml).toContain('Asistente inicial');
    expect(settingsHtml).toContain('Objetivo');
    expect(settingsHtml).toContain('Experiencia');
    expect(settingsHtml).toContain('Días / semana');
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
    const runningHtml = renderToString(h(RestTimerBar, { restUntil: Date.now() + 65_000, targetRestSec: live.targetRestSec }));
    expect(runningHtml).toContain('data-rest-state="running"');
    expect(runningHtml).toContain('id="rest-timer-val"');
    expect(renderToString(h(RestTimerBar, { restUntil: Date.now() - 1000, targetRestSec: live.targetRestSec }))).toContain('data-rest-state="done"');
    expect(renderToString(h(RestTimerBar, { targetRestSec: live.targetRestSec }))).toContain('data-rest-state="idle"');

    const logHtml = renderToString(h(LogWorkoutView, { state: { ...state, logDraft: draft } }));
    expect(logHtml).not.toContain('id="rest-timer-bar"');
    expect(logHtml).toContain('aria-label="Descanso en segundos serie 1');
    expect(logHtml).toContain('Iniciar entreno en vivo');
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
    const html = renderToString(h(LiveWorkoutView, { state }));
    expect(html).toContain('Iniciar entrenamiento');
    expect(html).toContain('Toca hoy');
    expect(html).toContain('Pull');
    expect(html).toContain('Entreno libre');
    expect(html).toContain('Registrar un entreno ya hecho');

    const homeHtml = renderToString(h(HomeView, { state }));
    expect(homeHtml).toContain('Iniciar entreno');
    expect(homeHtml).toContain('Registrar hecho');
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
    const ex0Name = live.exercises[0].name;
    const ex1Name = live.exercises[1].name;

    const step1Html = renderToString(h(LiveWorkoutView, { state: { ...state, liveWorkout: live } }));
    expect(step1Html).toContain('id="rest-timer-bar"');
    expect(step1Html).toContain('aria-label="Peso kg serie 1"');
    expect(step1Html).toContain('aria-label="Descanso en segundos serie 1"');
    expect(step1Html).toContain('Peso (kg)');
    expect(step1Html).toContain('Reps');
    expect(step1Html).toContain('aria-label="Abrir lista de ejercicios"');
    expect(step1Html).not.toContain('role="tablist"');
    expect(step1Html).not.toContain('bg-cardDark');
    expect(step1Html).toContain('id="live-ex-menu-wrap" data-open="false"');
    expect(step1Html).toContain('grid-rows-[0fr]');
    expect(step1Html).toContain('+ Añadir serie');
    expect(step1Html).toContain('Cambiar ejercicio');
    expect(step1Html).toContain('Añadir ejercicio');
    expect(step1Html).toContain(`aria-label="Nota para ${ex0Name}"`);
    expect(step1Html).not.toContain(`aria-label="Nota para ${ex1Name}"`);

    const menuHtml = renderToString(
      h(LiveWorkoutView, {
        state: {
          ...state,
          liveWorkout: { ...live, exMenuOpen: true },
        },
      }),
    );
    expect(menuHtml).toContain('id="live-ex-menu-wrap" data-open="true"');
    expect(menuHtml).toContain('grid-rows-[1fr]');
    expect(menuHtml).toContain('id="live-ex-menu"');
    expect(menuHtml).toContain('rounded-2xl');
    expect(menuHtml).toContain(ex1Name);
    expect(menuHtml).toContain('Obj 2×10');
    expect(menuHtml).toContain('Últ. 80 kg × 8');

    const step2Html = renderToString(
      h(LiveWorkoutView, {
        state: {
          ...state,
          liveWorkout: { ...live, curIdx: 1, lastCompletedExIdx: 0 },
        },
      }),
    );
    expect(step2Html).toContain(`aria-label="Nota para ${ex1Name}"`);
    expect(step2Html).not.toContain(`aria-label="Nota para ${ex0Name}"`);
    expect(step2Html).toContain(`+ Serie extra en ${ex0Name}`);

    const swapHtml = renderToString(
      h(LiveWorkoutView, {
        state: {
          ...state,
          liveWorkout: { ...live, pickerMode: 'swap' },
        },
      }),
    );
    expect(swapHtml).toContain('Cambiar &quot;');
    expect(swapHtml).toContain('id="livePickerSelect"');
    expect(swapHtml).toContain('id="livePickerCustom"');

    const libreLive = initLiveWorkout(state, 'Libre');
    const libreHtml = renderToString(h(LiveWorkoutView, { state: { ...state, liveWorkout: libreLive } }));
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

  it('incluye identificadores de resumen en LiveWorkoutView, filtro de catálogo en Plan y DEFAULT_SETTINGS sin fases', () => {
    expect(DEFAULT_SETTINGS.phases).toEqual([]);

    const state = makeState();
    const live = initLiveWorkout(state, 'Push');
    const html = renderToString(h(LiveWorkoutView, { state: { ...state, liveWorkout: live } }));
    expect(html).toContain('id="liveCountSummary"');
    expect(html).toContain('id="liveFinishLabel"');
    expect(html).toContain('id="liveMenuSummary"');
    expect(html).toContain('Serie 1');
    expect(html).toContain(`1/${live.exercises.length}`);

    const renderCatalog = (search: string) => {
      const cat = getPlanCatalogData({ ...state, planSearch: search });
      return {
        countText: cat.countText,
        listHtml: renderToString(
          h(PlanCatalogList, {
            items: cat.items,
            targetRoutine: cat.targetRoutine,
            searchQuery: search,
          }),
        ),
      };
    };

    const byName = renderCatalog('hack');
    expect(byName.countText).toMatch(/^\d+\/\d+$/);
    expect(byName.listHtml).toContain('Sentadilla Hack');
    expect(byName.listHtml).not.toContain('Press Banca');

    const byMuscle = renderCatalog('bíceps');
    expect(byMuscle.listHtml).toContain('Bíceps');

    const noMatch = renderCatalog('xyznomatch123');
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
      const homeHtml = renderToString(h(HomeView, { state }));
      expect(homeHtml).toContain('% Grasa');
      expect(homeHtml).toContain('text-amberGold');
      expect(homeHtml).toContain('Pulso');
      expect(homeHtml).toContain('text-cyan-300');
      expect(homeHtml).not.toContain('text-coralRed');
      expect(homeHtml).not.toContain('#0D1320');
      expect(homeHtml).not.toContain('text-gray-500');

      const bodyHtml = renderToString(h(BodyView, { state }));
      expect(bodyHtml).not.toContain('text-gray-500');

      const dayHtml = renderToString(h(DayRoutineView, { day: 'Push', state }));
      expect(dayHtml).toContain('role="listbox"');
      expect(dayHtml).toMatch(/id="day-opt-0"[^>]*role="option"|role="option"[^>]*id="day-opt-0"/);
      expect(dayHtml).not.toContain('bg-[#0D1320]');

      const live = initLiveWorkout(state, 'Push');
      const liveHtml = renderToString(h(LiveWorkoutView, { state: { ...state, liveWorkout: { ...live, exMenuOpen: true } } }));
      expect(liveHtml).toContain('bg-floatDark');
      expect(liveHtml).not.toContain('bg-[#0E1525]');
      expect(liveHtml).not.toContain('text-gray-500');
      expect(liveHtml).not.toContain('placeholder-gray-500');

      const wizardHtml = renderToString(
        h(ModalHost, {
          state: {
            ...state,
            activeModal: { type: 'wizard', draft: createWizardDraft(state) },
          },
        }),
      );
      expect(wizardHtml).toContain('bg-modalDark');
      expect(wizardHtml).not.toContain('bg-[#0F1624]');
    } finally {
      // Sin caché imperativa de gráficas tras migración Preact
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
    expect(
      renderToString(
        h(Sidebar, {
          state,
          statsText: 'sin datos',
          liveCount: 0,
          draftCount: 0,
          unsynced: false,
          onSelectTab: () => {},
          onCloudLogin: () => {},
        }),
      ),
    ).toContain('bg-navDark');
    const mobHead = renderToString(
      h(MobileHeader, {
        state,
        statsText: 'sin datos',
        unsynced: false,
        onSelectTab: () => {},
        onCloudLogin: () => {},
      }),
    );
    expect(mobHead).toContain('<h1');
    expect(mobHead).toContain('role="tablist"');
    expect(
      renderToString(
        h(MobileBottomNav, {
          state,
          liveCount: 0,
          draftCount: 0,
          lastRoutine: 'Push',
          lastAnalytics: 'body',
          onSelectTab: () => {},
        }),
      ),
    ).toContain('bg-navDark');
  });

  it('evita crash en CalcView ante sets vacíos y aplica 16px / 44px en inputs de descanso', () => {
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
    expect(() => renderToString(h(CalcView, { state: baseState }))).not.toThrow();

    const liveHtml = renderToString(h(LiveWorkoutView, { state: { ...baseState, tab: 'workout', liveWorkout: initLiveWorkout(baseState, 'Push') } }));
    expect(liveHtml).toContain('aria-label="Descanso en segundos serie 1"');
    expect(liveHtml).toContain('min-h-[44px]');
    expect(liveHtml).toContain('text-base sm:text-xs');
    expect(liveHtml).not.toContain('min-h-[38px]');
    expect(liveHtml).not.toContain('h-11 w-10 sm:w-11');

    const logHtml = renderToString(h(LogWorkoutView, { state: { ...baseState, tab: 'log', logDraft: initLogDraft(baseState, 'Push', '2026-11-16') } }));
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

    const homeHtml = renderToString(h(HomeView, { state: emptyState }));
    expect(homeHtml).toContain('+ Empezar primer entreno hoy');
    expect(homeHtml).toContain('<span>Push</span>');

    const dayHtml = renderToString(h(DayRoutineView, { day: 'Push', state: emptyState }));
    expect(dayHtml).toContain('Press horizontal en máquina');
    expect(dayHtml).toContain('Pendiente de estrenar');
    expect(dayHtml).toContain('Sin estrenar');
    expect(dayHtml).not.toContain('No hay ejercicios con datos para esta rutina');

    const liveEmpty = initLiveWorkout(emptyState, 'Vacía');
    expect(liveEmpty.pickerMode).toBe('add');

    const settingsHtml = renderToString(h(SettingsView, { state: emptyState }));
    expect(settingsHtml).not.toContain('VITE_RECAPTCHA_SITE_KEY');
    expect(settingsHtml).not.toContain('App Check');
    expect(settingsHtml).not.toContain('Firebase AI Logic');
    expect(settingsHtml).toContain('2 días');

    const calcHtml = renderToString(h(CalcView, { state: { ...emptyState, tab: 'calc' } }));
    expect(calcHtml).toContain('aria-label="Factor de actividad"');
    expect(calcHtml).toContain('aria-label="Fase energética"');
    expect(calcHtml).toContain('Estima el peso máximo que podrías mover a 1 repetición');

    const liveFirstTime = initLiveWorkout(emptyState, 'Push');
    const liveHtml = renderToString(h(LiveWorkoutView, { state: { ...emptyState, tab: 'workout', liveWorkout: liveFirstTime } }));
    expect(liveHtml).toContain('Primera vez: empieza con un peso cómodo');
    expect(liveHtml).toContain('Desc. real');

    const summaryModalHtml = renderToString(
      h(ModalHost, {
        state: {
          ...emptyState,
          activeModal: {
            type: 'workoutSummary',
            summary: {
              day: 'Push',
              durationMin: 42,
              exercises: 5,
              sets: 14,
              tonnageKg: 3250,
              prNames: ['Press horizontal en máquina'],
            },
          },
        },
      }),
    );
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
    const wizardHtml = renderToString(
      h(WizardModal, {
        draft: createWizardDraft(state),
        onboardingCompleted: false,
        onPatch: () => {},
        onBack: () => {},
        onSubmitStep: () => {},
        onSkip: () => {},
      }),
    );
    expect(wizardHtml).toMatch(/<button\s+id="wizardNext"\s+type="submit"\s+class="btn-primary min-h-\[44px\] px-5">/);
    expect(wizardHtml).not.toMatch(/id="wizardNext"[^>]*data-act=/);
  });

  it('mantiene jerarquía de encabezados h2/h3 continua en CalcView, SettingsView y HomeView', () => {
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

    const calcHtml = renderToString(h(CalcView, { state }));
    expect(calcHtml).toContain('<h2 class="font-bold text-white">Calculadora de fuerza máxima (1RM)</h2>');
    expect(calcHtml).toContain('<h2 class="font-bold text-white">Planificador nutricional');
    expect(calcHtml).not.toContain('<h3');

    const settingsOut = renderToString(h(SettingsView, { state }));
    expect(settingsOut).toContain('<h2 class="font-bold text-white">Cuenta y sincronización</h2>');
    expect(settingsOut).toContain('<h2 class="font-bold text-white">Perfil del atleta</h2>');
    expect(settingsOut).toContain('<h2 class="font-bold text-white">Preferencias del Coach IA</h2>');
    expect(settingsOut).toContain('<h2 class="text-sm font-bold text-white">Accesos relacionados</h2>');
    expect(settingsOut).not.toContain('<h3');

    const homeWithAi = renderToString(h(HomeView, { state }));
    expect(homeWithAi).toContain('<h2 class="text-base sm:text-lg font-extrabold text-white">Informe IA</h2>');
    expect(homeWithAi).toContain('<h2 class="text-base font-bold text-white">Evolución de cargas</h2>');
    expect(homeWithAi).toContain('<h2 class="text-base font-bold text-white">Peso y % de grasa</h2>');
    expect(homeWithAi).toContain('<h2 class="text-base font-bold text-white">Control de cargas del bloque</h2>');
    expect(homeWithAi).not.toContain('<h4');

    const homeNoAi = renderToString(
      h(HomeView, {
        state: {
          ...state,
          settings: sanitizeSettings({}),
        },
      }),
    );
    expect(homeNoAi).toContain('<h2 class="text-base font-extrabold text-white">Informe IA</h2>');
    expect(homeNoAi).not.toContain('<h3');
  });

  it('vincula ai-tabpanel con aria-labelledby solo cuando hay múltiples pestañas y configura listbox en DayRoutineView', () => {
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

    const multiHtml = renderToString(h(AiCoachPanel, { state: base, tone: 'simple' }));
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
    const singleHtml = renderToString(h(AiCoachPanel, { state: { ...base, settings: singleSettings }, tone: 'simple' }));
    expect(singleHtml).not.toContain('role="tabpanel"');
    expect(singleHtml).not.toContain('aria-labelledby="ai-tab-');

    const dayHtml = renderToString(h(DayRoutineView, { day: 'Push', state: base }));
    expect(dayHtml).toContain('role="listbox" aria-orientation="vertical"');
    expect(dayHtml).toContain('id="day-opt-0" role="option" tabindex="0"');
    expect(dayHtml).toContain('id="day-opt-1" role="option" tabindex="-1"');
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

    const live = initLiveWorkout(state, 'Push');
    const liveHtml = renderToString(h(LiveWorkoutView, { state: { ...state, liveWorkout: live } }));
    expect(liveHtml).toContain('text-rose-300 hover:text-rose-200');
    expect(liveHtml).not.toContain('text-coralRed/90');
    expect(liveHtml).toContain('inp-stepper border-white/15 bg-transparent text-base');
    expect(liveHtml).not.toMatch(/class="[^"]*\b(?:btn|btn-primary|inp|inp-stepper|tab)\b[^"]*!/);
    expect(liveHtml.match(/![a-zA-Z0-9-[\]]+/g)).toEqual(['!mt-0']);

    const logHtml = renderToString(h(LogWorkoutView, { state: { ...state, tab: 'log', logDraft: initLogDraft(state, 'Push', '2026-11-15') } }));
    expect(logHtml).toContain('inp-stepper min-w-[44px]');
    expect(logHtml).toContain('btn btn-accent');
    expect(logHtml).not.toMatch(/class="[^"]*\b(?:btn|btn-primary|inp|inp-stepper|tab)\b[^"]*!/);

    const planHtml = renderToString(h(PlanView, { state: { ...state, tab: 'plan', planTab: 'routines' } }));
    const planExHtml = renderToString(h(PlanView, { state: { ...state, tab: 'plan', planTab: 'exercises' } }));
    const bodyHtml = renderToString(h(BodyView, { state: { ...state, tab: 'body' } }));
    const pickerHtml = renderToString(h(RangePicker, { scope: 'home', active: 'Custom', custom: {} }));
    for (const html of [planHtml, planExHtml, bodyHtml, pickerHtml]) {
      expect(html).not.toMatch(/class="[^"]*\b(?:btn|btn-primary|inp|inp-stepper|tab)\b[^"]*!/);
    }
  });
});
