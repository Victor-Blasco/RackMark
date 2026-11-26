import { h } from 'preact';
import renderToString from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import { buildPayload } from '../src/lib/ai';
import { analyze, describeStatus, judge } from '../src/lib/analysis';
import { parseBackup, sanitizeSettings } from '../src/lib/db';
import { DEFAULT_SETTINGS } from '../src/lib/seed';
import { WorkoutSummaryModal } from '../src/components/modals/WorkoutSummaryModal';
import { PlanCatalogList } from '../src/components/plan/PlanCatalogList';
import { LiveExerciseMenu } from '../src/components/workout/LiveExerciseMenu';
import { LiveHeader } from '../src/components/workout/LiveHeader';
import { PrevCompletedBanner } from '../src/components/workout/LiveStatusBanners';
import { RestTimerBar } from '../src/components/workout/RestTimerBar';
import { manualSessionId } from '../src/store/exerciseCatalog';
import { createLogHistoryActions } from '../src/store/logHistoryActions';
import { createLogInputActions } from '../src/store/logInputActions';
import { initLogDraft } from '../src/store/logSelectors';
import { createLogSetActions } from '../src/store/logSetActions';
import { getPlanCatalogData } from '../src/store/planSelectors';
import { buildWorkoutSummary } from '../src/store/sessionPersistence';
import { volumeRangeForProfile } from '../src/store/volumeSelectors';
import { createWorkoutPickerActions } from '../src/store/workoutPickerActions';
import { createWorkoutRestActions } from '../src/store/workoutRestActions';
import { buildExerciseCompletionSummary, initLiveWorkout } from '../src/store/workoutSelectors';
import { applyToggleLiveSet } from '../src/store/workoutSetToggle';
import { createWorkoutSetActions } from '../src/store/workoutSetActions';
import { captureFlipRects, moveItem, playFlipRects } from '../src/ui/reorder';
import {
  findAiExercise,
  isAiFreshForEx,
  todayIso,
  type State,
} from '../src/ui/shared';
import { BodyView } from '../src/views/BodyView';
import { DayRoutineView } from '../src/views/DayRoutineView';
import { HomeView } from '../src/views/HomeView';
import { LiveWorkoutView } from '../src/views/LiveWorkoutView';
import { LogWorkoutView } from '../src/views/LogWorkoutView';
import { SettingsView } from '../src/views/SettingsView';
import { VolumeView } from '../src/views/VolumeView';

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

describe('workout: descansos, FLIP, auto-marcado y orden real', () => {
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

  it('buildWorkoutSummary y WorkoutSummaryModal detectan extras de En vivo sin alterar la rutina y permiten fijarlos', async () => {
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
    const baseLive = initLiveWorkout(state, 'Push');
    const toasts: string[] = [];
    let currentState: State = { ...state, liveWorkout: { ...baseLive, pickerMode: 'add' } };
    const picker = createWorkoutPickerActions(
      () => currentState,
      () => currentState.liveWorkout,
      (next) => {
        currentState = { ...currentState, liveWorkout: next };
      },
      (msg) => toasts.push(msg),
    );
    await picker.pickExercise('Face pull');
    expect(toasts.at(-1)).toContain('solo a la sesión de hoy');

    const withDoneExtra = {
      ...currentState.liveWorkout!,
      exercises: currentState.liveWorkout!.exercises.map((ex) =>
        ex.name === 'Face pull'
          ? { ...ex, sets: [{ w: 20, r: 15, done: true }, { w: 20, r: 15, done: true }] }
          : ex,
      ),
    };
    const summary = buildWorkoutSummary(currentState, withDoneExtra, 1);
    expect(summary.extraExercises).toEqual([{ name: 'Face pull', sets: 2, reps: 15 }]);
    expect(currentState.settings.routines.Push.some((r) => r.name === 'Face pull')).toBe(false);

    const modalHtml = renderToString(
      h(WorkoutSummaryModal, {
        summary,
        routineExNames: currentState.settings.routines.Push.map((r) => r.name),
        onAddExtraToRoutine: () => {},
        onClose: () => {},
      }),
    );
    expect(modalHtml).toContain('Guardado solo en el historial de hoy');
    expect(modalHtml).toContain('+ Fijar en Push');
  });
});
