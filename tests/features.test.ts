import { h } from 'preact';
import renderToString from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import type { ChartConfiguration } from 'chart.js';
import { buildPrompt } from '../src/lib/ai';
import { analyze, judge, musclesOf, weeklyVolume } from '../src/lib/analysis';
import { parseBackup, sanitizeSettings } from '../src/lib/db';
import { ACTIVITY_OPTIONS, NUTRITION_PHASES, calculateNutrition, recommendActivityFactor } from '../src/lib/nutrition';
import { importSamsungInWorker } from '../src/lib/samsung';
import { DEFAULT_MUSCLES, DEFAULT_SETTINGS, ROUTINE_COLORS, norm } from '../src/lib/seed';
import { AiInsightBanner } from '../src/components/common/AiInsightBanner';
import { ToastBanner, SwUpdateBanner } from '../src/components/common/ToastBanner';
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
import { buildAdherenceCalendarData, buildMonthGrid } from '../src/store/adherenceCalendar';
import { buildCompChartConfig, buildPerimChartConfig } from '../src/store/bodyChartConfigs';
import { createCatalogMapActions } from '../src/store/catalogMapActions';
import { allExerciseNames, extractTargetWeight, manualSessionId, quickExSuggestions } from '../src/store/exerciseCatalog';
import { buildBodyHomeChartConfig, buildHomeExChartConfig, exerciseChartConfig } from '../src/store/homeChartConfigs';
import { initLogDraft } from '../src/store/logSelectors';
import { createLogSetActions } from '../src/store/logSetActions';
import { activeTabTitle, isValidTab, syncStatusInfo } from '../src/store/navigation';
import { createPlanActions } from '../src/store/planActions';
import { createPlanFilterActions } from '../src/store/planFilterActions';
import { createPlanModalActions } from '../src/store/planModalActions';
import { getPlanCatalogData, plannedWeeklyVolume } from '../src/store/planSelectors';
import { createRoutineEditActions } from '../src/store/routineEditActions';
import { applyRoutineTemplateToState } from '../src/store/routineTemplate';
import {
  createWizardDraft,
  daysActivityFactor,
  goalCalorieDelta,
  goalPhaseName,
  recommendTemplate,
} from '../src/store/wizardSelectors';
import { createLiveWorkoutActions } from '../src/store/workoutActions';
import { createWorkoutLaunchActions } from '../src/store/workoutLaunchActions';
import { initLiveWorkout } from '../src/store/workoutSelectors';
import { createWorkoutSetActions } from '../src/store/workoutSetActions';
import { ICON_PATHS } from '../src/ui/icons';
import { moveItem } from '../src/ui/reorder';
import { filterSelectionOptions, groupSelectionOptions, normalizeSelectionText, sortRecentSelectionOptions } from '../src/ui/selection';
import {
  DAY_COLOR,
  humanizeError,
  inRange,
  isAiFreshForEx,
  movingAverage7d,
  normalizeChartConfig,
  resolveRange,
  routineColor,
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
    expect(html).toContain('flex flex-col justify-end');
    expect(html).toContain('lbl leading-4');
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
    expect(planHtml).toContain('+ Añadir ejercicio');
    expect(planHtml).not.toContain('Catálogo rápido');
    expect(planHtml).not.toContain('+ Añadir fila');

    const pickerHtml = renderToString(
      h(ModalHost, { state: { ...state, activeModal: { type: 'routineExercisePicker', routine: 'Torso' } } }),
    );
    expect(pickerHtml).toContain('id="add-routine-ex-modal"');
    expect(pickerHtml).toContain('id="planExSearch"');
    expect(pickerHtml).toContain('+ Añadir');
    expect(pickerHtml).toContain('Sentadilla Hack');

    const exerciseMapHtml = renderToString(h(PlanView, { state: { ...state, tab: 'plan', planTab: 'exercises' } }));
    expect(exerciseMapHtml).toContain('min-w-0 space-y-3');
    expect(exerciseMapHtml).not.toContain('space-y-3 overflow-x-auto');

    const emptyCatalog = getPlanCatalogData({ ...state, planSearch: 'zzzznoexiste' });
    const emptySearchHtml = renderToString(
      h(PlanCatalogList, { items: emptyCatalog.items, targetRoutine: 'Torso', searchQuery: 'zzzznoexiste' }),
    );
    expect(emptySearchHtml).toContain('Sin resultados');

    const modalHtml = renderToString(h(ModalHost, { state }));
    expect(modalHtml).toContain('id="note-modal"');
    expect(modalHtml).toContain('id="f-note-modal"');
    expect(modalHtml).toContain('id="noteModalInput"');
    expect(modalHtml).toContain('Pausa 1s abajo');
    expect(modalHtml).not.toContain('backdrop-blur');

    const homeHtml = renderToString(h(HomeView, { state }));
    expect(homeHtml).not.toContain('role="button"');
    expect(homeHtml).toContain('Control de cargas del bloque');
    expect(homeHtml).toContain('Torso');
    expect(homeHtml).toContain('Press Banca X');

    const volHtml = renderToString(h(VolumeView, { state }));
    expect(volHtml).toContain('hidden md:block');
    expect(volHtml).toContain('md:hidden');

    const adhHtml = renderToString(h(AdherenceView, { state }));
    expect(adhHtml).toContain('aria-label="Mes anterior"');
    expect(adhHtml).toContain('aria-label="Mes siguiente"');
    expect(adhHtml).toContain('grid-cols-7');

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
          liveWorkout: { ...live, pickerMode: 'swap', pickerQuery: 'Ejercicio Nuevo XYZ' },
        },
      }),
    );
    expect(swapHtml).toContain('Cambiar &quot;');
    expect(swapHtml).toContain('id="livePickerSearch"');
    expect(swapHtml).toContain('id="livePickerList"');
    expect(swapHtml).toContain('id="livePickerCreate"');

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
    expect(dayHtml).toContain('role="listbox" tabindex="0" aria-orientation="vertical"');
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
    expect(liveHtml).toContain('inp-stepper border-white/15 bg-transparent text-base min-h-[48px] sm:min-h-[44px] min-w-[52px]');
    expect(liveHtml).toContain('min-h-[48px] min-w-[48px]');
    expect(liveHtml).not.toMatch(/class="[^"]*\b(?:btn|btn-primary|inp|inp-stepper|tab)\b[^"]*!/);
    expect(liveHtml.match(/![a-zA-Z0-9-[\]]+/g)).toEqual(['!mt-0']);

    const logHtml = renderToString(h(LogWorkoutView, { state: { ...state, tab: 'log', logDraft: initLogDraft(state, 'Push', '2026-11-15') } }));
    expect(logHtml).toContain('inp-stepper min-w-[44px]');
    expect(logHtml).toContain('btn btn-accent');
    expect(logHtml).toContain('<h1');
    expect(logHtml).not.toMatch(/class="[^"]*\b(?:btn|btn-primary|inp|inp-stepper|tab)\b[^"]*!/);

    const planHtml = renderToString(h(PlanView, { state: { ...state, tab: 'plan', planTab: 'routines' } }));
    const planExHtml = renderToString(h(PlanView, { state: { ...state, tab: 'plan', planTab: 'exercises' } }));
    const bodyHtml = renderToString(h(BodyView, { state: { ...state, tab: 'body' } }));
    const pickerHtml = renderToString(h(RangePicker, { scope: 'home', active: 'Custom', custom: {} }));
    expect(planHtml).toContain('<h1');
    expect(bodyHtml).toContain('<h1');
    expect(bodyHtml).toContain('table-fixed');
    expect(pickerHtml).toContain('min-h-[44px] min-w-[44px]');
    for (const html of [planHtml, planExHtml, bodyHtml, pickerHtml]) {
      expect(html).not.toMatch(/class="[^"]*\b(?:btn|btn-primary|inp|inp-stepper|tab)\b[^"]*!/);
    }
  });

  it('reserva coralRed y #EC4899 fuera de paletas neutras de rutinas y gráficas corporales', () => {
    for (const palette of [ROUTINE_COLORS, Object.values(DAY_COLOR)]) {
      expect(palette).not.toContain('#F43F5E');
      expect(palette).not.toContain('#EC4899');
    }

    const trunkState: State = {
      tab: 'body',
      strength: [],
      cardio: [],
      measures: [{ date: '2026-11-15', torso: 102, waist: 80, shoulders: 118, glute: 96 }],
      wellbeing: [],
      settings: sanitizeSettings({}),
      analysis: analyze([], sanitizeSettings({})),
      sel: {},
      perimeter: 'trunk',
      muscleSel: 'Pecho',
      ranges: { body: 'Todo' },
    };
    const perimCfg = buildPerimChartConfig(trunkState);
    const colors = perimCfg?.data.datasets.map((d) => String(d.borderColor)) ?? [];
    expect(colors.length).toBe(4);
    expect(colors).not.toContain('#F43F5E');
    expect(colors).not.toContain('#EC4899');
  });

  it('humaniza errores, soporta Deshacer en toast/acciones y acota párrafos IA con max-w-prose y sticky en Rutina', () => {
    expect(humanizeError(new Error('Missing or insufficient permissions.'))).toContain('Sin permisos en la nube');
    expect(humanizeError(new Error('Failed to get document because the client is offline.'))).toContain('Sin conexión estable');
    expect(humanizeError(new Error('invalid zip data'))).toContain('ZIP está dañado');

    let lastAction: { label: string; onAction: () => void } | undefined;
    const settings = sanitizeSettings({});
    const state: State = {
      tab: 'log',
      strength: [],
      cardio: [],
      measures: [{ date: '2026-11-15', weight: 75 }],
      wellbeing: [],
      settings: {
        ...settings,
        ai: {
          date: '2026-11-15',
          tone: 'technical',
          overview: {
            overallStatus: 'Progreso sólido',
            highlights: ['Buen ritmo'],
            sections: [{ title: 'Composición corporal', verdict: 'good', text: 'Peso estable y tendencia limpia.' }],
          },
          byExercise: {},
        },
      },
      analysis: analyze([], settings),
      sel: {},
      perimeter: 'arms',
      muscleSel: 'Pecho',
      ranges: {},
      aiTab: 1,
    };

    let draft = initLogDraft(state, 'Push', '2026-11-15');
    const initialCount = draft.exercises.length;
    const firstExName = draft.exercises[0].name;
    const logSetActions = createLogSetActions(
      () => draft,
      (next) => { if (next) draft = next; },
      (_msg, action) => { lastAction = action; },
    );
    logSetActions.removeExercise(0);
    expect(draft.exercises.length).toBe(initialCount - 1);
    expect(lastAction?.label).toBe('Deshacer');
    lastAction?.onAction();
    expect(draft.exercises.length).toBe(initialCount);
    expect(draft.exercises[0].name).toBe(firstExName);

    let live = initLiveWorkout(state, 'Push');
    const initialSets = live.exercises[0].sets.length;
    const workoutSetActions = createWorkoutSetActions(
      () => live,
      (next) => { if (next) live = next; },
      (next) => { if (next) live = next; },
      (_msg, action) => { lastAction = action; },
    );
    workoutSetActions.delSet(0, 1);
    expect(live.exercises[0].sets.length).toBe(initialSets - 1);
    lastAction?.onAction();
    expect(live.exercises[0].sets.length).toBe(initialSets);

    const toastHtml = renderToString(h(ToastBanner, { message: 'Serie eliminada.', action: { label: 'Deshacer', onAction: () => {} } }));
    expect(toastHtml).toContain('Deshacer');

    const coachHtml = renderToString(h(AiCoachPanel, { state, tone: 'technical' }));
    expect(coachHtml).toContain('max-w-prose');

    const bannerHtml = renderToString(h(AiInsightBanner, { state, pattern: /composici/i }));
    expect(bannerHtml).toContain('<section');
    expect(bannerHtml).not.toContain('<aside');
    expect(bannerHtml).toContain('max-w-prose');

    const dayHtml = renderToString(h(DayRoutineView, { day: 'Push', state }));
    expect(dayHtml).toContain('lg:sticky lg:top-6');
    expect(dayHtml).toContain('<h1');
  });

  it('cumple prioridades 6-10: sugerencias musculares, menú live, CTA único, Wizard sin doble omitir y pulido final', async () => {
    const settings = sanitizeSettings({
      onboardingCompleted: true,
      routines: {
        ...DEFAULT_SETTINGS.routines,
        Push: [
          { name: 'Press de banca', sets: 3, reps: 8 },
          { name: 'Press militar', sets: 3, reps: 10 },
          { name: 'Abdominales en máquina', sets: 3, reps: 15 },
        ],
      },
      muscles: {
        ...DEFAULT_MUSCLES,
        'Press de banca': { p: 'Pecho', s: ['Hombro', 'Tríceps'] },
        'Press militar': { p: 'Hombro', s: ['Tríceps'] },
        'Abdominales en máquina': { p: 'Abdomen', s: [] },
        'Abdominales (crunches)': { p: 'Abdomen', s: [] },
        'Press inclinado con mancuernas': { p: 'Pecho', s: ['Hombro', 'Tríceps'] },
      },
    });
    const state: State = {
      tab: 'home',
      strength: [
        { id: 'r1', sessionId: 's1', ts: 1700000000000, date: '2026-11-10', ref: 'name:Press de banca', day: 'Push', sets: [{ w: 80, r: 8 }] },
      ],
      cardio: [],
      measures: [{ date: '2026-11-10', weight: 76 }],
      wellbeing: [],
      settings,
      analysis: analyze(
        [{ id: 'r1', sessionId: 's1', ts: 1700000000000, date: '2026-11-10', ref: 'name:Press de banca', day: 'Push', sets: [{ w: 80, r: 8 }] }],
        settings,
      ),
      sel: {},
      perimeter: 'arms',
      muscleSel: 'Pecho',
      ranges: {},
    };

    // Prioridad 6: quickExSuggestions no queda secuestrado por Abdominales y en swap prioriza el músculo sustituido
    const pushSugg = quickExSuggestions(state, 'Push', ['Press de banca', 'Press militar', 'Abdominales en máquina'], 6);
    expect(pushSugg.quick.length).toBeGreaterThan(0);
    expect(pushSugg.quick.every((n) => musclesOf(n, settings)?.p !== 'Abdomen')).toBe(true);
    const swapSugg = quickExSuggestions(state, 'Push', ['Press de banca', 'Press militar', 'Abdominales en máquina'], 6, 'Press de banca');
    expect(swapSugg.quick.length).toBeGreaterThan(0);
    expect(swapSugg.quick.every((n) => musclesOf(n, settings)?.p === 'Pecho')).toBe(true);

    // Prioridad 6: save() parcial pide confirmación en askConfirm y aborta si cancela
    let live = initLiveWorkout(state, 'Push');
    live = {
      ...live,
      exercises: [
        { name: 'Press de banca', note: '', done: false, sets: [{ w: 80, r: 8, done: true }, { w: 80, r: 8, done: false }] },
      ],
    };
    const confirmCalls: string[] = [];
    const workoutActions = createLiveWorkoutActions({
      getState: () => ({ ...state, liveWorkout: live }),
      saveLiveOnly: (next) => { live = next ?? live; },
      commitLive: (next) => { if (next) live = next; },
      reload: async () => {},
      setTab: () => {},
      queueSync: () => {},
      toast: () => {},
      askConfirm: async (opts) => {
        confirmCalls.push(opts.title);
        return false;
      },
      openNoteModal: () => {},
      showSummary: () => {},
    });
    await workoutActions.save();
    expect(confirmCalls).toEqual(['Terminar entrenamiento']);
    expect(live.exercises[0].sets[0].done).toBe(true);

    // Prioridad 6 & 9: Descartar dentro de LiveExerciseMenu y sin doble btn-primary cuando allDone o picker activo
    const liveWithPickerHtml = renderToString(
      h(LiveWorkoutView, { state: { ...state, tab: 'workout', liveWorkout: { ...live, pickerMode: 'swap' } } }),
    );
    expect(liveWithPickerHtml).toContain('Descartar entrenamiento');
    expect(liveWithPickerHtml).toContain('id="livePickerSearch"');
    const allDoneLive = {
      ...live,
      exercises: [{ name: 'Press de banca', note: '', done: true, sets: [{ w: 80, r: 8, done: true }] }],
    };
    const allDoneHtml = renderToString(h(LiveWorkoutView, { state: { ...state, tab: 'workout', liveWorkout: allDoneLive } }));
    expect((allDoneHtml.match(/class="btn-primary(?:-sm)?\b/g) ?? []).length).toBe(1);

    // Prioridad 7 & 9: WizardModal sin doble "Omitir" en Paso 1 y con pie fijo fuera del área scrollable
    const wizardStep1Html = renderToString(h(WizardModal, { draft: createWizardDraft(state), onPatch: () => {}, onBack: () => {}, onSubmitStep: () => {}, onSkip: () => {} }));
    expect(wizardStep1Html).not.toContain('Omitir por ahora');
    expect(wizardStep1Html).toContain('flex-1 overflow-y-auto');

    // Prioridad 9: máximo 1 btn-primary en HomeView y DayRoutineView, y MobileHeader con estado antes que stats
    const homeHtml = renderToString(h(HomeView, { state }));
    expect((homeHtml.match(/class="btn-primary(?:-sm)?\b/g) ?? []).length).toBe(1);
    expect(homeHtml).not.toContain('role="button"');
    const dayHtml = renderToString(h(DayRoutineView, { day: 'Push', state }));
    expect((dayHtml.match(/class="btn-primary(?:-sm)?\b/g) ?? []).length).toBe(1);
    expect(dayHtml).toContain('sr-only');

    const mobHtml = renderToString(
      h(MobileHeader, {
        state,
        statsText: '18 sesiones · 12 medidas',
        unsynced: false,
        onSelectTab: () => {},
        onCloudLogin: () => {},
      }),
    );
    expect(mobHtml.indexOf('Solo local')).toBeLessThan(mobHtml.indexOf('18 ses.'));

    // Prioridad 7 & 8 & 10: Log RIR cabecera desktop, singular "1 serie", DataView inputs estilizados y aria-live en Plan
    const logDraft = initLogDraft(state, 'Push', '2026-11-15');
    logDraft.exercises = [{ name: 'Press de banca', note: '', done: true, sets: [{ w: 80, r: 8, done: true }] }];
    const logHtml = renderToString(h(LogWorkoutView, { state: { ...state, tab: 'log', logDraft } }));
    expect(logHtml).toContain('<span class="w-14 shrink-0 text-center">RIR</span>');
    expect(logHtml).toContain('Guardar sesión (1 serie)');

    const dataHtml = renderToString(h(DataView, { state: { ...state, tab: 'data' } }));
    expect((dataHtml.match(/class="sr-only" type="file"/g) ?? []).length).toBe(3);

    const planHtml = renderToString(h(PlanView, { state: { ...state, tab: 'plan', planTab: 'routines' } }));
    expect(planHtml).toContain('volumen óptimo');
    expect(planHtml).toContain('+ Añadir ejercicio');

    const pickerHtml = renderToString(
      h(ModalHost, { state: { ...state, activeModal: { type: 'routineExercisePicker', routine: 'Push' } } }),
    );
    expect(pickerHtml).toContain('id="planCatalogCount" aria-live="polite"');
  });

  it('corrige captura-review: calendario mensual, Sidebar sin doble CTA, AiInsightBanner plano, migración coral, picker 1 toque, chips musculares, animaciones y Editar rutina', async () => {
    // 1. Migración de #F43F5E / #EC4899 en sanitizeSettings y routineColor
    const migrated = sanitizeSettings({ routineMeta: { Push: { color: '#F43F5E', sub: 'Empuje' }, Custom: { color: '#ec4899' } } });
    expect(migrated.routineMeta?.Push?.color).toBe('#A855F7');
    expect(migrated.routineMeta?.Custom?.color).toBe('#A855F7');
    const legacySettings = { ...migrated, routineMeta: { Push: { color: '#F43F5E', sub: 'Empuje' } } };
    expect(routineColor('Push', legacySettings, 0)).toBe('#A855F7');

    // 2. Sidebar sin bg-electricBlue / btn-primary y con copy unificado "Registrar hecho"
    const baseState: State = {
      tab: 'home',
      strength: [{ id: 's1', sessionId: 's1', ts: Date.parse('2026-11-14T12:00:00Z'), date: '2026-11-14', ref: 'name:Press de banca', day: 'Push', sets: [{ w: 80, r: 8 }] }],
      cardio: [{ id: 'c1', ts: Date.parse('2026-11-14T14:00:00Z'), date: '2026-11-14', type: 1, distKm: 3.3, durMin: 20, avgHr: 142, kcal: 190 }],
      measures: [{ date: '2026-11-14', weight: 70.5 }],
      wellbeing: [],
      settings: {
        ...migrated,
        ai: {
          date: '2026-11-18',
          tone: 'technical',
          overview: { overallStatus: 'Bien', highlights: [], sections: [{ title: 'Composición Corporal', verdict: 'good', text: 'Progreso limpio.' }] },
          byExercise: {},
        },
      },
      analysis: analyze(
        [{ id: 's1', sessionId: 's1', ts: Date.parse('2026-11-14T12:00:00Z'), date: '2026-11-14', ref: 'name:Press de banca', day: 'Push', sets: [{ w: 80, r: 8 }] }],
        migrated,
      ),
      sel: {},
      perimeter: 'arms',
      muscleSel: 'Pecho',
      ranges: {},
    };
    const sidebarHtml = renderToString(
      h(Sidebar, { state: baseState, statsText: '1 ses.', liveCount: 0, draftCount: 0, unsynced: false, onSelectTab: () => {}, onCloudLogin: () => {} }),
    );
    expect(sidebarHtml).not.toContain('btn-primary');
    expect(sidebarHtml).not.toContain('px-3.5 py-2.5 text-sm font-bold text-white');
    expect(sidebarHtml).toContain('Registrar hecho');
    expect(sidebarHtml).not.toContain('Registrar ya hecho');

    // 3. AiInsightBanner plano sin bg-cardDark de caja vacía a la derecha
    const aiHtml = renderToString(h(AiInsightBanner, { state: baseState, pattern: /composici/i }));
    expect(aiHtml).toContain('border-l-2');
    expect(aiHtml).toContain('max-w-prose');
    expect(aiHtml).not.toContain('bg-cardDark');

    // 4. Calendario mensual de adherencia: default 1M, meses acotados y agrupación fuerza + cardio
    const adhHtml = renderToString(h(AdherenceView, { state: baseState }));
    expect(adhHtml).toContain('Mes anterior');
    expect(adhHtml).toContain('Mes siguiente');
    const cal3M = buildAdherenceCalendarData(baseState, { key: '3M', label: '3M', from: '2026-08-20', to: '2026-11-19' }, ['2026-11-14']);
    expect(cal3M.months).toEqual(['2026-08', '2026-09', '2026-10', '2026-11']);
    expect(cal3M.byDate['2026-11-14']?.multi).toBe(true);
    expect(cal3M.byDate['2026-11-14']?.primaryColor).toBe('#A855F7');
    const novGrid = buildMonthGrid('2026-11', '2026-11-19', { key: '3M', label: '3M', from: '2026-08-20', to: '2026-11-19' }, cal3M.byDate);
    expect(novGrid.some((c) => c.iso === '2026-11-14' && c.inMonth)).toBe(true);

    // 5. Músculos por ejercicio: chips táctiles sin comas, sin scrollbar gris, preservando secundarios heredados
    const mapActions = createCatalogMapActions({
      getState: () => baseState,
      persist: async () => {},
      askConfirm: async () => true,
      toast: () => {},
    });
    await mapActions.toggleSecondaryMuscle('Press de banca', 'Bíceps');
    expect(baseState.settings.muscles[norm('Press de banca')]).toEqual({ p: 'Pecho', s: ['Tríceps', 'Hombros', 'Bíceps'] });
    await mapActions.changePrimaryMuscle('Press de banca', 'Hombros');
    expect(baseState.settings.muscles[norm('Press de banca')]).toEqual({ p: 'Hombros', s: ['Tríceps', 'Bíceps'] });

    const exTabHtml = renderToString(h(PlanView, { state: { ...baseState, tab: 'plan', planTab: 'exercises' } }));
    expect(exTabHtml).toContain('no-scrollbar');
    expect(exTabHtml).not.toContain('Ej. Tríceps, Hombros…');

    // 6. Bug "Editar rutina" desde Rutina -> siempre abre 'routines' aunque planTab estuviera en 'exercises'
    let currentTab = 'Pull';
    const filterActions = createPlanFilterActions(
      () => baseState,
      () => {},
      (t) => { currentTab = t; },
    );
    baseState.planTab = 'exercises';
    filterActions.openRoutineInPlan('Pull');
    expect(currentTab).toBe('plan');
    expect(baseState.planTab).toBe('routines');

    // 7. Animaciones colapsables presentes en MeasureForm y DayRoutineView
    const bodyHtml = renderToString(h(BodyView, { state: baseState }));
    expect(bodyHtml).toContain('grid-rows-[0fr]');

    // 8. Gráfica de cargas sin e1RM ni switch, con leyenda Peso máx + Tonelaje y tooltip mínimo
    const chartCfg = exerciseChartConfig(
      [{ date: '2026-10-21', sets: [{ w: 25, r: 12 }, { w: 27.5, r: 6 }], top: 27.5, repsAtTop: 6, volume: 465, e1rm: 33, avgHr: 132, maxHr: 159 }],
      '#3B82F6',
    );
    expect(chartCfg.data.datasets.map((d) => d.label)).toEqual(['Peso máx (kg)', 'Tonelaje (kg)']);
    expect(chartCfg.data.datasets.map((d) => (d as { yAxisID?: string }).yAxisID)).toEqual(['y', 'y1']);
    const tipCb = (chartCfg.options?.plugins?.tooltip as { callbacks?: { label?: (c: { dataIndex: number; datasetIndex: number }) => string; afterBody?: (items: { dataIndex: number }[]) => string[] } })?.callbacks;
    expect(tipCb?.label?.({ dataIndex: 0, datasetIndex: 0 })).toBe('Peso máx: 27,5 kg');
    expect(tipCb?.label?.({ dataIndex: 0, datasetIndex: 1 })).toBe('Tonelaje: 465 kg');
    const tipExtra = tipCb?.afterBody?.([{ dataIndex: 0 }]) ?? [];
    expect(tipExtra).toEqual(['Series: 25×12 · 27,5×6']);
    expect(tipExtra.join(' ')).not.toContain('e1RM');
    expect(tipExtra.join(' ')).not.toContain('FC media');

    const cleanHomeHtml = renderToString(h(HomeView, { state: baseState }));
    expect(cleanHomeHtml).not.toContain('e1RM');
    expect(cleanHomeHtml).not.toContain('Métrica de progresión');
    const cleanDayHtml = renderToString(h(DayRoutineView, { day: 'Push', state: baseState }));
    expect(cleanDayHtml).not.toContain('e1RM');
    expect(cleanDayHtml).toContain('Tonelaje máx');
  });

  it('separa Rutinas de Plan, centra Entrenar en 5 pestañas móviles y edita 1 rutina a la vez', async () => {
    const settings = sanitizeSettings({});
    const baseState: State = {
      tab: 'home',
      strength: [],
      cardio: [],
      measures: [],
      wellbeing: [],
      settings,
      analysis: analyze([], settings),
      sel: {},
      perimeter: 'waist',
      muscleSel: 'Pecho',
    };

    // 1. MobileBottomNav: 5 pestañas en orden Resumen -> Rutinas -> Entrenar -> Plan -> Análisis, etiqueta fija "Rutinas"
    const navRoutineHtml = renderToString(
      h(MobileBottomNav, {
        state: { ...baseState, tab: 'Leg' },
        liveCount: 0,
        draftCount: 0,
        lastRoutine: 'Leg',
        lastAnalytics: 'body',
        onSelectTab: () => {},
      }),
    );
    expect(navRoutineHtml).toContain('grid-cols-5');
    expect(navRoutineHtml).not.toContain('Rutinas · Plan');
    expect(navRoutineHtml).toContain('<span>Rutinas</span>');
    const idxResumen = navRoutineHtml.indexOf('<span>Resumen</span>');
    const idxRutinas = navRoutineHtml.indexOf('<span>Rutinas</span>');
    const idxEntrenar = navRoutineHtml.indexOf('>Entrenar</span>');
    const idxPlan = navRoutineHtml.indexOf('<span>Plan</span>');
    const idxAnalisis = navRoutineHtml.indexOf('<span>Análisis</span>');
    expect(idxResumen).toBeLessThan(idxRutinas);
    expect(idxRutinas).toBeLessThan(idxEntrenar);
    expect(idxEntrenar).toBeLessThan(idxPlan);
    expect(idxPlan).toBeLessThan(idxAnalisis);
    expect(navRoutineHtml).toMatch(/aria-current="page"[^>]*bnav-item bnav-item-on[^>]*>.*?<span>Rutinas<\/span>/s);

    const navPlanHtml = renderToString(
      h(MobileBottomNav, {
        state: { ...baseState, tab: 'plan' },
        liveCount: 0,
        draftCount: 0,
        lastRoutine: 'Push',
        lastAnalytics: 'body',
        onSelectTab: () => {},
      }),
    );
    expect(navPlanHtml).toMatch(/bnav-item bnav-item-on[^>]*>.*?<span>Plan<\/span>/s);
    expect(navPlanHtml).not.toMatch(/bnav-item bnav-item-on[^>]*>.*?<span>Rutinas<\/span>/s);

    // 2. MobileHeader: solo rutinas en Push (sin botón Plan) y 3 subpestañas en Plan
    const headPush = renderToString(
      h(MobileHeader, {
        state: { ...baseState, tab: 'Push' },
        statsText: 'sin datos',
        unsynced: false,
        onSelectTab: () => {},
        onCloudLogin: () => {},
      }),
    );
    expect(headPush).toContain('aria-label="Rutinas"');
    expect(headPush).not.toContain('>Plan</button>');

    const headPlan = renderToString(
      h(MobileHeader, {
        state: { ...baseState, tab: 'plan', planTab: 'phases' },
        statsText: 'sin datos',
        unsynced: false,
        onSelectTab: () => {},
        onSelectPlanTab: () => {},
        onCloudLogin: () => {},
      }),
    );
    expect(headPlan).toContain('aria-label="Secciones de planificación"');
    expect(headPlan).toContain('Rutinas');
    expect(headPlan).toContain('Ejercicios');
    expect(headPlan).toContain('Fases');
    expect(headPlan).toContain('grid-cols-3');

    // 3. Sidebar: sección Planificación separada de Rutinas sin "Plan y rutinas"
    const sideHtml = renderToString(
      h(Sidebar, {
        state: { ...baseState, tab: 'plan', planTab: 'phases' },
        statsText: 'sin datos',
        liveCount: 0,
        draftCount: 0,
        unsynced: false,
        onSelectTab: () => {},
        onSelectPlanTab: () => {},
        onCloudLogin: () => {},
      }),
    );
    expect(sideHtml).toContain('Planificación');
    expect(sideHtml).not.toContain('Plan y rutinas');
    expect(sideHtml).toContain('Editor de rutinas');
    expect(sideHtml).toContain('Ejercicios y músculos');
    expect(sideHtml).toContain('Fases del bloque');
    expect(sideHtml).toMatch(/aria-current="page"[^>]*>.*?Fases del bloque/s);

    // 4. PlanView: muestra solo la rutina activa en routines, Plantillas desplegable y fases en planTab: 'phases'
    const planPush = renderToString(h(PlanView, { state: { ...baseState, tab: 'plan', planTab: 'routines', planRoutine: 'Push' } }));
    expect(planPush).toContain('aria-label="Rutina a editar"');
    expect(planPush).toContain('aria-controls="plan-templates-panel"');
    expect(planPush).toContain('id="plan-routine-push"');
    expect(planPush).not.toContain('id="plan-routine-pull"');
    expect(planPush).not.toContain('id="f-phase"');

    const planPull = renderToString(h(PlanView, { state: { ...baseState, tab: 'plan', planTab: 'routines', planRoutine: 'Pull' } }));
    expect(planPull).toContain('id="plan-routine-pull"');
    expect(planPull).not.toContain('id="plan-routine-push"');

    const planPhases = renderToString(h(PlanView, { state: { ...baseState, tab: 'plan', planTab: 'phases' } }));
    expect(planPhases).toContain('id="f-phase"');
    expect(planPhases).toContain('Fases nutricionales y de entrenamiento');

    // 5. Acciones del store: setPlanRoutine, openPlanTab, openRoutineInPlan y consistencia tras plantilla/creación/borrado
    let navTab = 'home';
    let lastRoutine = 'Push';
    const filter = createPlanFilterActions(() => baseState, () => {}, (t) => { navTab = t; });
    filter.setPlanRoutine('Leg');
    expect(baseState.planRoutine).toBe('Leg');
    expect(baseState.planTargetRoutine).toBe('Leg');

    filter.openPlanTab('phases');
    expect(navTab).toBe('plan');
    expect(baseState.planTab).toBe('phases');

    filter.openRoutineInPlan('Pull');
    expect(navTab).toBe('plan');
    expect(baseState.planTab).toBe('routines');
    expect(baseState.planRoutine).toBe('Pull');
    expect(baseState.planTargetRoutine).toBe('Pull');

    applyRoutineTemplateToState(baseState, 'upperLower', () => lastRoutine, (d) => { lastRoutine = d; }, () => {});
    expect(baseState.planRoutine).toBe('Torso A');
    expect(baseState.planTargetRoutine).toBe('Torso A');

    const modal = createPlanModalActions({
      getState: () => baseState,
      getLastRoutine: () => lastRoutine,
      setLastRoutine: (d) => { lastRoutine = d; },
      setTab: (t) => { navTab = t; },
      persist: async () => {},
      syncWorkoutRoutineNames: () => {},
      addExToDraft: () => {},
      toast: () => {},
    });
    baseState.activeModal = { type: 'routine', mode: 'create', name: '', sub: '', color: '#3B82F6' };
    await modal.saveRoutineModal({ name: 'Full Body', sub: 'Extra', color: '#3B82F6' });
    expect(baseState.planRoutine).toBe('Full Body');
    expect(baseState.planTargetRoutine).toBe('Full Body');

    baseState.activeModal = { type: 'routine', mode: 'edit', oldName: 'Full Body', name: 'Full Body', sub: '', color: '#3B82F6' };
    await modal.saveRoutineModal({ name: 'Brazos', sub: '', color: '#3B82F6' });
    expect(baseState.planRoutine).toBe('Brazos');
    expect(baseState.planTargetRoutine).toBe('Brazos');

    const edits = createRoutineEditActions({
      getState: () => baseState,
      getLastRoutine: () => lastRoutine,
      setLastRoutine: (d) => { lastRoutine = d; },
      persist: async () => {},
      render: () => {},
      syncWorkoutRoutineNames: () => {},
      askConfirm: async () => true,
      toast: () => {},
    });
    await edits.removeRoutineDay('Brazos');
    expect(baseState.planRoutine).toBe('Torso A');
    expect(baseState.planTargetRoutine).toBe('Torso A');
  });

  it('unifica añadir ejercicio en modal con búsqueda NFD multi-músculo y retira catálogo rápido', () => {
    const settings = sanitizeSettings({});
    const state: State = {
      tab: 'plan',
      planTab: 'routines',
      planRoutine: 'Push',
      strength: [],
      cardio: [],
      measures: [],
      wellbeing: [],
      settings,
      analysis: analyze([], settings),
      sel: {},
      perimeter: 'waist',
      muscleSel: 'Pecho',
    };

    // 1. PlanView solo muestra un botón "+ Añadir ejercicio" y "Simulador de volumen semanal" sin "Catálogo rápido"
    const planHtml = renderToString(h(PlanView, { state }));
    expect(planHtml).toContain('+ Añadir ejercicio');
    expect(planHtml).not.toContain('+ Añadir fila');
    expect(planHtml).not.toContain('> + Crear ejercicio<');
    expect(planHtml).not.toContain('+ Crear ejercicio');
    expect(planHtml).not.toContain('Catálogo rápido');
    expect(planHtml).toContain('Simulador de volumen semanal');

    // 2. Búsqueda sin tildes/mayúsculas y filtro multi-músculo priorizando primarios
    const noAccents = getPlanCatalogData(state, { query: 'BICEPS' });
    expect(noAccents.items.some((i) => i.name.includes('bíceps'))).toBe(true);

    const multi = getPlanCatalogData(state, { muscles: ['Pecho', 'Tríceps'] });
    expect(multi.items.length).toBeGreaterThan(0);
    expect(multi.items.every((i) => ['Pecho', 'Tríceps'].includes(i.primary ?? '') || i.secondary.some((s) => s === 'Pecho' || s === 'Tríceps'))).toBe(true);
    expect(['Pecho', 'Tríceps']).toContain(multi.items[0]?.primary);

    // 3. ModalHost renderiza AddRoutineExerciseModal completo con "En rutina" y nota de crear ejercicio
    const pickerHtml = renderToString(
      h(ModalHost, { state: { ...state, activeModal: { type: 'routineExercisePicker', routine: 'Push' } } }),
    );
    expect(pickerHtml).toContain('id="add-routine-ex-modal"');
    expect(pickerHtml).toContain('Añadir ejercicio a Push');
    expect(pickerHtml).toContain('id="planExSearch"');
    expect(pickerHtml).toContain('id="planCatalogCount" aria-live="polite"');
    expect(pickerHtml).toContain('aria-label="Filtrar por grupos musculares"');
    expect(pickerHtml).toContain('Añadido');
    expect(pickerHtml).toContain('Quitar');
    expect(pickerHtml).toContain('¿No encuentras el ejercicio?');
    expect(pickerHtml).toContain('+ Crear ejercicio');
    expect(pickerHtml).not.toMatch(/class="[^"]*\b(?:btn|btn-primary|inp|inp-stepper|tab)\b[^"]*!/);

    // 4. ExerciseModal pre-rellena initialName heredado desde el buscador
    const createHtml = renderToString(
      h(ModalHost, { state: { ...state, activeModal: { type: 'exercise', routine: 'Push', initialName: 'Remo Gironda' } } }),
    );
    expect(createHtml).toContain('id="newExName"');
    expect(createHtml).toContain('value="Remo Gironda"');

    // 5. Acciones openRoutineExercisePicker y openExerciseModal({ initialName })
    const actions = createPlanActions({
      getState: () => state,
      getLastRoutine: () => 'Push',
      setLastRoutine: () => {},
      persist: async () => {},
      render: () => {},
      setTab: () => {},
      navigateTab: () => {},
      syncWorkoutRoutineNames: () => {},
      addExToDraft: () => {},
      askConfirm: async () => true,
      toast: () => {},
      startWorkoutDay: async () => {},
      openLogDay: async () => {},
      runAiAnalysis: () => {},
      retryAiAnalysis: () => {},
      dismissAiJob: () => {},
      openWizard: () => {},
      closeModal: () => {},
    });
    actions.openRoutineExercisePicker('Pull');
    expect(state.activeModal).toEqual({ type: 'routineExercisePicker', routine: 'Pull' });
    actions.openExerciseModal({ routine: 'Pull', initialName: 'Remo Gironda' });
    expect(state.activeModal).toEqual({ type: 'exercise', routine: 'Pull', initialName: 'Remo Gironda' });
  });

  it('bloque 1: preserva RIR, evita duplicados, valida modales inline, avisa en borrado activo y eleva ToastBanner', async () => {
    // 1. ToastBanner z-[60] y SwUpdateBanner z-[55]
    const toastHtml = renderToString(h(ToastBanner, { message: 'Ok' }));
    const swHtml = renderToString(h(SwUpdateBanner, { visible: true, onDismiss: () => {}, onReload: () => {} }));
    expect(toastHtml).toContain('z-[60]');
    expect(swHtml).toContain('z-[55]');

    // 2. WizardModal muestra error inline role="alert" cuando draft.error está presente
    const settings = sanitizeSettings({});
    const dupSettings = sanitizeSettings({
      routines: {
        ...settings.routines,
        Push: [
          { name: 'Press de banca', sets: 3, reps: 10 },
          { name: 'Press de banca', sets: 3, reps: 10 },
        ],
      },
    });
    const state: State = {
      tab: 'Push',
      strength: [
        {
          id: 's-rir',
          sessionId: 'manual:2026-11-20:Push',
          ts: Date.parse('2026-11-20T18:00:00Z'),
          date: '2026-11-20',
          ref: 'name:Press de banca',
          day: 'Push',
          sets: [{ w: 80, r: 8, rir: 2, restSec: 120 }],
        },
      ],
      cardio: [],
      measures: [],
      wellbeing: [],
      settings: dupSettings,
      analysis: analyze(
        [{ id: 's-rir', sessionId: 'manual:2026-11-20:Push', ts: 1, date: '2026-11-20', ref: 'name:Press de banca', day: 'Push', sets: [{ w: 80, r: 8, rir: 2 }] }],
        dupSettings,
      ),
      sel: { Push: 'Press de banca' },
      dayExtra: { Push: true },
      ranges: { Push: '3M' },
      customRanges: { Push: { from: '2026-10-01' } },
      perimeter: 'waist',
      muscleSel: 'Pecho',
    };

    // initLogDraft conserva s.rir y no duplica ejercicios repetidos en rutina
    const draft = initLogDraft(state, 'Push', '2026-11-20');
    expect(draft.exercises.filter((e) => norm(e.name) === norm('Press de banca'))).toHaveLength(1);
    expect(draft.exercises[0]?.sets[0]?.rir).toBe(2);
    expect(state.analysis.byDay.Push?.filter((e) => norm(e.name) === norm('Press de banca'))).toHaveLength(1);

    const wizErrHtml = renderToString(
      h(WizardModal, {
        draft: { ...createWizardDraft(state), error: 'Introduce una edad válida (12–110 años).' },
        onPatch: () => {},
        onBack: () => {},
        onSubmitStep: () => {},
        onSkip: () => {},
      }),
    );
    expect(wizErrHtml).toContain('role="alert"');
    expect(wizErrHtml).toContain('Introduce una edad válida');

    // 3. RoutineEdit: impedir duplicados + quitar por nombre + aviso en confirmación si hay entreno activo
    const toasts: string[] = [];
    const confirms: { title: string; message: string }[] = [];
    state.liveWorkout = initLiveWorkout(state, 'Push');
    state.logDraft = initLogDraft(state, 'Push', '2026-11-21');
    const launch = createWorkoutLaunchActions({
      getState: () => state,
      setTab: (t) => { state.tab = t; },
      render: () => {},
      saveDraft: (d) => { state.logDraft = d; },
      saveLive: (l) => { state.liveWorkout = l; },
      askConfirm: async () => true,
    });
    const edits = createRoutineEditActions({
      getState: () => state,
      getLastRoutine: () => 'Push',
      setLastRoutine: () => {},
      persist: async () => {},
      render: () => {},
      syncWorkoutRoutineNames: launch.syncWorkoutRoutineNames,
      askConfirm: async (opts) => {
        confirms.push({ title: opts.title, message: opts.message });
        return false;
      },
      toast: (m) => { toasts.push(m); },
    });

    await edits.quickAddToRoutine('Push', 'Press de banca');
    expect(toasts.at(-1)).toContain('ya está en Push');
    await edits.removeRoutineExByName('Push', 'Press de banca');
    expect(state.settings.routines.Push).toHaveLength(0);
    await edits.quickAddToRoutine('Push', 'Press de banca');
    await edits.quickAddToRoutine('Push', 'Fondos');
    await edits.changeRoutineExName('Push', 1, 'Press de banca');
    expect(state.settings.routines.Push[1]?.name).toBe('Fondos');
    expect(toasts.at(-1)).toContain('ya está en Push');

    // Aviso en confirmación al borrar rutina o aplicar plantilla con entreno activo
    await edits.removeRoutineDay('Push');
    expect(confirms.at(-1)?.message).toContain('Tienes un entreno o borrador activo de "Push"');
    await edits.applyTemplate('upperLower');
    expect(confirms.at(-1)?.message).toContain('pasará a modo «Libre»');

    // syncWorkoutRoutineNames() sin args pasa tanto liveWorkout como logDraft huérfanos a 'Libre'
    const { Push: _removed, ...restRoutines } = state.settings.routines;
    state.settings = { ...state.settings, routines: restRoutines };
    launch.syncWorkoutRoutineNames();
    expect(state.liveWorkout?.day).toBe('Libre');
    expect(state.logDraft?.day).toBe('Libre');

    // 4. saveRoutineModal / saveExerciseModal validan inline y renombra settings ANTES de setTab
    let validDuringSetTab = false;
    const modal = createPlanModalActions({
      getState: () => state,
      getLastRoutine: () => 'Pull',
      setLastRoutine: () => {},
      setTab: (t) => {
        validDuringSetTab = isValidTab(state, t);
        state.tab = t;
      },
      persist: async () => {},
      syncWorkoutRoutineNames: launch.syncWorkoutRoutineNames,
      addExToDraft: () => {},
      toast: (m) => { toasts.push(m); },
    });
    state.tab = 'Pull';
    state.sel.Pull = 'Jalones al pecho';
    state.dayExtra = { Pull: true };
    state.ranges = { Pull: '6M' };
    state.customRanges = { Pull: { from: '2026-06-01' } };
    state.activeModal = { type: 'routine', mode: 'edit', oldName: 'Pull', name: 'Pull', sub: '', color: '#3B82F6' };

    const dupErr = await modal.saveRoutineModal({ name: 'Leg', sub: '', color: '#3B82F6' });
    expect(dupErr).toContain('Ya existe');
    const resErr = await modal.saveRoutineModal({ name: 'plan', sub: '', color: '#3B82F6' });
    expect(resErr).toContain('reservado');
    const okErr = await modal.saveRoutineModal({ name: 'Tirón Pro', sub: 'Espalda', color: '#3B82F6' });
    expect(okErr).toBeUndefined();
    expect(validDuringSetTab).toBe(true);
    expect(state.tab).toBe('Tirón Pro');
    expect(state.sel['Tirón Pro']).toBe('Jalones al pecho');
    expect(state.dayExtra?.['Tirón Pro']).toBe(true);
    expect(state.ranges?.['Tirón Pro']).toBe('6M');
    expect(state.customRanges?.['Tirón Pro']).toEqual({ from: '2026-06-01' });

    state.activeModal = { type: 'exercise', routine: 'Leg' };
    const exErr = await modal.saveExerciseModal({ name: 'Press de banca', primary: 'Pecho', secondary: [], sets: 3, reps: 10, routine: 'Leg' });
    expect(exErr).toContain('Ya existe');
  });
});
