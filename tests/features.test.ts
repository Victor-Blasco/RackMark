import { h } from 'preact';
import renderToString from 'preact-render-to-string';
import { describe, expect, it, vi } from 'vitest';
import type { ChartConfiguration } from 'chart.js';
import { buildPayload, buildPrompt } from '../src/lib/ai';
import { analyze, describeStatus, effectiveMuscleCredits, findAnalyzedExercise, isoWeekStart, judge, musclesOf, weeklyVolume } from '../src/lib/analysis';
import { parseBackup, sanitizeSettings } from '../src/lib/db';
import { ACTIVITY_OPTIONS, NUTRITION_PHASES, calculateNutrition, recommendActivityFactor } from '../src/lib/nutrition';
import { importSamsungInWorker } from '../src/lib/samsung';
import { CATALOG_EXERCISES, DEFAULT_MUSCLES, DEFAULT_SETTINGS, ROUTINE_COLORS, daysAgoIso, diffIsoDays, norm, parseDecimal } from '../src/lib/seed';
import { AiInsightBanner } from '../src/components/common/AiInsightBanner';
import { ToastBanner, SwUpdateBanner } from '../src/components/common/ToastBanner';
import { AiCoachPanel } from '../src/components/home/AiCoachPanel';
import { MobileHeader } from '../src/components/layout/MobileHeader';
import { MobileBottomNav } from '../src/components/layout/MobileNav';
import { Sidebar } from '../src/components/layout/Sidebar';
import { ModalHost } from '../src/components/modals/ModalHost';
import { WizardModal } from '../src/components/modals/WizardModal';
import { PlanCatalogList } from '../src/components/plan/PlanCatalogList';
import { PlanSidebarWidgets } from '../src/components/plan/PlanSidebarWidgets';
import { ChartCanvas } from '../src/components/common/ChartCanvas';
import { RangePicker } from '../src/components/common/RangePicker';
import { DayMobileAccordion } from '../src/components/day/DayMobileAccordion';
import { DayOrganizeBar } from '../src/components/day/DayOrganizeBar';
import { ExercisePickerSheet } from '../src/components/workout/ExercisePickerSheet';
import { LiveExerciseMenu } from '../src/components/workout/LiveExerciseMenu';
import { LiveHeader } from '../src/components/workout/LiveHeader';
import { PrevCompletedBanner } from '../src/components/workout/LiveStatusBanners';
import { RestTimerBar } from '../src/components/workout/RestTimerBar';
import { fmtMMSS } from '../src/ui/restAudio';
import { buildAdherenceCalendarData, buildMonthGrid } from '../src/store/adherenceCalendar';
import { buildAdherenceViewModel } from '../src/store/adherenceSelectors';
import { buildCompChartConfig, buildPerimChartConfig } from '../src/store/bodyChartConfigs';
import { buildCalcViewModel } from '../src/store/calcSelectors';
import { createCatalogMapActions } from '../src/store/catalogMapActions';
import { allExerciseNames, extractTargetWeight, manualSessionId, quickExSuggestions } from '../src/store/exerciseCatalog';
import { buildBodyViewModel } from '../src/store/bodySelectors';
import { buildBodyHomeChartConfig, buildHomeExChartConfig, exerciseChartConfig, filterExByRange } from '../src/store/homeChartConfigs';
import { buildDayRoutineViewModel } from '../src/store/daySelectors';
import { buildHomeViewModel } from '../src/store/homeSelectors';
import { createLogHistoryActions } from '../src/store/logHistoryActions';
import { createLogInputActions } from '../src/store/logInputActions';
import { initLogDraft } from '../src/store/logSelectors';
import { createLogSetActions } from '../src/store/logSetActions';
import { activeTabTitle, isValidTab, syncStatusInfo } from '../src/store/navigation';
import { createPlanActions } from '../src/store/planActions';
import { createPlanFilterActions } from '../src/store/planFilterActions';
import { createPlanModalActions } from '../src/store/planModalActions';
import { getPlanCatalogData, plannedWeeklyVolume } from '../src/store/planSelectors';
import { createProfileActions } from '../src/store/profileActions';
import { createRoutineEditActions } from '../src/store/routineEditActions';
import { applyRoutineTemplateToState } from '../src/store/routineTemplate';
import { buildWorkoutSummary } from '../src/store/sessionPersistence';
import { buildVolumeViewModel, volumeRangeForProfile, weeksForBounds } from '../src/store/volumeSelectors';
import {
  createWizardDraft,
  daysActivityFactor,
  goalCalorieDelta,
  goalPhaseName,
  recommendTemplate,
} from '../src/store/wizardSelectors';
import { createLiveWorkoutActions } from '../src/store/workoutActions';
import { createWorkoutLaunchActions } from '../src/store/workoutLaunchActions';
import { createWorkoutPickerActions } from '../src/store/workoutPickerActions';
import { createWorkoutRestActions } from '../src/store/workoutRestActions';
import { buildExerciseCompletionSummary, initLiveWorkout } from '../src/store/workoutSelectors';
import { applyToggleLiveSet } from '../src/store/workoutSetToggle';
import { createWorkoutSetActions } from '../src/store/workoutSetActions';
import { ICON_PATHS } from '../src/ui/icons';
import { captureFlipRects, moveItem, playFlipRects } from '../src/ui/reorder';
import { filterSelectionOptions, groupSelectionOptions, normalizeSelectionText, sortRecentSelectionOptions } from '../src/ui/selection';
import { normalizeChartConfig } from '../src/ui/charts';
import {
  DAY_COLOR,
  findAiExercise,
  humanizeError,
  inRange,
  isAiFreshForEx,
  movingAverage7d,
  movingAverage7dFor,
  resolveRange,
  routineColor,
  routineShort,
  todayIso,
  weightDeltaColor,
  type State,
} from '../src/ui/shared';
import { applyTheme, resolveEffectiveTheme } from '../src/ui/theme';
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

    expect(payload.volumen_semanal?.series_efectivas_semana['Pecho']).toBeGreaterThan(0);
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
    const verdict = judge([
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
      planRoutine: 'Torso',
      activeModal: { type: 'note', exName: 'Press Banca X', value: 'Pausa 1s abajo' },
    };

    const planHtml = renderToString(h(PlanView, { state: { ...state, planTab: 'routines' } }));
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
    expect(pickerHtml).toContain('Sentadilla hack');

    const exerciseMapHtml = renderToString(h(PlanView, { state: { ...state, tab: 'plan', planTab: 'exercises' } }));
    expect(exerciseMapHtml).toContain('min-w-0 space-y-3');
    expect(exerciseMapHtml).not.toContain('space-y-3 overflow-x-auto');

    const emptyCatalog = getPlanCatalogData(state, { query: 'zzzznoexiste', routine: 'Torso' });
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
    expect(homeHtml).toContain('Tu progreso por ejercicio');
    expect(homeHtml).toContain('Torso');
    expect(homeHtml).toContain('Press Banca X');

    const volHtml = renderToString(h(VolumeView, { state }));
    expect(volHtml).toContain('sticky left-0');
    expect(volHtml).toContain('overflow-x-auto');

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
    expect(logHtml).toContain('flex items-center gap-1.5');
    expect(logHtml).toContain('flex-1 min-w-0');
    expect(logHtml).toContain('min-h-[44px]');
    expect(logHtml).not.toContain('!min-h-[44px]');
    expect(logHtml).toContain('min-w-[40px]');
    expect(logHtml).toContain('RIR · Desc.');
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
        ref: 'name:Press de banca',
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
    expect(step1Html).toContain(`aria-haspopup="menu" aria-expanded="false" aria-label="Opciones de ${ex0Name}"`);
    expect(step1Html).toContain('Añadir ejercicio');
    expect(step1Html).toContain('RIR · Desc.');
    expect(step1Html).toContain('+ Nota');
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
    expect(menuHtml).toContain('Obj 3×10');
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
    expect(step2Html).toContain(`${ex0Name} completado`);
    expect(step2Html).toContain('+ Serie extra');

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
      const cat = getPlanCatalogData(state, { query: search });
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
    expect(byName.listHtml).toContain('Sentadilla hack');
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
        ref: 'name:Press de banca',
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
    expect('info' in ICON_PATHS).toBe(true);

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
    expect(activeTabTitle({ ...state, tab: 'desconocida' })).toBe('RackMark');
    expect(syncStatusInfo(state, false, true).text).toBe('En este dispositivo');
    const sidebarHtml = renderToString(
      h(Sidebar, {
        state,
        statsText: 'sin datos',
        liveCount: 0,
        draftCount: 0,
        unsynced: false,
        onSelectTab: () => {},
        onCloudLogin: () => {},
      }),
    );
    expect(sidebarHtml).toContain('bg-navDark');
    expect(sidebarHtml).toContain('RackMark');
    expect(sidebarHtml).toContain('src="/logo.svg"');
    const mobHead = renderToString(
      h(MobileHeader, {
        state,
        statsText: 'sin datos',
        unsynced: false,
        onSelectTab: () => {},
        onCloudLogin: () => {},
      }),
    );
    expect(mobHead).not.toContain('<h1');
    expect(mobHead).toContain('src="/logo.svg"');
    expect(mobHead).toContain('<p class="truncate text-sm font-extrabold leading-tight text-white">');
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
    expect(logHtml).toContain('text-base font-semibold tabular-nums');
    expect(logHtml).toContain('h-11 rounded-md px-1.5 py-0 text-center text-xs font-semibold tabular-nums');
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
    expect(homeHtml).toContain('+ Empezar entreno en vivo');
    expect(homeHtml).toContain('<span>Push</span>');

    const dayHtml = renderToString(h(DayRoutineView, { day: 'Push', state: emptyState }));
    expect(dayHtml).toContain('Press de banca');
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
        ref: 'name:Press de banca',
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
    expect(homeWithAi).toContain('<h2 class="text-base font-bold text-white">Tu progreso por ejercicio</h2>');
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
    expect(liveHtml).toContain('inp-stepper border-white/15 bg-transparent text-base min-h-[48px] sm:min-h-[44px] min-w-[40px] min-[390px]:min-w-[52px]');
    expect(liveHtml).toContain('min-h-[48px] min-w-[48px]');
    expect(liveHtml).not.toMatch(/class="[^"]*\b(?:btn|btn-primary|inp|inp-stepper|tab)\b[^"]*!/);
    expect(liveHtml.match(/![a-zA-Z0-9-[\]]+/g)).toBeNull();

    const logHtml = renderToString(h(LogWorkoutView, { state: { ...state, tab: 'log', logDraft: initLogDraft(state, 'Push', '2026-11-15') } }));
    expect(logHtml).toContain('inp-stepper min-h-[44px]');
    expect(logHtml).toContain('btn btn-accent');
    expect(logHtml).toContain('<h1');
    expect(logHtml).not.toMatch(/class="[^"]*\b(?:btn|btn-primary|inp|inp-stepper|tab)\b[^"]*!/);

    const planHtml = renderToString(h(PlanView, { state: { ...state, tab: 'plan', planTab: 'routines' } }));
    const planExHtml = renderToString(h(PlanView, { state: { ...state, tab: 'plan', planTab: 'exercises' } }));
    const bodyHtml = renderToString(h(BodyView, { state: { ...state, tab: 'body' } }));
    const pickerHtml = renderToString(h(RangePicker, { active: 'Custom', custom: {} }));
    expect(planHtml).toContain('<h1');
    expect(bodyHtml).toContain('<h1');
    expect(bodyHtml).toContain('sticky left-0 z-10 bg-bgDark');
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
    expect(mobHtml.indexOf('En este dispositivo')).toBeLessThan(mobHtml.indexOf('18 ses.'));

    // Prioridad 7 & 8 & 10: Log RIR cabecera desktop, singular "1 serie", DataView inputs estilizados y aria-live en Plan
    const logDraft = initLogDraft(state, 'Push', '2026-11-15');
    logDraft.exercises = [{ name: 'Press de banca', note: '', done: true, sets: [{ w: 80, r: 8, done: true }] }];
    const logHtml = renderToString(h(LogWorkoutView, { state: { ...state, tab: 'log', logDraft } }));
    expect(logHtml).toContain('RIR</span>');
    expect(logHtml).toContain('Reps que te guardaste sin llegar al fallo');
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

    // 7. Animaciones colapsables presentes en MeasureForm (abierto cuando se edita) y DayRoutineView
    const bodyHtml = renderToString(h(BodyView, { state: { ...baseState, measureDate: '2026-11-15' } }));
    expect(bodyHtml).toContain('grid-rows-[0fr]');

    // 8. Gráfica de cargas sin e1RM ni switch, con leyenda Peso máx + Kilos totales y tooltip mínimo
    const chartCfg = exerciseChartConfig(
      [{ date: '2026-10-21', sets: [{ w: 25, r: 12 }, { w: 27.5, r: 6 }], top: 27.5, repsAtTop: 6, volume: 465, e1rm: 33, avgHr: 132, maxHr: 159 }],
      '#3B82F6',
    );
    expect(chartCfg.data.datasets.map((d) => d.label)).toEqual(['Peso máx (kg)', 'Kilos totales (kg)']);
    expect(chartCfg.data.datasets.map((d) => (d as { yAxisID?: string }).yAxisID)).toEqual(['y', 'y1']);
    const tipCb = (chartCfg.options?.plugins?.tooltip as { callbacks?: { label?: (c: { dataIndex: number; datasetIndex: number }) => string; afterBody?: (items: { dataIndex: number }[]) => string[] } })?.callbacks;
    expect(tipCb?.label?.({ dataIndex: 0, datasetIndex: 0 })).toBe('Peso máx: 27,5 kg');
    expect(tipCb?.label?.({ dataIndex: 0, datasetIndex: 1 })).toBe('Kilos totales: 465 kg');
    const tipExtra = tipCb?.afterBody?.([{ dataIndex: 0 }]) ?? [];
    expect(tipExtra).toEqual(['Series: 25×12 · 27,5×6']);
    expect(tipExtra.join(' ')).not.toContain('e1RM');
    expect(tipExtra.join(' ')).not.toContain('FC media');

    const cleanHomeHtml = renderToString(h(HomeView, { state: baseState }));
    expect(cleanHomeHtml).not.toContain('e1RM');
    expect(cleanHomeHtml).not.toContain('Métrica de progresión');
    const cleanDayHtml = renderToString(h(DayRoutineView, { day: 'Push', state: baseState }));
    expect(cleanDayHtml).not.toContain('e1RM');
    expect(cleanDayHtml).toContain('Kilos totales máx');
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
    expect(navRoutineHtml).toContain('grid-cols-4');
    expect(navRoutineHtml).not.toContain('Rutinas · Plan');
    expect(navRoutineHtml).not.toContain('<span>Plan</span>');
    expect(navRoutineHtml).toContain('<span>Rutinas</span>');
    const idxResumen = navRoutineHtml.indexOf('<span>Resumen</span>');
    const idxRutinas = navRoutineHtml.indexOf('<span>Rutinas</span>');
    const idxEntrenar = navRoutineHtml.indexOf('>Entrenar</span>');
    const idxAnalisis = navRoutineHtml.indexOf('<span>Análisis</span>');
    expect(idxResumen).toBeLessThan(idxRutinas);
    expect(idxRutinas).toBeLessThan(idxEntrenar);
    expect(idxEntrenar).toBeLessThan(idxAnalisis);
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
    expect(navPlanHtml).toMatch(/bnav-item bnav-item-on[^>]*>.*?<span>Rutinas<\/span>/s);

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
    expect(headPlan).not.toContain('>Rutinas<');
    expect(headPlan).toContain('Catálogo');
    expect(headPlan).toContain('Fases');
    expect(headPlan).toContain('grid-cols-2');

    // 3. Sidebar: rutinas + "+ Nueva rutina" y herramientas (Catálogo y Fases) sin duplicar Editor de rutinas
    const sideHtml = renderToString(
      h(Sidebar, {
        state: { ...baseState, tab: 'plan', planTab: 'phases' },
        statsText: 'sin datos',
        liveCount: 0,
        draftCount: 0,
        unsynced: false,
        onSelectTab: () => {},
        onSelectPlanTab: () => {},
        onNewRoutine: () => {},
        onCloudLogin: () => {},
      }),
    );
    expect(sideHtml).not.toContain('Plan y rutinas');
    expect(sideHtml).not.toContain('Editor de rutinas');
    expect(sideHtml).toContain('+ Nueva rutina');
    expect(sideHtml).toContain('Catálogo y músculos');
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

    filter.openPlanTab('phases');
    expect(navTab).toBe('plan');
    expect(baseState.planTab).toBe('phases');

    filter.openRoutineInPlan('Pull');
    expect(navTab).toBe('plan');
    expect(baseState.planTab).toBe('routines');
    expect(baseState.planRoutine).toBe('Pull');

    applyRoutineTemplateToState(baseState, 'upperLower', () => lastRoutine, (d) => { lastRoutine = d; }, () => {});
    expect(baseState.planRoutine).toBe('Torso A');

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

    baseState.activeModal = { type: 'routine', mode: 'edit', oldName: 'Full Body', name: 'Full Body', sub: '', color: '#3B82F6' };
    await modal.saveRoutineModal({ name: 'Brazos', sub: '', color: '#3B82F6' });
    expect(baseState.planRoutine).toBe('Brazos');

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
    const planHtml = renderToString(h(PlanView, { state: { ...state, planTab: 'routines' } }));
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

  it('corrige Bloque 2: reduced-motion, contraste AA, overflow responsive, tactilidad y decimales en español', () => {
    // 1. normalizeChartConfig prioriza prefers-reduced-motion sobre opts.animation explícita
    const prevWindow = (globalThis as { window?: unknown }).window;
    try {
      (globalThis as { window?: unknown }).window = { matchMedia: () => ({ matches: true }) };
      const reduced = normalizeChartConfig({
        type: 'line',
        data: { labels: ['01/11'], datasets: [{ label: 'Peso', data: [75] }] },
        options: { animation: { duration: 150 } },
      });
      expect((reduced.options as Record<string, unknown>).animation).toBe(false);
    } finally {
      if (prevWindow === undefined) delete (globalThis as { window?: unknown }).window;
      else (globalThis as { window?: unknown }).window = prevWindow;
    }

    const settings = sanitizeSettings({
      routines: {
        Push: [{ name: 'Press de banca', sets: 3, reps: 8 }],
      },
      profile: { sex: 'hombre', age: 29, height: 178 },
    });
    const sessionDay = todayIso();
    const strength = [
      { id: 's1', sessionId: `${sessionDay}_Push`, ts: 1763720000000, ref: 'name:Press de banca', date: sessionDay, day: 'Push', ex: 'Press de banca', sets: [{ w: 80, r: 8, done: true }] },
    ];
    const measures = [{ date: sessionDay, weight: 76 }];
    const base: State = {
      tab: 'adherence',
      strength,
      cardio: [{ id: 'c1', ts: 1763720000000, date: sessionDay, type: 1, distKm: 5.2, durMin: 30, avgHr: 145, kcal: 320, vo2: 49 }],
      measures,
      wellbeing: [],
      settings,
      analysis: analyze(strength, settings),
      sel: {},
      perimeter: 'arms',
      muscleSel: 'Pecho',
      ranges: { home: 'Todo', body: 'Todo', volume: 'Todo', adherence: 'Todo' },
    };

    // 2. Adherencia con relleno tintado + borde AA, lista móvil cardio y sin text-gray-500
    const adhHtml = renderToString(h(AdherenceView, { state: base }));
    expect(adhHtml).not.toContain('text-gray-500');
    expect(adhHtml).toContain('border-2 text-white font-extrabold');
    expect(adhHtml).toContain('2b;border-color:');
    expect(adhHtml).toContain('divide-y divide-white/10');
    expect(adhHtml).toContain('aria-label="Filtrar sesiones recientes"');

    // 3. Plan → Ejercicios: sin text-gray-500, selects con max-w-full, filtros lg:sticky y chips >= 44px
    const planExHtml = renderToString(h(PlanView, { state: { ...base, tab: 'plan', planTab: 'exercises' } }));
    expect(planExHtml).not.toContain('text-gray-500');
    expect(planExHtml).toContain('max-w-full items-center justify-between');
    expect(planExHtml).toContain('lg:sticky lg:top-0 lg:z-10');
    expect(planExHtml).toContain('min-h-[44px] sm:min-h-[34px]');

    const pickerHtml = renderToString(h(ModalHost, { state: { ...base, activeModal: { type: 'routineExercisePicker', routine: 'Push' } } }));
    expect(pickerHtml).toContain('min-h-[44px] sm:min-h-[32px]');
    const exModalHtml = renderToString(h(ModalHost, { state: { ...base, activeModal: { type: 'exercise', routine: 'Push' } } }));
    expect(exModalHtml).toContain('min-h-[44px] sm:min-h-[32px]');

    // 4. Overflow responsive: Cuerpo (sticky + acordeón móvil), Volumen (sticky + overflow-x-auto), Registrar hecho (2xl:grid-cols-2)
    const bodyHtml = renderToString(h(BodyView, { state: { ...base, tab: 'body' } }));
    expect(bodyHtml).toContain('w-20 pl-2 whitespace-nowrap"><span class="sr-only">Acciones</span>');

    const volHtml = renderToString(h(VolumeView, { state: { ...base, tab: 'volume' } }));
    expect(volHtml).toContain('overflow-x-auto');
    expect(volHtml).toContain('sticky left-0');

    const logHtml = renderToString(h(LogWorkoutView, { state: { ...base, tab: 'log', logDraft: initLogDraft(base, 'Push', sessionDay) } }));
    expect(logHtml).toContain('2xl:grid-cols-2');

    // 5. En vivo: botones de 44px reales (sin max-[380px]:w-9), note min-h-[44px], presets min-w-[44px]
    const live = initLiveWorkout(base, 'Push');
    const liveHtml = renderToString(h(LiveWorkoutView, { state: { ...base, tab: 'workout', liveWorkout: live } }));
    expect(liveHtml).not.toContain('max-[380px]:w-9');
    expect(liveHtml).toContain('w-full min-h-[44px] rounded-sm border-b');
    expect(liveHtml).toContain('min-h-[44px] min-w-[44px]');

    // 6. Calculadoras con comas españolas y inputs alineados
    const calcHtml = renderToString(h(CalcView, { state: { ...base, tab: 'calc' } }));
    expect(calcHtml).toContain('grid-cols-3 items-stretch gap-3');
    expect(calcHtml).toContain('×1,55');
    expect(calcHtml).toMatch(/\d+,\d{2}×/);

    // 7. Estado vacío accionable en LoadControlSection, HomeHeroStrip sin truncate, DayRoutine whitespace-nowrap, Profile responsive, Data btn-danger, MobileHeader navDark, icono login Phosphor relleno
    const emptyAnalysis = analyze([], { ...settings, routines: {} });
    const homeEmptyHtml = renderToString(h(HomeView, { state: { ...base, tab: 'home', strength: [], analysis: emptyAnalysis, settings: { ...settings, routines: {} } } }));
    expect(homeEmptyHtml).toContain('+ Registrar primer entreno');

    const homeHtml = renderToString(h(HomeView, { state: { ...base, tab: 'home' } }));
    expect(homeHtml).toContain('flex flex-wrap items-baseline gap-x-1.5 text-lg sm:text-xl font-extrabold text-white');

    const dayHtml = renderToString(h(DayRoutineView, { day: 'Push', state: { ...base, tab: 'Push' } }));
    expect(dayHtml).toContain('whitespace-nowrap');

    const settingsHtml = renderToString(h(SettingsView, { state: { ...base, tab: 'settings' } }));
    expect(settingsHtml).not.toContain('<div class="grid grid-cols-3 gap-3">');

    const dataHtml = renderToString(h(DataView, { state: { ...base, tab: 'data' } }));
    expect(dataHtml).toContain('class="btn btn-danger"');

    const headerHtml = renderToString(h(MobileHeader, { state: { ...base, tab: 'home', authReady: true }, statsText: '1 sesion', unsynced: false, onSelectTab: () => {}, onCloudLogin: () => {} }));
    expect(headerHtml).toContain('bg-navDark');
    expect(ICON_PATHS.login).not.toContain('stroke=');

    const wizHtml = renderToString(h(WizardModal, { draft: createWizardDraft(base), onPatch: () => {}, onBack: () => {}, onSubmitStep: () => {}, onSkip: () => {} }));
    expect(wizHtml).toContain('placeholder="Ej. 72,5"');
  });
});

describe('Bloque 3: analítica, peso corporal, alias, calculadora e IA', () => {
  it('protege mergeExercises contra ciclos, migra rutinas/notas/borradores y resuelve alias en allExerciseNames', async () => {
    const settings = sanitizeSettings({
      routines: { Push: [{ name: 'Press máquina viejo', sets: 3, reps: 10 }, { name: 'Fondos', sets: 3, reps: 12 }] },
      notes: { 'Press máquina viejo': 'Asiento nivel 4' },
    });
    const toasts: string[] = [];
    const state: State = {
      tab: 'plan',
      strength: [],
      cardio: [],
      measures: [],
      wellbeing: [],
      settings,
      analysis: analyze([], settings),
      sel: {},
      perimeter: 'arms',
      muscleSel: 'Pecho',
      liveWorkout: {
        date: '2026-11-20',
        day: 'Push',
        startedAt: 1000,
        curIdx: 0,
        targetRestSec: 90,
        exercises: [{ name: 'Press máquina viejo', done: false, sets: [{ w: 50, r: 10, done: false }], note: '' }],
      },
      logDraft: {
        date: '2026-11-20',
        day: 'Push',
        exercises: [{ name: 'Press máquina viejo', done: false, sets: [{ w: 50, r: 10, done: false }], note: '' }],
      },
    };
    const savedLive: unknown[] = [];
    const savedDrafts: unknown[] = [];
    const catActions = createCatalogMapActions({
      getState: () => state,
      persist: async () => {},
      askConfirm: async () => true,
      saveLive: (live) => { savedLive.push(live); },
      saveDraft: (draft) => { savedDrafts.push(draft); },
      toast: (m) => { toasts.push(m); },
    });

    await catActions.mergeExercises('Press máquina viejo', 'Press de banca');
    expect(state.settings.aliases['Press máquina viejo']).toBe('Press de banca');
    expect(state.settings.routines.Push.map((r) => r.name)).toEqual(['Press de banca', 'Fondos']);
    expect(state.settings.notes['Press de banca']).toBe('Asiento nivel 4');
    expect(state.settings.notes['Press máquina viejo']).toBeUndefined();
    expect(state.liveWorkout?.exercises[0].name).toBe('Press de banca');
    expect(state.logDraft?.exercises[0].name).toBe('Press de banca');
    expect(savedLive).toHaveLength(1);
    expect(savedDrafts).toHaveLength(1);
    expect(allExerciseNames(state)).not.toContain('Press máquina viejo');

    // Rechaza ciclo B -> A cuando A -> B existe
    await catActions.mergeExercises('Press de banca', 'Press máquina viejo');
    expect(state.settings.aliases['Press de banca']).toBeUndefined();
    expect(toasts.some((t) => /ciclo/i.test(t))).toBe(true);
  });

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

  it('protege restRef al reordenar/iniciar descansos, Deshacer y borrado de sesión, e incluye Libre e IA normalizada', async () => {
    const settings = sanitizeSettings({
      routines: { Push: [{ name: 'Press de banca', sets: 2, reps: 10 }] },
      ai: { date: '2026-11-20', summary: 'Ok', byExercise: { 'press de banca': { status: 'Subiendo' } } },
    });
    expect(findAiExercise(settings.ai, 'Press de banca')?.status).toBe('Subiendo');

    const rows = [
      { id: 'f1', sessionId: 's-libre', ts: 1000, date: todayIso(), ref: 'name:Paseo del granjero', sets: [{ w: 20, r: 15, done: true }] },
      { id: 'f2', sessionId: 's-otro', ts: 2000, date: todayIso(), ref: 'name:Press de banca', day: 'Push', sets: [{ w: 80, r: 8, done: true }] },
    ];
    const analysis = analyze(rows, settings);
    const payload = buildPayload(analysis, [], settings, [], []);
    expect((payload.ejercicios as Record<string, { dia?: string }>)['Paseo del granjero'].dia).toBe('Libre');

    const state: State = {
      tab: 'workout', strength: rows, cardio: [], measures: [], wellbeing: [],
      settings, analysis, sel: {}, perimeter: 'arms', muscleSel: 'Pecho',
      liveWorkout: {
        date: todayIso(), day: 'Push', startedAt: 12345, curIdx: 0, targetRestSec: 90,
        restStartedAt: Date.now() - 45000, restUntil: Date.now() + 45000, restRef: { ei: 0, si: 0 },
        pickerMode: 'add',
        exercises: [
          { name: 'Press de banca', done: true, note: '', sets: [{ w: 80, r: 10, done: true }, { w: 80, r: 10, done: false }] },
        ],
      },
    };
    const restActions = createWorkoutRestActions(() => state.liveWorkout, (l) => { state.liveWorkout = l; });
    restActions.startRest(60);
    // startRest sella primero el descanso previo de la serie 0
    expect(state.liveWorkout?.exercises[0].sets[0].restSec).toBeGreaterThanOrEqual(40);

    // Deshacer tras cambiar de sesión ya no inserta en otra sesión
    let undoFn: (() => void) | undefined;
    const setActions = createWorkoutSetActions(
      () => state.liveWorkout,
      () => {},
      (l) => { state.liveWorkout = l; },
      (_m, act) => { undoFn = act?.onAction; },
    );
    setActions.delSet(0, 1);
    expect(state.liveWorkout?.exercises[0].sets).toHaveLength(1);
    state.liveWorkout = { ...state.liveWorkout!, startedAt: 99999 };
    undoFn?.();
    expect(state.liveWorkout?.exercises[0].sets).toHaveLength(1);

    // Picker desplaza restRef al insertar por delante y canonicaliza
    state.liveWorkout = {
      ...state.liveWorkout!,
      curIdx: 0, pickerMode: 'add', restRef: { ei: 0, si: 0 },
      exercises: [{ name: 'Press de banca', done: false, note: '', sets: [{ w: 80, r: 10, done: false }] }],
    };
    const picker = createWorkoutPickerActions(() => state, () => state.liveWorkout, (l) => { state.liveWorkout = l; }, () => {});
    picker.pickExercise('  aperturas en máquina  ');
    expect(state.liveWorkout?.exercises[1].name).toBe('Aperturas en máquina');
    expect(state.liveWorkout?.restRef).toEqual({ ei: 0, si: 0 });
    state.liveWorkout = { ...state.liveWorkout!, curIdx: 0, pickerMode: 'swap', restRef: { ei: 0, si: 0 } };
    picker.pickExercise('Fondos en paralelas');
    expect(state.liveWorkout?.restRef).toBeUndefined();

    // logSetActions.delSet Deshacer ignora si cambió de sesión
    let logDraftState = initLogDraft(state, 'Push', todayIso(), 's-otro');
    let logUndo: (() => void) | undefined;
    const logSet = createLogSetActions(() => logDraftState, (d) => { if (d) logDraftState = d; }, (_m, a) => { logUndo = a?.onAction; });
    logSet.delSet(0, 0);
    // Forzamos cambio de borrador antes de Deshacer
    logDraftState = { ...logDraftState, date: '2026-10-01', sessionId: 'otra' };
    const lenAfterSwitch = logDraftState.exercises[0]?.sets.length ?? 0;
    logUndo?.();
    expect(logDraftState.exercises[0]?.sets.length ?? 0).toBe(lenAfterSwitch);

    // deleteHistorySession no borra filas de otra sesión de la misma fecha cuando sessionId no tiene match
    let deletedCalled = false;
    const histActions = createLogHistoryActions(
      {
        getState: () => state,
        commitDraft: (d) => { state.logDraft = d; },
        reload: async () => {},
        setTab: () => {},
        queueSync: () => {},
        toast: () => {},
        askConfirm: async () => { deletedCalled = true; return true; },
      },
      () => logDraftState,
      async () => true,
    );
    await histActions.deleteHistorySession('sid-inexistente', todayIso());
    expect(deletedCalled).toBe(false);
  });
});

describe('Bloque 4: selectores 50+, accesibilidad completa y limpieza', () => {
  it('reemplaza selectores 50+ nativos por modal buscador NFD y enriquece ExercisePickerSheet', () => {
    const settings = sanitizeSettings({});
    const strength = [
      { id: 's1', sessionId: 's1', ts: 1000, date: todayIso(), ref: 'name:Press de banca', day: 'Push', sets: [{ w: 80, r: 8, done: true }] },
    ];
    const base: State = {
      tab: 'plan',
      planTab: 'routines',
      planRoutine: 'Push',
      strength,
      cardio: [],
      measures: [{ date: todayIso(), weight: 75, bf: 15 }],
      wellbeing: [],
      settings,
      analysis: analyze(strength, settings),
      sel: {},
      perimeter: 'arms',
      muscleSel: 'Pecho',
    };

    // 1. PlanRoutinesTab ya no usa <select> por fila sino botón hacia modal buscador
    const planHtml = renderToString(h(PlanView, { state: base }));
    expect(planHtml).not.toContain('<select');
    expect(planHtml).toContain('Cambiar ejercicio 1 de Push');
    expect(planHtml).toContain('sr-only lg:not-sr-only lg:flex');

    const replaceModalHtml = renderToString(
      h(ModalHost, { state: { ...base, activeModal: { type: 'routineExercisePicker', routine: 'Push', replaceRowIdx: 0 } } }),
    );
    expect(replaceModalHtml).toContain('Cambiar ejercicio en Push');
    expect(replaceModalHtml).toContain('Elegir');

    // 2. Registrar hecho reemplaza <select id="logAddSelect"> y añadir rápido por botón único + Añadir ejercicio
    const logHtml = renderToString(
      h(LogWorkoutView, { state: { ...base, tab: 'log', logDraft: initLogDraft(base, 'Push', todayIso()) } }),
    );
    expect(logHtml).not.toContain('id="logAddSelect"');
    expect(logHtml).not.toContain('id="logNewExName"');
    expect(logHtml).toContain('+ Añadir ejercicio');

    const logModalHtml = renderToString(
      h(ModalHost, {
        state: {
          ...base,
          logDraft: initLogDraft(base, 'Push', todayIso()),
          activeModal: { type: 'logExercisePicker' },
        },
      }),
    );
    expect(logModalHtml).toContain('Añadir ejercicio a la sesión');

    // 3. ExercisePickerSheet filtra por músculo, incluye combobox ARIA, aria-activedescendant y estado vacío con consulta exacta
    const sheetByMuscle = renderToString(
      h(ExercisePickerSheet, {
        mode: 'swap',
        currentExName: 'Sentadilla',
        available: ['Press de banca', 'Jalones al pecho'],
        quickSuggestions: ['Press de banca'],
        settings,
        query: 'pecho',
        onQueryChange: () => {},
        onPick: () => {},
        onClose: () => {},
      }),
    );
    expect(sheetByMuscle).toContain('role="combobox"');
    expect(sheetByMuscle).toContain('aria-activedescendant="live-pick-opt-0"');
    expect(sheetByMuscle).toContain('id="live-pick-opt-0"');
    expect(sheetByMuscle).toContain('Press de banca');
    expect(sheetByMuscle).toContain('· Pecho');

    const sheetEmpty = renderToString(
      h(ExercisePickerSheet, {
        mode: 'add',
        available: ['Press de banca'],
        quickSuggestions: [],
        settings,
        query: 'xyz999',
        onQueryChange: () => {},
        onPick: () => {},
        onClose: () => {},
      }),
    );
    expect(sheetEmpty).toContain('Sin ejercicios que coincidan con «xyz999».');
  });

  it('cumple jerarquía de encabezados, A11y en modales, gráficas, radiogroups y acordeones', () => {
    const settings = sanitizeSettings({});
    const today = todayIso();
    const strength = [
      { id: 's1', sessionId: 's1', ts: 1000, date: today, ref: 'name:Press de banca', day: 'Push', sets: [{ w: 80, r: 8, done: true }] },
    ];
    const base: State = {
      tab: 'body',
      strength,
      cardio: [{ id: 'c1', ts: 1000, date: today, type: 1, distKm: 4, durMin: 25, avgHr: 140, kcal: 250 }],
      measures: [{ date: today, weight: 75, bf: 15 }],
      wellbeing: [{ date: today, steps: 9000, sleepMin: 450 }],
      settings,
      analysis: analyze(strength, settings),
      sel: {},
      perimeter: 'arms',
      muscleSel: 'Pecho',
    };

    // Jerarquía h1 -> h2 continua (sin saltar a h3 directo bajo h1)
    for (const [Comp, tab] of [
      [BodyView, 'body'],
      [VolumeView, 'volume'],
      [AdherenceView, 'adherence'],
      [DataView, 'data'],
    ] as const) {
      const html = renderToString(h(Comp, { state: { ...base, tab } }));
      expect(html).toContain('<h1');
      expect(html).toContain('<h2');
      expect(html).not.toContain('<h4');
    }

    const planExHtml = renderToString(h(PlanView, { state: { ...base, tab: 'plan', planTab: 'exercises' } }));
    expect(planExHtml).toContain('<h2 class="font-bold text-white">Unificar ejercicios duplicados</h2>');
    expect(planExHtml).toContain('aria-pressed="true"');

    // Modales Confirm y Routine con aria-describedby y colores accesibles
    const confirmHtml = renderToString(
      h(ModalHost, {
        state: { ...base, activeModal: { type: 'confirm', title: 'Borrar', message: 'Detalle seguro' } },
      }),
    );
    expect(confirmHtml).toContain('aria-describedby="confirmModalDesc"');
    expect(confirmHtml).toContain('id="confirmModalDesc"');

    const routineHtml = renderToString(
      h(ModalHost, {
        state: { ...base, activeModal: { type: 'routine', mode: 'create', name: '', sub: '', color: '#A855F7' } },
      }),
    );
    expect(routineHtml).toContain('aria-label="Color Morado"');
    expect(routineHtml).toContain('peer-focus-visible:ring-2');

    // ChartCanvas role="img" y aria-label automático
    const chartHtml = renderToString(
      h(ChartCanvas, {
        id: 'c-test',
        config: { type: 'line', data: { labels: ['01/11'], datasets: [{ label: 'Peso', data: [75] }] } },
      }),
    );
    expect(chartHtml).toContain('role="img"');
    expect(chartHtml).toContain('aria-label="Gráfica de Peso"');

    // LiveHeader aria-label dinámico y DayMobileAccordion ids únicos
    const openHdrHtml = renderToString(
      h(LiveHeader, {
        day: 'Push', dayColor: '#A855F7', curIdx: 0, total: 2,
        doneSetsCount: 1, totalSetsCount: 4, elapsedLabel: '5 min',
        menuOpen: true, onToggleMenu: () => {}, onDiscard: () => {}, onSave: () => {},
      }),
    );
    expect(openHdrHtml).toContain('aria-label="Cerrar lista de ejercicios"');

    const accHtml = renderToString(
      h(DayMobileAccordion, {
        exercises: [...base.analysis.byDay.Push],
        mobileCur: base.analysis.byDay.Push[0]?.name,
        rangeLabel: '1M',
        userNotes: {},
        mobileChartCfg: { type: 'line', data: { labels: ['21/11'], datasets: [{ label: 'Peso', data: [80] }] } },
        aiFor: () => undefined,
        onSelectEx: () => {},
        onStartWorkout: () => {},
        onEditNote: () => {},
      }),
    );
    expect(accHtml).toContain('aria-controls="day-mob-panel-0"');
    expect(accHtml).toContain('id="day-mob-panel-0"');
    expect(accHtml).toContain('id="c-day-mob-0"');

    // CalcView radiogroups con roving tabindex y focus-visible
    const calcHtml = renderToString(h(CalcView, { state: { ...base, tab: 'calc' } }));
    expect(calcHtml).toContain('tabindex="0" aria-checked="true"');
    expect(calcHtml).toContain('tabindex="-1" aria-checked="false"');
    expect(calcHtml).toContain('focus-visible:ring-electricBlue');
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

  it('captureFlipRects y playFlipRects animan el desplazamiento y respetan prefers-reduced-motion', () => {
    const makeItem = (key: string, top: number) => {
      let currentTop = top;
      const cls = new Set<string>();
      const el = {
        dataset: { sortKey: key },
        style: { transition: '', transform: '' },
        hasAttribute: (attr: string) => attr === 'data-sort-item',
        getBoundingClientRect: () => ({ left: 0, top: currentTop, bottom: currentTop + 120, right: 360, width: 360, height: 120 }) as DOMRect,
        classList: {
          add: (...names: string[]) => names.forEach((n) => cls.add(n)),
          remove: (...names: string[]) => names.forEach((n) => cls.delete(n)),
          has: (name: string) => cls.has(name),
        },
        addEventListener: () => {},
        setTop(nextTop: number) { currentTop = nextTop; },
      };
      return el;
    };

    const a = makeItem('Press banca', 100);
    const b = makeItem('Remo en T', 240);
    const list = { children: [a, b], offsetHeight: 400 } as unknown as HTMLElement;

    const prev = captureFlipRects(list);
    expect(prev.get('Press banca')?.top).toBe(100);
    expect(prev.get('Remo en T')?.top).toBe(240);

    // Simula el intercambio de orden en DOM
    a.setTop(240);
    b.setTop(100);

    const prevWin = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { innerHeight: 900, matchMedia: () => ({ matches: false }) },
    });
    try {
      playFlipRects(list, prev, 'Remo en T');
      expect(a.style.transition).toContain('transform 200ms');
      expect(b.style.transition).toContain('transform 200ms');
      expect(b.classList.has('ring-electricBlue/60')).toBe(true);
      expect(a.classList.has('ring-electricBlue/60')).toBe(false);

      // Con prefers-reduced-motion no añade clases ni transiciones
      b.classList.remove('relative', 'z-20', 'ring-1', 'ring-electricBlue/60', 'rounded-xl');
      a.style.transition = '';
      b.style.transition = '';
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: { innerHeight: 900, matchMedia: () => ({ matches: true }) },
      });
      playFlipRects(list, prev, 'Remo en T');
      expect(a.style.transition).toBe('');
      expect(b.classList.has('ring-electricBlue/60')).toBe(false);
    } finally {
      Object.defineProperty(globalThis, 'window', { configurable: true, value: prevWin });
    }
  });

  it('PlanRoutinesTab usa filas planas ultra compactas con músculo, cabecera aligerada y FLIP', () => {
    const settings = sanitizeSettings({
      ...DEFAULT_SETTINGS,
      routines: {
        Push: [{ name: 'Press de banca', sets: 3, reps: 8 }],
      },
    });
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
      perimeter: 'arms',
      muscleSel: 'Pecho',
    };

    const html = renderToString(h(PlanView, { state }));
    expect(html).toContain('hidden sm:block text-xs text-gray-400');
    expect(html).toContain('<button type="button" class="btn-sm"><span class="sm:hidden">+ Nueva</span>');
    expect(html).toContain('<button type="button" class="btn-primary-sm w-full sm:w-auto">+ Añadir ejercicio</button>');
    expect(html).toContain('class="divide-y divide-white/10"');
    expect(html).not.toContain('bg-white/[0.02]');
    expect(html).toContain('hidden sm:inline-flex icon-btn rounded-md');
    expect(html).toContain('data-sort-key="Push:Press de banca#1"');
    expect(html).toContain('>ser</span>');
    expect(html).toContain('>reps</span>');
    expect(html).toContain('Pecho');
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

  it('catálogo de 60 ejercicios limpios, respaldo legacy, renombrado completo, borrado total y restauración', async () => {
    expect(CATALOG_EXERCISES).toHaveLength(60);
    expect(DEFAULT_MUSCLES[norm('Jalones al pecho')]?.p).toBe('Espalda');

    const settings = sanitizeSettings(DEFAULT_SETTINGS);
    const today = todayIso();
    const state: State = {
      tab: 'plan',
      planTab: 'exercises',
      showAllExerciseMap: true,
      strength: [
        {
          id: 'st-1',
          sessionId: 'ses-1',
          ts: 1,
          date: today,
          ref: 'name:Curl de bíceps con barra',
          day: 'Pull',
          sets: [{ w: 30, r: 10 }],
        },
        {
          id: 'st-2',
          sessionId: 'ses-2',
          ts: 2,
          date: today,
          ref: 'name:Hip thrust',
          day: 'Leg',
          sets: [{ w: 120, r: 8 }],
        },
      ],
      cardio: [],
      measures: [],
      wellbeing: [],
      settings: {
        ...settings,
        routines: {
          ...settings.routines,
          Pull: [...settings.routines.Pull, { name: 'Curl de bíceps con barra', sets: 3, reps: 10 }],
          Leg: [...settings.routines.Leg, { name: 'Hip thrust', sets: 3, reps: 8 }],
        },
        notes: { 'Curl de bíceps con barra': 'Codos fijos' },
      },
      analysis: analyze([], settings),
      sel: { home: 'Curl de bíceps con barra', Pull: 'Curl de bíceps con barra' },
      perimeter: 'arms',
      muscleSel: 'Bíceps',
    };
    state.analysis = analyze(state.strength, state.settings);

    const putRows: unknown[] = [];
    const deletedIds: string[] = [];
    const confirmMsgs: string[] = [];
    let confirmAnswer = true;
    const catActions = createCatalogMapActions({
      getState: () => state,
      persist: async () => {
        state.analysis = analyze(state.strength, state.settings);
      },
      askConfirm: async (opts) => {
        confirmMsgs.push(opts.message);
        return confirmAnswer;
      },
      toast: () => {},
      putStrength: async (rows) => { putRows.push(...rows); },
      deleteStrength: async (id) => { deletedIds.push(id); },
    });

    // Colisión al renombrar rechaza sin sobrescribir
    const dupErr = await catActions.renameExercise('Curl de bíceps con barra', 'Curl martillo');
    expect(dupErr).toContain('Curl martillo');

    // Renombrado completo migra historial, rutinas, notas, músculos y oculta el nombre predeterminado anterior
    const renameErr = await catActions.renameExercise('Curl de bíceps con barra', 'Curl barra Z');
    expect(renameErr).toBeUndefined();
    expect(putRows).toHaveLength(1);
    expect(state.strength[0].ref).toBe('name:Curl barra Z');
    expect(state.settings.routines.Pull.some((r) => r.name === 'Curl barra Z')).toBe(true);
    expect(state.settings.notes['Curl barra Z']).toBe('Codos fijos');
    expect(state.settings.hiddenExercises).toContain(norm('Curl de bíceps con barra'));
    expect(allExerciseNames(state)).toContain('Curl barra Z');
    expect(allExerciseNames(state)).not.toContain('Curl de bíceps con barra');

    // Cancelar borrado no toca nada
    confirmAnswer = false;
    expect(await catActions.deleteExercise('Hip thrust')).toBe(false);
    expect(state.strength).toHaveLength(2);

    // Confirmar borrado total elimina historial, rutinas y oculta si es predeterminado
    confirmAnswer = true;
    expect(await catActions.deleteExercise('Hip thrust')).toBe(true);
    expect(confirmMsgs[1]).toContain('1 rutina');
    expect(confirmMsgs[1]).toContain('1 sesión del historial');
    expect(deletedIds).toEqual(['st-2']);
    expect(state.strength).toHaveLength(1);
    expect(state.settings.routines.Leg.some((r) => r.name === 'Hip thrust')).toBe(false);
    expect(state.settings.hiddenExercises).toContain(norm('Hip thrust'));
    expect(allExerciseNames(state)).not.toContain('Hip thrust');

    // Render SSR muestra el botón Restaurar predeterminados con su contador
    const tabHtml = renderToString(h(PlanView, { state }));
    expect(tabHtml).toContain('Restaurar predeterminados (2)');

    // Volver a crear un ejercicio oculto lo desoculta automáticamente
    const modal = createPlanModalActions({
      getState: () => state,
      getLastRoutine: () => 'Leg',
      setLastRoutine: () => {},
      setTab: () => {},
      persist: async () => {},
      syncWorkoutRoutineNames: () => {},
      addExToDraft: () => {},
      toast: () => {},
    });
    const recreateErr = await modal.saveExerciseModal({
      name: 'Hip thrust',
      primary: 'Glúteo',
      secondary: ['Isquios'],
      sets: 3,
      reps: 10,
      routine: '',
    });
    expect(recreateErr).toBeUndefined();
    expect(allExerciseNames(state)).toContain('Hip thrust');
    expect(state.settings.hiddenExercises).not.toContain(norm('Hip thrust'));

    // Restaurar predeterminados limpia hiddenExercises
    await catActions.restoreDefaultExercises();
    expect(state.settings.hiddenExercises).toBeUndefined();
    expect(allExerciseNames(state)).toContain('Curl de bíceps con barra');
  });

  it('tema Reloj GPS Polar: selector Oscuro/Claro/Sistema, resolveEffectiveTheme/applyTheme y gráficas sin arcoíris', () => {
    const settings = sanitizeSettings({ theme: 'system' });
    const today = todayIso();
    const strength = [
      { id: 't1', sessionId: 'st1', ts: 1, date: today, ref: 'name:Press de banca', day: 'Push' as const, sets: [{ w: 80, r: 8 }] },
    ];
    const measures = [
      { date: todayIso(new Date(Date.now() - 864e5)), weight: 75 },
      { date: today, weight: 75.5 },
    ];
    const state: State = {
      tab: 'settings',
      strength,
      cardio: [],
      measures,
      wellbeing: [],
      settings,
      analysis: analyze(strength, settings),
      sel: { home: 'Press de banca' },
      perimeter: 'arms',
      muscleSel: 'Pecho',
    };

    const settingsHtml = renderToString(h(SettingsView, { state }));
    expect(settingsHtml).toContain('Apariencia');
    expect(settingsHtml).toContain('aria-label="Apariencia de la interfaz"');
    expect(settingsHtml).toContain('Oscuro');
    expect(settingsHtml).toContain('Claro');
    expect(settingsHtml).toContain('Sistema');
    expect(settingsHtml).toContain('aria-pressed="true"');

    // Gráficas Reloj GPS Polar: serie principal en #2DD4BF y secundaria/diaria en gris mineral
    const homeExCfg = buildHomeExChartConfig(state);
    expect(homeExCfg?.data.datasets[0].borderColor).toBe('#2DD4BF');
    expect(homeExCfg?.data.datasets[1].borderColor).toBe('#94A3A8');

    const compCfg = buildCompChartConfig(measures, 'weight', measures);
    expect(compCfg?.data.datasets[0].borderColor).toBe('#2DD4BF');
    expect(compCfg?.data.datasets[1].borderColor).toBe('rgba(148,163,168,0.55)');

    // resolveEffectiveTheme y applyTheme con mock ligero de document y window.matchMedia
    const fakeClasses = new Set<string>(['dark']);
    const fakeRoot = {
      dataset: {} as Record<string, string>,
      style: { colorScheme: '' },
      classList: {
        toggle: (cls: string, force?: boolean) => {
          if (force) fakeClasses.add(cls);
          else fakeClasses.delete(cls);
          return fakeClasses.has(cls);
        },
      },
    };
    let metaColor = '#0A0D0E';
    vi.stubGlobal('document', {
      documentElement: fakeRoot,
      querySelector: () => ({ setAttribute: (_k: string, v: string) => { metaColor = v; } }),
    });
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: true }),
    });

    expect(resolveEffectiveTheme('dark')).toBe('dark');
    expect(resolveEffectiveTheme('light')).toBe('light');
    expect(resolveEffectiveTheme('system')).toBe('light');

    expect(applyTheme('light')).toBe('light');
    expect(fakeRoot.dataset.theme).toBe('light');
    expect(fakeClasses.has('light')).toBe(true);
    expect(fakeClasses.has('dark')).toBe(false);
    expect(metaColor).toBe('#F3F7F8');

    expect(applyTheme('dark')).toBe('dark');
    expect(fakeRoot.dataset.theme).toBe('dark');
    expect(fakeClasses.has('dark')).toBe(true);
    expect(fakeClasses.has('light')).toBe(false);
    expect(metaColor).toBe('#0A0D0E');

    vi.unstubAllGlobals();
  });

  it('judge usa salto +2,5 kg <80 kg y +5 kg >=80 kg, reconoce Progresando (+X reps) y renderiza desplegables info', () => {
    // < 80 kg sube +2,5 kg
    const sub80 = judge([
      { date: '2026-11-10', sets: [{ w: 60, r: 8 }, { w: 60, r: 8 }], top: 60, repsAtTop: 8, volume: 960, e1rm: 76 },
    ], { name: 'Press de banca', sets: 2, reps: 8 });
    expect(sub80.status).toBe('Subir carga');
    expect(sub80.prescription).toContain('62.5 kg');

    // >= 80 kg sube +5 kg
    const over80 = judge([
      { date: '2026-11-10', sets: [{ w: 80, r: 8 }, { w: 80, r: 8 }], top: 80, repsAtTop: 8, volume: 1280, e1rm: 101.3 },
    ], { name: 'Press de banca', sets: 2, reps: 8 });
    expect(over80.status).toBe('Subir carga');
    expect(over80.prescription).toContain('85 kg');

    // Progresando (+1 rep) al mismo peso sin llegar al objetivo ni récord e1RM
    const repProg = judge([
      { date: '2026-11-01', sets: [{ w: 70, r: 9 }, { w: 70, r: 8 }], top: 70, repsAtTop: 9, volume: 1190, e1rm: 91 },
      { date: '2026-11-05', sets: [{ w: 70, r: 6 }, { w: 70, r: 6 }], top: 70, repsAtTop: 6, volume: 840, e1rm: 84 },
      { date: '2026-11-10', sets: [{ w: 70, r: 7 }, { w: 70, r: 7 }], top: 70, repsAtTop: 7, volume: 980, e1rm: 86.3 },
    ], { name: 'Press de banca', sets: 3, reps: 10 });
    expect(repProg.status).toBe('Progresando (+1 rep)');
    expect(repProg.statusColor).toBe('emeraldGreen');

    const settings = sanitizeSettings({});
    const today = todayIso();
    const strength = [
      { id: 'j1', sessionId: 'sj1', ts: 1, date: todayIso(new Date(Date.now() - 864e5)), ref: 'name:Press de banca', day: 'Push' as const, sets: [{ w: 70, r: 6 }, { w: 70, r: 6 }] },
      { id: 'j2', sessionId: 'sj2', ts: 2, date: today, ref: 'name:Press de banca', day: 'Push' as const, sets: [{ w: 70, r: 7 }, { w: 70, r: 7 }] },
    ];
    const state: State = {
      tab: 'home',
      strength,
      cardio: [],
      measures: [],
      wellbeing: [],
      settings,
      analysis: analyze(strength, settings),
      sel: {},
      perimeter: 'arms',
      muscleSel: 'Pecho',
    };
    const exStats = state.analysis.exercises.get('Press de banca')!;
    expect(describeStatus(exStats)).toContain('superaste tus repeticiones máximas con 70 kg');

    const homeHtml = renderToString(h(HomeView, { state }));
    expect(homeHtml).toContain('aria-label="Qué significa cada estado"');
    expect(homeHtml).toContain('id="load-status-legend"');
    expect(homeHtml).toContain('+2,5 kg (menos de 80 kg) o +5 kg (desde 80 kg)');

    const dayHtml = renderToString(h(DayRoutineView, { day: 'Push', state }));
    expect(dayHtml).toContain('aria-label="Ver cómo se calcula este estado"');
    expect(dayHtml).toContain('Regla aplicada');
  });

  it('PlanExercisesTab usa modal buscador mergeExercisePicker reciclado en lugar de selects largos', () => {
    const settings = sanitizeSettings({});
    const state: State = {
      tab: 'plan',
      planTab: 'exercises',
      strength: [],
      cardio: [],
      measures: [],
      wellbeing: [],
      settings,
      analysis: analyze([], settings),
      sel: {},
      mergeFrom: 'Sóleo Sentado',
      perimeter: 'arms',
      muscleSel: 'Pecho',
    };

    const planExHtml = renderToString(h(PlanView, { state }));
    expect(planExHtml).toContain('id="mergeFrom"');
    expect(planExHtml).toContain('id="mergeTo"');
    expect(planExHtml).toContain('Sóleo Sentado');
    expect(planExHtml).not.toContain('<select id="mergeFrom"');
    expect(planExHtml).not.toContain('<select id="mergeTo"');

    const modalHtml = renderToString(
      h(ModalHost, { state: { ...state, activeModal: { type: 'mergeExercisePicker', slot: 'to' } } }),
    );
    expect(modalHtml).toContain('Elegir ejercicio destino');
    expect(modalHtml).toContain('id="planExSearch"');
    expect(modalHtml).toContain('Elevación de gemelos sentado');
    expect(modalHtml).not.toContain('Sóleo Sentado');
  });

  it('auto-marca series editadas, toggleAllSets y avisa si hay notas sin marcar al guardar', async () => {
    const settings = sanitizeSettings({});
    let draft = initLogDraft(
      {
        tab: 'log',
        strength: [],
        cardio: [],
        measures: [],
        wellbeing: [],
        settings,
        analysis: analyze([], settings),
        sel: {},
        perimeter: 'arms',
        muscleSel: 'Pecho',
      },
      'Push',
      todayIso(),
    );
    const commits: number[] = [];
    const inputActions = createLogInputActions(
      () => draft,
      (d) => { if (d) draft = d; },
      (d) => { if (d) draft = d; commits.push(1); },
    );
    const setActions = createLogSetActions(
      () => draft,
      (d) => { if (d) draft = d; commits.push(1); },
      () => {},
    );

    expect(draft.exercises[0].sets[0].done).toBe(false);
    inputActions.stepWeight(0, 0, 2.5);
    expect(draft.exercises[0].sets[0].done).toBe(true);

    inputActions.updateReps(0, 0, '0', true);
    expect(draft.exercises[0].sets[0].done).toBe(false);
    inputActions.updateReps(0, 0, '8', false);
    expect(draft.exercises[0].sets[0].done).toBe(true);
    expect(commits.length).toBeGreaterThanOrEqual(3);

    setActions.addSet(0);
    expect(draft.exercises[0].sets[draft.exercises[0].sets.length - 1].done).toBe(true);

    setActions.applyTargetWeight(1, 50);
    expect(draft.exercises[1].sets.every((s) => s.w === 50 && s.done)).toBe(true);

    setActions.toggleAllSets();
    expect(draft.exercises.every((ex) => ex.sets.every((s) => s.done))).toBe(true);
    setActions.toggleAllSets();
    expect(draft.exercises.every((ex) => ex.sets.every((s) => !s.done))).toBe(true);

    // Ejercicio 0 marcado, ejercicio 1 con nota pero sin series marcadas -> pregunta antes de guardar
    setActions.toggleExercise(0);
    inputActions.updateNote(1, 'Molestia leve en hombro');
    const confirms: string[] = [];
    const histActions = createLogHistoryActions(
      {
        getState: () => ({
          tab: 'log',
          strength: [],
          cardio: [],
          measures: [],
          wellbeing: [],
          settings,
          analysis: analyze([], settings),
          sel: {},
          perimeter: 'arms',
          muscleSel: 'Pecho',
          logDraft: draft,
        }),
        commitDraft: (d) => { if (d) draft = d; },
        reload: async () => {},
        setTab: () => {},
        queueSync: () => {},
        toast: () => {},
        askConfirm: async (opts) => {
          confirms.push(opts.message);
          return false;
        },
      },
      () => draft,
      async () => true,
    );
    await histActions.saveSession();
    expect(confirms).toHaveLength(1);
    expect(confirms[0]).toContain(draft.exercises[1].name);
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
      'Inicia sesión con Google para generar análisis IA',
    );
  });

  it('Bloque 5 Opción B: edición inline, Organizar/Ver volumen en Rutinas y menú de 4 destinos sin Plan', () => {
    const today = todayIso();
    const settings = sanitizeSettings({
      routines: {
        Push: [
          { name: 'Press inclinado con mancuernas', sets: 3, reps: 10 },
          { name: 'Press de banca', sets: 3, reps: 8 },
        ],
      },
    });
    const strength = [
      { id: 's1', sessionId: 'sess-b5', ts: Date.now(), date: today, ref: 'name:Press de banca', day: 'Push' as const, sets: [{ w: 80, r: 8, done: true }] },
    ];
    const state: State = {
      tab: 'Push',
      strength,
      cardio: [],
      measures: [],
      wellbeing: [],
      settings,
      analysis: analyze(strength, settings),
      sel: {},
      perimeter: 'arms',
      muscleSel: 'Pecho',
    };

    const vm = buildDayRoutineViewModel(state, 'Push');
    expect(vm.primary.map((e) => e.name)).toEqual(['Press inclinado con mancuernas', 'Press de banca']);

    const dayHtml = renderToString(h(DayRoutineView, { day: 'Push', state }));
    expect(dayHtml).toContain('Organizar');
    expect(dayHtml).toContain('Ver volumen');
    expect(dayHtml).toContain('Editar series y reps objetivo de Press de banca: 3×8');

    const orgHtml = renderToString(
      h(DayOrganizeBar, {
        day: 'Push',
        routineCount: 2,
        onAddExercise: () => {},
        onApplyTemplate: () => {},
        onNewRoutine: () => {},
        onEditRoutine: () => {},
        onDeleteRoutine: () => {},
        onOpenCatalog: () => {},
      }),
    );
    expect(orgHtml).toContain('+ Añadir ejercicio');
    expect(orgHtml).toContain('Catálogo y músculos →');

    const simInlineHtml = renderToString(h(PlanSidebarWidgets, { state, inline: true }));
    expect(simInlineHtml).toContain('Simulador de volumen semanal');
    expect(simInlineHtml).not.toContain('<aside');
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

  it('auditoría 2 y requisitos de En vivo: descartar en cabecera, pop-up 5s con comparativa, descanso manual, volumen unificado y veredictos', () => {
    const today = todayIso();
    const prevDate = todayIso(new Date(Date.now() - 14 * 864e5));
    const settings = sanitizeSettings({
      profile: { experience: 'beginner', daysPerWeek: 3, goal: 'maintain', sex: 'male', age: 28, heightCm: 176 },
      notes: { 'Press de banca': 'Escápulas atrás' },
    });
    const strength = [
      {
        id: 's-prev-1',
        sessionId: 'sess-prev-1',
        ts: Date.parse(`${prevDate}T10:00:00Z`),
        date: prevDate,
        ref: 'name:Press de banca',
        day: 'Push' as const,
        avgHr: 128,
        sets: [
          { w: 70, r: 8, done: true },
          { w: 70, r: 8, done: true },
        ],
      },
      {
        id: 's-cur-2',
        sessionId: 'sess-cur-2',
        ts: Date.parse(`${today}T10:00:00Z`),
        date: today,
        ref: 'name:Press de banca',
        day: 'Push' as const,
        avgHr: 132,
        sets: [
          { w: 75, r: 8, done: true },
          { w: 75, r: 8, done: true },
        ],
      },
    ];
    const measures = [
      { date: prevDate, weight: 76, bf: 18 },
      { date: today, weight: 75.2, bf: 17.4 },
    ];
    const state: State = {
      tab: 'workout',
      strength,
      cardio: [],
      measures,
      wellbeing: [],
      settings,
      analysis: analyze(strength, settings),
      sel: {},
      perimeter: 'arms',
      muscleSel: 'Pecho',
    };

    // 1. LiveHeader tiene Descartar entrenamiento y Terminar (0) neutro; LiveExerciseMenu ya no incluye Descartar
    const liveIdle = initLiveWorkout(state, 'Push');
    const hdrZero = renderToString(
      h(LiveHeader, {
        day: 'Push',
        dayColor: '#2DD4BF',
        curIdx: 0,
        total: liveIdle.exercises.length,
        doneSetsCount: 0,
        totalSetsCount: 6,
        elapsedLabel: '2 min',
        menuOpen: false,
        onToggleMenu: () => {},
        onDiscard: () => {},
        onSave: () => {},
      }),
    );
    expect(hdrZero).toContain('Descartar entrenamiento');
    expect(hdrZero).toContain('Terminar (0)');
    expect(hdrZero).not.toContain('btn-primary');

    const hdrDone = renderToString(
      h(LiveHeader, {
        day: 'Push',
        dayColor: '#2DD4BF',
        curIdx: 0,
        total: liveIdle.exercises.length,
        doneSetsCount: 2,
        totalSetsCount: 6,
        elapsedLabel: '8 min',
        menuOpen: false,
        onToggleMenu: () => {},
        onDiscard: () => {},
        onSave: () => {},
      }),
    );
    expect(hdrDone).toContain('btn-primary');

    const menuHtml = renderToString(
      h(LiveExerciseMenu, {
        open: true,
        curIdx: 0,
        doneExCount: 0,
        items: [],
        onToggleMenu: () => {},
        onSelectExercise: () => {},
        onOpenAddPicker: () => {},
      }),
    );
    expect(menuHtml).not.toContain('Descartar entrenamiento');

    // 2. Comparativa frente a sesión anterior y cierre automático del pop-up (5s) + último ejercicio también marca lastCompletedExIdx
    const cmpUp = buildExerciseCompletionSummary(state, {
      name: 'Press de banca',
      done: true,
      note: '',
      sets: [
        { w: 77.5, r: 8, done: true },
        { w: 77.5, r: 8, done: true },
      ],
    });
    expect(cmpUp.comparisonText).toContain('+2,5 kg máx');
    expect(cmpUp.tone).toBe('emerald');

    const cmpFirst = buildExerciseCompletionSummary(state, {
      name: 'Fondos',
      done: true,
      note: '',
      sets: [{ w: 0, r: 10, done: true }],
    });
    expect(cmpFirst.comparisonText).toBe('Primera sesión registrada');
    expect(cmpFirst.tone).toBe('blue');

    const singleExLive = {
      ...liveIdle,
      exercises: [{ name: 'Press de banca', done: false, note: '', sets: [{ w: 77.5, r: 8, done: false }] }],
    };
    const toggledFinal = applyToggleLiveSet(singleExLive, 0, 0, () => {});
    expect(toggledFinal.nextLive.lastCompletedExIdx).toBe(0);

    const popupHtml = renderToString(
      h(PrevCompletedBanner, {
        prevIdx: 0,
        prevName: 'Press de banca',
        summary: cmpUp,
        onGoBack: () => {},
        onAddExtraSet: () => {},
        onDismiss: () => {},
      }),
    );
    expect(popupHtml).toContain('Press de banca completado');
    expect(popupHtml).toContain('se oculta en 5 s');
    expect(popupHtml).toContain('+2,5 kg máx');
    expect(popupHtml).toContain('+ Serie extra');

    // 3. RestTimerBar en espera permite inicio manual; RIR explicado en móvil en En vivo y Registrar hecho
    expect(renderToString(h(RestTimerBar, { targetRestSec: 90 }))).toContain('Iniciar 90s');
    const liveHtml = renderToString(h(LiveWorkoutView, { state: { ...state, tab: 'workout', liveWorkout: liveIdle } }));
    expect(liveHtml).toContain('RIR: reps en reserva (0 = al fallo · 2 = te guardas 2)');
    expect(liveHtml).toContain('aria-label="Opciones de Press de banca"');
    expect(liveHtml).toContain('+ Nota de hoy');
    const logHtml2 = renderToString(h(LogWorkoutView, { state: { ...state, tab: 'log', logDraft: initLogDraft(state, 'Push', today) } }));
    expect(logHtml2).toContain('RIR: reps en reserva (0 = al fallo · 2 = te guardas 2)');
    expect(logHtml2).toContain('Nota fija:');

    // 4. Volumen unificado (6-16 para principiante / <=3d y 8-20 en general) + veredictos en gráficas + Settings Fases del bloque
    expect(volumeRangeForProfile({ experience: 'beginner', daysPerWeek: 4 })).toEqual({ min: 6, max: 16, isLightPlan: true });
    expect(volumeRangeForProfile({ experience: 'intermediate', daysPerWeek: 4 })).toEqual({ min: 8, max: 20, isLightPlan: false });
    const volLightHtml = renderToString(h(VolumeView, { state: { ...state, tab: 'volume' } }));
    expect(volLightHtml).toContain('6–16 óptimo');
    expect(volLightHtml).toContain('(plan ligero)');
    expect(volLightHtml).toContain('Principal = 1 · Apoyo = 0,5');

    const homeHtml2 = renderToString(h(HomeView, { state: { ...state, tab: 'home' } }));
    expect(homeHtml2).toContain('+5 kg en tu máximo en este periodo');
    expect(homeHtml2).toContain('−0,8 kg de peso en este periodo');

    const bodyEmptyHtml = renderToString(h(BodyView, { state: { ...state, tab: 'body', measures: [] } }));
    expect(bodyEmptyHtml).toContain('Añade tu peso o % de grasa arriba para ver la evolución.');
    expect(bodyEmptyHtml).not.toContain('abajo');

    const settingsHtml2 = renderToString(h(SettingsView, { state }));
    expect(settingsHtml2).toContain('Fases del bloque');

    const dayHtml2 = renderToString(h(DayRoutineView, { day: 'Push', state }));
    expect(dayHtml2).toContain('Pulso medio');
    expect(dayHtml2).not.toContain('FC media');
  });

  it('guarda y conserva el orden real de ejecución de los ejercicios en En vivo, análisis y Registrar hecho', () => {
    const today = todayIso();
    const settings = sanitizeSettings({});
    const state: State = {
      tab: 'workout',
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

    const live = initLiveWorkout(state, 'Push');
    const ex0 = live.exercises[0].name;
    const ex1 = live.exercises[1].name;

    // Completa primero el ejercicio 1 y luego el ejercicio 0
    const step1 = applyToggleLiveSet(live, 1, 0, () => {}).nextLive;
    const step2 = applyToggleLiveSet(step1, 0, 0, () => {}).nextLive;
    expect(step2.exercises[1].meta?.ts).toBeTypeOf('number');
    expect(step2.exercises[0].meta?.ts).toBeGreaterThan(step2.exercises[1].meta!.ts!);

    // Desmarcar todas las series de ex0 borra su ts; al volver a marcarlo obtiene un ts posterior
    const uncheck = applyToggleLiveSet(step2, 0, 0, () => {}).nextLive;
    expect(uncheck.exercises[0].meta?.ts).toBeUndefined();

    // analyze() e initLogDraft() preservan el orden cronológico real (ts ascendente)
    const savedRows = [
      {
        id: `live-${today}-0`,
        sessionId: `live-${today}-push`,
        ts: step2.exercises[0].meta!.ts!,
        date: today,
        ref: `name:${ex0}`,
        day: 'Push' as const,
        sets: [{ w: 60, r: 8, done: true }],
      },
      {
        id: `live-${today}-1`,
        sessionId: `live-${today}-push`,
        ts: step2.exercises[1].meta!.ts!,
        date: today,
        ref: `name:${ex1}`,
        day: 'Push' as const,
        sets: [{ w: 20, r: 10, done: true }],
      },
    ];
    const analyzed = analyze(savedRows, settings);
    expect(analyzed.sessions[0]?.exercises).toEqual([ex1, ex0]);

    const reopened = initLogDraft({ ...state, strength: savedRows, analysis: analyzed }, 'Push', today, `live-${today}-push`);
    expect(reopened.exercises.slice(0, 2).map((e) => e.name)).toEqual([ex1, ex0]);

    // Reordenar en Registrar hecho actualiza los ts para persistir el nuevo orden
    let draft = reopened;
    const setActions = createLogSetActions(() => draft, (d) => { if (d) draft = d; }, () => {});
    setActions.moveExercise(0, 1);
    expect(draft.exercises.slice(0, 2).map((e) => e.name)).toEqual([ex0, ex1]);
    expect(draft.exercises[0].meta!.ts!).toBeLessThan(draft.exercises[1].meta!.ts!);
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
  });
});
