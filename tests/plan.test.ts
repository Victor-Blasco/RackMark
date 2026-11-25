import { h } from 'preact';
import renderToString from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import { analyze, weeklyVolume } from '../src/lib/analysis';
import { parseBackup, sanitizeSettings } from '../src/lib/db';
import { importSamsungInWorker } from '../src/lib/samsung';
import {
  CATALOG_EXERCISES,
  DEFAULT_MUSCLES,
  DEFAULT_SETTINGS,
  norm,
} from '../src/lib/seed';
import { ToastBanner, SwUpdateBanner } from '../src/components/common/ToastBanner';
import { MobileHeader } from '../src/components/layout/MobileHeader';
import { MobileBottomNav } from '../src/components/layout/MobileNav';
import { Sidebar } from '../src/components/layout/Sidebar';
import { ExerciseModal } from '../src/components/modals/ExerciseModal';
import { ModalHost } from '../src/components/modals/ModalHost';
import { WizardModal } from '../src/components/modals/WizardModal';
import { PlanCatalogList } from '../src/components/plan/PlanCatalogList';
import { PlanSidebarWidgets } from '../src/components/plan/PlanSidebarWidgets';
import { DayOrganizeBar } from '../src/components/day/DayOrganizeBar';
import { ExercisePickerSheet } from '../src/components/workout/ExercisePickerSheet';
import { RestTimerBar } from '../src/components/workout/RestTimerBar';
import { fmtMMSS } from '../src/ui/restAudio';
import { createCatalogMapActions } from '../src/store/catalogMapActions';
import { allExerciseNames, extractTargetWeight } from '../src/store/exerciseCatalog';
import { buildHomeExChartConfig } from '../src/store/homeChartConfigs';
import { buildDayRoutineViewModel } from '../src/store/daySelectors';
import { initLogDraft } from '../src/store/logSelectors';
import { isValidTab } from '../src/store/navigation';
import { createPlanActions } from '../src/store/planActions';
import { createPlanFilterActions } from '../src/store/planFilterActions';
import { createPlanModalActions } from '../src/store/planModalActions';
import { distributeWeeklyFreqs, getPlanCatalogData, plannedVolumeBreakdown, plannedWeeklyVolume, suggestPrimaryMuscle } from '../src/store/planSelectors';
import { createRoutineEditActions } from '../src/store/routineEditActions';
import { applyRoutineTemplateToState } from '../src/store/routineTemplate';
import {
  createWizardDraft,
  daysActivityFactor,
  goalCalorieDelta,
  goalPhaseName,
  recommendTemplate,
} from '../src/store/wizardSelectors';
import { createWorkoutLaunchActions } from '../src/store/workoutLaunchActions';
import { initLiveWorkout } from '../src/store/workoutSelectors';
import {
  filterSelectionOptions,
  groupSelectionOptions,
  normalizeSelectionText,
  sortRecentSelectionOptions,
} from '../src/ui/selection';
import { routineShort, todayIso, type State } from '../src/ui/shared';
import { AdherenceView } from '../src/views/AdherenceView';
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

describe('planificación, catálogo, rutinas y fusiones', () => {
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

  it('soporta frecuencia semanal por rutina, desglose, aviso sin músculo, Espalda en RDL y ExerciseModal sin Pecho por defecto', async () => {
    expect(DEFAULT_MUSCLES[norm('Peso muerto rumano')]?.s).toContain('Espalda');
    expect(DEFAULT_MUSCLES[norm('RDL')]?.s).toContain('Espalda');

    expect(suggestPrimaryMuscle('Remo en polea gironda')).toBe('Espalda');
    expect(suggestPrimaryMuscle('Curl femoral tumbado')).toBe('Isquios');
    expect(suggestPrimaryMuscle('Ejercicio raro XYZ')).toBeUndefined();

    const settings = sanitizeSettings({
      routines: {
        Push: [{ name: 'Press de banca', sets: 3, reps: 8 }],
        Pull: [
          { name: 'Jalón al pecho', sets: 3, reps: 10 },
          { name: 'Remo fantasma', sets: 3, reps: 10 },
        ],
        Leg: [{ name: 'Peso muerto rumano', sets: 4, reps: 8 }],
      },
      routineMeta: {
        Push: { color: '#A855F7' },
        Pull: { color: '#3B82F6', freq: 2 },
        Leg: { color: '#10B981', freq: 0 },
      },
    });

    const vol = plannedWeeklyVolume(settings);
    expect(vol.get('Pecho')).toBe(3);
    expect(vol.get('Espalda')).toBe(6);
    expect(vol.get('Cuádriceps')).toBe(0);

    const breakdown = plannedVolumeBreakdown(settings);
    expect(breakdown.totalWeeklySessions).toBe(3);
    expect(breakdown.totalPlannedSets).toBe(15);
    expect(breakdown.unmapped).toEqual([{ routine: 'Pull', exercise: 'Remo fantasma' }]);
    expect(breakdown.byMuscle.get('Espalda')).toEqual([
      { routine: 'Pull', freq: 2, exercise: 'Jalón al pecho', sets: 3, factor: 1, effective: 6 },
    ]);

    // Con frecuencia 1 en Leg, Peso muerto rumano suma 2 series efectivas (4 × 0,5) a Espalda
    const withLegSettings = sanitizeSettings({
      ...settings,
      routineMeta: { ...settings.routineMeta, Leg: { color: '#10B981' } },
    });
    expect(plannedWeeklyVolume(withLegSettings).get('Espalda')).toBe(8);

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
    };

    const simHtml = renderToString(h(PlanSidebarWidgets, { state, inline: true }));
    expect(simHtml).toContain('3 d/sem');
    expect(simHtml).toContain('Reducir frecuencia semanal de Pull');
    expect(simHtml).toContain('Aumentar frecuencia semanal de Pull');
    expect(simHtml).toContain('1 ejercicio sin músculo (Remo fantasma)');
    expect(simHtml).toContain('Asignar músculo');

    // Actions: changeRoutineFreq con clamp 0..7 y limpieza al volver a 1
    let persisted = 0;
    const editActions = createRoutineEditActions({
      getState: () => state,
      getLastRoutine: () => 'Push',
      setLastRoutine: () => {},
      persist: async () => { persisted++; },
      render: () => {},
      syncWorkoutRoutineNames: () => {},
      askConfirm: async () => true,
      toast: () => {},
    });
    await editActions.changeRoutineFreq('Pull', 9);
    expect(state.settings.routineMeta?.Pull?.freq).toBe(6);
    await editActions.changeRoutineFreq('Pull', 1);
    expect(state.settings.routineMeta?.Pull?.freq).toBeUndefined();
    await editActions.changeRoutineFreq('Pull', -2);
    expect(state.settings.routineMeta?.Pull?.freq).toBe(0);
    await editActions.changeRoutineFreq('Pull', 2);
    expect(state.settings.routineMeta?.Pull?.freq).toBe(2);
    expect(persisted).toBe(4);

    // saveRoutineModal en modo edit preserva freq
    state.activeModal = { type: 'routine', mode: 'edit', oldName: 'Pull', name: 'Pull', sub: 'Tirón', color: '#3B82F6' };
    const modalActions = createPlanModalActions({
      getState: () => state,
      getLastRoutine: () => 'Push',
      setLastRoutine: () => {},
      setTab: () => {},
      persist: async () => {},
      syncWorkoutRoutineNames: () => {},
      addExToDraft: () => {},
      toast: () => {},
    });
    await modalActions.saveRoutineModal({ name: 'Pull', sub: 'Tirón Pro', color: '#3B82F6' });
    expect(state.settings.routineMeta?.Pull).toEqual({ color: '#3B82F6', sub: 'Tirón Pro', freq: 2 });

    // ExerciseModal no preselecciona Pecho cuando no hay initialName
    const emptyExModal = renderToString(
      h(ExerciseModal, { routines: ['Push', 'Pull'], onSave: () => {}, onClose: () => {} }),
    );
    expect(emptyExModal).toMatch(/<option[^>]*selected[^>]*>Selecciona músculo…<\/option>/);
    expect(emptyExModal).not.toMatch(/value="Pecho"[^>]*selected|selected[^>]*value="Pecho"/);

    // ExerciseModal sugiere Espalda cuando initialName contiene "Remo"
    const rowExModal = renderToString(
      h(ExerciseModal, { routines: ['Push', 'Pull'], initialName: 'Remo gironda', onSave: () => {}, onClose: () => {} }),
    );
    expect(rowExModal).toMatch(/value="Espalda"[^>]*selected|selected[^>]*value="Espalda"/);
  });

  it('conecta profile.daysPerWeek con reparto de plantillas, acciones rápidas y aviso en Simulador', async () => {
    expect(distributeWeeklyFreqs(['Push', 'Pull', 'Leg'], 6)).toEqual({ Push: 2, Pull: 2, Leg: 2 });
    expect(distributeWeeklyFreqs(['Push', 'Pull', 'Leg'], 5)).toEqual({ Push: 2, Pull: 2, Leg: 1 });

    const settings = sanitizeSettings({
      profile: { sex: 'hombre', age: 28, height: 178, daysPerWeek: 5 },
    });
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
    };

    // Desajuste inicial: PPL por defecto suma 3 d/sem frente a perfil = 5 d/sem
    const mismatchHtml = renderToString(h(PlanSidebarWidgets, { state, inline: true }));
    expect(mismatchHtml).toContain('3/5 d/sem');
    expect(mismatchHtml).toContain('Repartir 5 d/sem');
    expect(mismatchHtml).toContain('Usar 3 en perfil');

    // applyRoutineTemplateToState reparte automáticamente según targetDays = 5
    applyRoutineTemplateToState(state, 'ppl', () => 'Push', () => {}, () => {}, 5);
    expect(state.settings.routineMeta?.Push?.freq).toBe(2);
    expect(state.settings.routineMeta?.Pull?.freq).toBe(2);
    expect(state.settings.routineMeta?.Leg?.freq).toBeUndefined();

    // Acciones distributeFreqsToProfileDays y syncProfileDaysToPlan
    const toasts: string[] = [];
    const actions = createRoutineEditActions({
      getState: () => state,
      getLastRoutine: () => 'Push',
      setLastRoutine: () => {},
      persist: async () => {},
      render: () => {},
      syncWorkoutRoutineNames: () => {},
      askConfirm: async () => true,
      toast: (m) => toasts.push(m),
    });

    await actions.syncProfileDaysToPlan(4);
    expect(state.settings.profile.daysPerWeek).toBe(4);
    expect(toasts.at(-1)).toContain('4 d/sem');

    await actions.distributeFreqsToProfileDays();
    expect(state.settings.routineMeta?.Push?.freq).toBe(2);
    expect(state.settings.routineMeta?.Pull?.freq).toBeUndefined();
    expect(state.settings.routineMeta?.Leg?.freq).toBeUndefined();
  });
});
