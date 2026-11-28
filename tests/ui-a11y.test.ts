import { h } from 'preact';
import renderToString from 'preact-render-to-string';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { analyze, musclesOf } from '../src/lib/analysis';
import { sanitizeSettings } from '../src/lib/db';
import {
  DEFAULT_MUSCLES,
  DEFAULT_SETTINGS,
  ROUTINE_COLORS,
  norm,
} from '../src/lib/seed';
import { AiInsightBanner } from '../src/components/common/AiInsightBanner';
import { SwUpdateBanner, ToastBanner } from '../src/components/common/ToastBanner';
import { DayOrganizeBar } from '../src/components/day/DayOrganizeBar';
import { AiCoachPanel } from '../src/components/home/AiCoachPanel';
import { MobileHeader } from '../src/components/layout/MobileHeader';
import { MobileBottomNav } from '../src/components/layout/MobileNav';
import { Sidebar } from '../src/components/layout/Sidebar';
import { ModalHost } from '../src/components/modals/ModalHost';
import { AccountSyncSection } from '../src/components/settings/AccountSyncSection';
import { WizardModal } from '../src/components/modals/WizardModal';
import { ChartCanvas } from '../src/components/common/ChartCanvas';
import { RangePicker } from '../src/components/common/RangePicker';
import { DayMobileAccordion } from '../src/components/day/DayMobileAccordion';
import { LiveExerciseMenu } from '../src/components/workout/LiveExerciseMenu';
import { LiveHeader } from '../src/components/workout/LiveHeader';
import { buildAdherenceCalendarData, buildMonthGrid } from '../src/store/adherenceCalendar';
import { buildCompChartConfig, buildPerimChartConfig } from '../src/store/bodyChartConfigs';
import { createCatalogMapActions } from '../src/store/catalogMapActions';
import { quickExSuggestions } from '../src/store/exerciseCatalog';
import { buildBodyHomeChartConfig, buildHomeExChartConfig, exerciseChartConfig } from '../src/store/homeChartConfigs';
import { initLogDraft } from '../src/store/logSelectors';
import { createLogSetActions } from '../src/store/logSetActions';
import { activeTabTitle, syncStatusInfo } from '../src/store/navigation';
import { createPlanFilterActions } from '../src/store/planFilterActions';
import { createWizardDraft } from '../src/store/wizardSelectors';
import { createLiveWorkoutActions } from '../src/store/workoutActions';
import { initLiveWorkout } from '../src/store/workoutSelectors';
import { createWorkoutSetActions } from '../src/store/workoutSetActions';
import { ICON_PATHS } from '../src/ui/icons';
import { normalizeChartConfig } from '../src/ui/charts';
import {
  DAY_COLOR,
  humanizeError,
  routineColor,
  todayIso,
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
    expect(logHtml).toContain('h-11 rounded-md px-1.5 py-0 text-center text-base sm:text-sm font-semibold tabular-nums');
  });
});

describe('accesibilidad WCAG, contraste, temas y shell UI', () => {
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
    expect(liveHtml).toContain('inp-stepper border-white/15 bg-transparent text-base min-h-[48px] sm:min-h-[44px] min-w-[36px] min-[390px]:min-w-[40px]');
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
    expect(planExHtml).toContain('overflow-y-auto');
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
    expect(liveHtml).toContain('min-h-[48px] min-w-[48px]');

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
        menuOpen: true, onToggleMenu: () => {}, onSave: () => {},
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

  it('soporta autenticación por correo, verificación de email y mensajes de error claros', () => {
    expect(humanizeError(new Error('Firebase: Error (auth/invalid-credential).'))).toBe(
      'Correo o contraseña incorrectos.',
    );
    expect(humanizeError(new Error('Firebase: Error (auth/email-already-in-use).'))).toContain(
      'Ya existe una cuenta con ese correo',
    );
    expect(humanizeError(new Error('Firebase: Error (auth/weak-password).'))).toBe(
      'La contraseña debe tener al menos 6 caracteres.',
    );

    const settings = sanitizeSettings({});
    const unverifiedUser = {
      uid: 'u-email-1',
      email: 'atleta@ejemplo.com',
      displayName: null,
      photoURL: null,
      emailVerified: false,
    };
    const baseState: State = {
      tab: 'settings',
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

    expect(syncStatusInfo({ ...baseState, user: unverifiedUser }, false, true)).toEqual({
      text: 'Correo pendiente de verificar',
      cls: 'text-amberGold',
    });

    const loggedOutHtml = renderToString(h(SettingsView, { state: baseState }));
    expect(loggedOutHtml).toContain('Iniciar sesión');
    expect(loggedOutHtml).toContain('Crear cuenta');
    expect(loggedOutHtml).not.toContain('<h3');
    expect(loggedOutHtml).not.toContain('text-gray-500');

    const authModalHtml = renderToString(
      h(ModalHost, { state: { ...baseState, activeModal: { type: 'auth', mode: 'signup' } } }),
    );
    expect(authModalHtml).toContain('id="auth-modal"');
    expect(authModalHtml).toContain('Continuar con Google');
    expect(authModalHtml).toContain('id="email-auth-name"');
    expect(authModalHtml).toContain('Crear cuenta con correo');
    expect(authModalHtml).not.toContain('text-gray-500');

    const unverifiedHtml = renderToString(h(SettingsView, { state: { ...baseState, user: unverifiedUser } }));
    expect(unverifiedHtml).toContain('Ya lo verifiqué');
    expect(unverifiedHtml).toContain('Reenviar correo');
    expect(unverifiedHtml).toContain('Verifica tu correo');
    expect(unverifiedHtml).toContain('Eliminar cuenta');
    expect(unverifiedHtml).not.toContain('<h3');
    expect(unverifiedHtml).not.toContain('text-gray-500');

    const verifiedExhaustedHtml = renderToString(
      h(SettingsView, {
        state: {
          ...baseState,
          user: { ...unverifiedUser, emailVerified: true },
          aiQuota: { used: 3, limit: 3, remaining: 0, dayUtc: '2026-11-25' },
        },
      }),
    );
    expect(verifiedExhaustedHtml).toContain('Informes hoy: 3/3');
    expect(verifiedExhaustedHtml).toContain('Límite diario alcanzado');
    expect(verifiedExhaustedHtml).toContain('Eliminar cuenta');
    expect(verifiedExhaustedHtml).not.toContain('<h3');
  });

  it('mejora UX móvil: SwUpdateBanner z-40, copias claras, Volver en Plan y confirmación en swap con series hechas', async () => {
    const swHtml = renderToString(h(SwUpdateBanner, { visible: true, onDismiss: () => {}, onReload: () => {} }));
    expect(swHtml).toContain('z-40');

    const settings = sanitizeSettings({});
    const baseState: State = {
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
    };

    const summaryHtml = renderToString(
      h(ModalHost, {
        state: {
          ...baseState,
          activeModal: {
            type: 'workoutSummary',
            summary: { day: 'Push', durationMin: 40, exercises: 3, sets: 9, tonnageKg: 2500, prNames: [] },
          },
        },
      }),
    );
    expect(summaryHtml).toContain('Kilos movidos');

    const planHtml = renderToString(h(PlanView, { state: { ...baseState, planTab: 'routines' } }));
    expect(planHtml).toContain('Volver a rutinas');

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
    expect(orgHtml).toContain('Editar rutina');

    let live = {
      ...initLiveWorkout(baseState, 'Push'),
      pickerMode: 'swap' as const,
      exercises: [{ name: 'Press de banca', note: '', done: false, sets: [{ w: 80, r: 8, done: true }] }],
    };
    const confirmTitles: string[] = [];
    const actions = createLiveWorkoutActions({
      getState: () => ({ ...baseState, liveWorkout: live }),
      saveLiveOnly: (next) => { if (next) live = next as typeof live; },
      commitLive: (next) => { if (next) live = next as typeof live; },
      reload: async () => {},
      setTab: () => {},
      queueSync: () => {},
      toast: () => {},
      askConfirm: async (opts) => { confirmTitles.push(opts.title); return false; },
      openNoteModal: () => {},
      showSummary: () => {},
    });
    await actions.pickExercise('Press inclinado con mancuernas');
    expect(confirmTitles).toEqual(['Cambiar ejercicio con series marcadas']);
    expect(live.exercises[0].name).toBe('Press de banca');

    // AccountSyncSection refleja cambios locales pendientes cuando unsynced=true
    const syncHtml = renderToString(
      h(AccountSyncSection, {
        state: {
          ...baseState,
          user: { uid: 'u1', email: 'u1@example.com', displayName: 'Tester', photoURL: null, emailVerified: true },
        },
        unsynced: true,
        onSync: () => {},
        onLogout: () => {},
      }),
    );
    expect(syncHtml).toContain('pendiente de sincronizar');
  });
});
