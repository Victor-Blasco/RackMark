import { h } from 'preact';
import renderToString from 'preact-render-to-string';
import { describe, expect, it, vi } from 'vitest';
import { maybeOpenInitialWizard, num, splitPair } from '../src/app/context';
import { AiCoachPanel } from '../src/components/home/AiCoachPanel';
import { AiJobStatusBanner } from '../src/components/home/AiJobStatusBanner';
import { ModalHost } from '../src/components/modals/ModalHost';
import { RestTimerBar } from '../src/components/workout/RestTimerBar';
import { fmtMMSS } from '../src/hooks/useRestTimer';
import { buildPayload, buildPrompt } from '../src/lib/ai';
import { analyze } from '../src/lib/analysis';
import { parseBackup, sanitizeDataRecord, sanitizeSettings } from '../src/lib/db';
import { DEFAULT_SETTINGS } from '../src/lib/seed';
import { createPlanActions } from '../src/store/planActions';
import { createLiveWorkoutActions } from '../src/store/workoutActions';
import { createWorkoutLaunchActions } from '../src/store/workoutLaunchActions';
import { initLiveWorkout } from '../src/store/workoutSelectors';
import { moveItem } from '../src/ui/reorder';
import type { State } from '../src/ui/shared';

function makeTestState(): State {
  const settings = sanitizeSettings({
    phases: [
      { name: 'Volumen', start: '2026-09-01' },
      { name: 'Definición', start: '2026-11-01' },
    ],
  });
  return {
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
}

describe('Integración Bloque D: db.ts, ai.ts, componentes Preact, hooks y acciones de store', () => {
  it('valida sanitizeDataRecord en las 4 colecciones y descarta entradas inválidas', () => {
    expect(
      sanitizeDataRecord('strength', {
        id: 's1',
        sessionId: 'sess-1',
        ts: 1000,
        date: '2026-11-15',
        ref: 'name:Sentadilla',
        sets: [{ w: 100, r: 5, restSec: 120 }],
        day: 'Leg',
      }),
    ).toMatchObject({ id: 's1', day: 'Leg', sets: [{ w: 100, r: 5, restSec: 120 }] });
    expect(sanitizeDataRecord('strength', { id: 'bad', date: '2026-11-15', ref: 'name:X', sets: [] })).toBeNull();

    expect(
      sanitizeDataRecord('cardio', {
        id: 'c1',
        ts: 2000,
        date: '2026-11-15',
        type: 1001,
        durMin: 30,
        distKm: 5,
        avgHr: 145,
        kcal: 300,
        vo2: 47.5,
      }),
    ).toMatchObject({ id: 'c1', distKm: 5, vo2: 47.5 });
    expect(sanitizeDataRecord('cardio', { id: 'c-bad', date: '2026-11-15', durMin: 20 })).toBeNull();

    expect(sanitizeDataRecord('measures', { date: '2026-11-15', weight: 74.2, bf: 14.5, note: 'ayunas' })).toEqual({
      date: '2026-11-15',
      weight: 74.2,
      bf: 14.5,
      note: 'ayunas',
    });
    expect(sanitizeDataRecord('measures', { date: 'no-date', weight: 70 })).toBeNull();

    expect(sanitizeDataRecord('wellbeing', { date: '2026-11-15', sleepMin: 450, steps: 10000, hrv: 68 })).toEqual({
      date: '2026-11-15',
      sleepMin: 450,
      steps: 10000,
      hrv: 68,
    });

    const backup = parseBackup(
      JSON.stringify({
        version: 1,
        strength: [{ id: 's1', date: '2026-11-15', ref: 'name:Press', sets: [{ w: 60, r: 8 }] }],
        cardio: [],
        measures: [{ date: '2026-11-15', weight: 74 }],
        wellbeing: [{ date: '2026-11-15', steps: 8500 }],
        settings: DEFAULT_SETTINGS,
      }),
    );
    expect(backup.strength).toHaveLength(1);
    expect(backup.measures).toHaveLength(1);
    expect(backup.wellbeing).toHaveLength(1);
  });

  it('construye payload y prompts de IA diferenciando tono simple y technical (ai.ts)', () => {
    const state = makeTestState();
    const payload = buildPayload(
      state.analysis,
      [{ date: '2026-11-15', weight: 74, bf: 15 }],
      state.settings,
      [],
      [{ date: '2026-11-15', sleepMin: 440, steps: 9200, hrv: 64 }],
    );
    expect(payload.perfil.age).toBe(DEFAULT_SETTINGS.profile.age);

    const simplePrompt = buildPrompt(payload, 'simple');
    const techPrompt = buildPrompt(payload, 'technical');
    expect(simplePrompt).toContain('entrenador personal cercano y claro');
    expect(techPrompt).toContain('fisiólogo y entrenador de fuerza e hipertrofia');
  });

  it('muestra estado persistente de generación y conserva el informe anterior', () => {
    const state = makeTestState();
    state.settings.ai = {
      date: '2026-11-15',
      summary: 'Informe anterior',
      byExercise: {},
    };
    state.aiJob = {
      id: 'ai-test',
      status: 'error',
      tone: 'technical',
      payload: {},
      createdAt: 1,
      updatedAt: 2,
      attempts: 1,
      error: 'Tiempo agotado al generar el informe.',
    };
    const html = renderToString(h(AiJobStatusBanner, { job: state.aiJob }));
    expect(html).toContain('No se pudo generar el informe');
    expect(html).toContain('Reintentar');
    expect(state.settings.ai.summary).toBe('Informe anterior');
  });

  it('normaliza títulos sencillos del informe sin truncarlos en las pestañas', () => {
    const state = makeTestState();
    state.settings.aiTone = 'simple';
    state.aiTab = 1;
    state.settings.ai = {
      date: '2026-11-15',
      tone: 'simple',
      byExercise: {},
      overview: {
        overallStatus: 'Bien',
        highlights: [],
        sections: [{
          title: 'Peso y forma física',
          verdict: 'good',
          text: 'Evolución estable.',
        }],
      },
    };
    const html = renderToString(h(AiCoachPanel, { state, tone: 'simple' }));
    expect(html).toContain('Peso y forma física');
    expect(html).toContain('<span>Cuerpo</span>');
  });

  it('formatea descanso declarativo en RestTimerBar, fmtMMSS y reordenación inmutable (reorder.ts)', () => {
    expect(fmtMMSS(75)).toBe('1:15');

    const idleHtml = renderToString(h(RestTimerBar, { targetRestSec: 90 }));
    expect(idleHtml).toContain('id="rest-timer-bar"');
    expect(idleHtml).toContain('data-rest-state="idle"');

    const runningHtml = renderToString(h(RestTimerBar, { restUntil: Date.now() + 75_000, targetRestSec: 90 }));
    expect(runningHtml).toContain('id="rest-timer-bar"');
    expect(runningHtml).toContain('data-rest-state="running"');
    expect(runningHtml).toContain('id="rest-timer-val"');

    const items = ['A', 'B', 'C'];
    expect(moveItem(items, 0, 2)).toBe(true);
    expect(items).toEqual(['B', 'C', 'A']);
    expect(moveItem(items, 1, 1)).toBe(false);
  });

  it('ejecuta flujos clave del store: deletePhase con askConfirm, ModalHost, startRest y wizard inicial', async () => {
    const state = makeTestState();
    state.liveWorkout = initLiveWorkout(state, 'Push');

    const renderSpy = vi.fn();
    const persistSpy = vi.fn(async () => {});
    const askConfirmSpy = vi.fn(async () => false);
    const launch = createWorkoutLaunchActions({
      getState: () => state,
      setTab: () => {},
      render: renderSpy,
      saveDraft: () => {},
      saveLive: () => {},
      askConfirm: askConfirmSpy,
    });
    const planActions = createPlanActions({
      getState: () => state,
      getLastRoutine: () => 'Push',
      setLastRoutine: () => {},
      persist: persistSpy,
      render: renderSpy,
      setTab: () => {},
      navigateTab: () => {},
      syncWorkoutRoutineNames: () => {},
      addExToDraft: () => {},
      askConfirm: askConfirmSpy,
      toast: () => {},
      startWorkoutDay: launch.startWorkoutDay,
      openLogDay: launch.openLogDay,
      runAiAnalysis: () => {},
      retryAiAnalysis: () => {},
      dismissAiJob: () => {},
      openWizard: () => {},
      closeModal: () => {
        state.activeModal = null;
      },
    });
    const workoutActions = createLiveWorkoutActions({
      getState: () => state,
      saveLiveOnly: (live) => {
        state.liveWorkout = live;
      },
      commitLive: (live) => {
        state.liveWorkout = live;
      },
      reload: async () => {},
      setTab: () => {},
      queueSync: () => {},
      toast: () => {},
      askConfirm: askConfirmSpy,
      openNoteModal: () => {},
      showSummary: () => {},
    });

    // 1. Modal de confirmación declarativo vía State.activeModal
    state.activeModal = { type: 'confirm', title: '¿Borrar fase?', message: 'Acción irreversible' };
    const confirmHtml = renderToString(h(ModalHost, { state }));
    expect(confirmHtml).toContain('id="confirm-modal"');
    expect(confirmHtml).toContain('¿Borrar fase?');
    state.activeModal = null;

    // 2. deletePhase cancelado en askConfirm no borra la fase
    await planActions.deletePhase(0);
    expect(askConfirmSpy).toHaveBeenCalledTimes(1);
    expect(state.settings.phases).toHaveLength(2);

    // 3. deletePhase confirmado borra la fase y persiste
    askConfirmSpy.mockResolvedValueOnce(true);
    await planActions.deletePhase(0);
    expect(state.settings.phases).toHaveLength(1);
    expect(state.settings.phases[0].name).toBe('Definición');
    expect(persistSpy).toHaveBeenCalledTimes(1);

    // 4. startRest actualiza liveWorkout de forma inmutable sin invocar render de otras vistas
    renderSpy.mockClear();
    workoutActions.startRest(120);
    expect(renderSpy).not.toHaveBeenCalled();
    expect(state.liveWorkout?.targetRestSec).toBe(120);
    const barHtml = renderToString(
      h(RestTimerBar, { restUntil: state.liveWorkout?.restUntil, targetRestSec: state.liveWorkout?.targetRestSec }),
    );
    expect(barHtml).toContain('data-rest-state="running"');
    launch.clearActiveWorkouts();
    expect(state.liveWorkout).toBeUndefined();

    // 5. Utilidades de contexto y apertura única del wizard inicial en activeModal
    expect(splitPair('Push|Press de banca')).toEqual(['Push', 'Press de banca']);
    expect(num('72,5')).toBe(72.5);
    expect(maybeOpenInitialWizard(state)).toBe(true);
    expect((state as State).activeModal?.type).toBe('wizard');
    expect(maybeOpenInitialWizard(state)).toBe(false);
  });
});
