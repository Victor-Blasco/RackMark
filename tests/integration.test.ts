import { describe, expect, it, vi } from 'vitest';
import { createPlanController } from '../src/app/planController';
import { createWorkoutController } from '../src/app/workoutController';
import { maybeOpenInitialWizard, num, splitPair, type AppContext } from '../src/app/context';
import { buildPayload, buildPrompt } from '../src/lib/ai';
import { analyze } from '../src/lib/analysis';
import { parseBackup, sanitizeDataRecord, sanitizeSettings } from '../src/lib/db';
import { DEFAULT_SETTINGS } from '../src/lib/seed';
import { focusSelector, updateNavRestBadges, updateRestBarDom } from '../src/ui/domPatches';
import { moveItem } from '../src/ui/reorder';
import type { State } from '../src/ui/shared';
import { initLiveWorkout } from '../src/ui/workoutView';
import { renderAiJobStatus } from '../src/ui/views';

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

function makeFakeElement(opts: {
  id?: string;
  name?: string;
  dataset?: Record<string, string>;
  inMeasureForm?: boolean;
}): HTMLElement {
  const proto = typeof HTMLElement !== 'undefined' ? HTMLElement.prototype : Object.prototype;
  const el = Object.create(proto) as HTMLElement & { name?: string };
  Object.defineProperty(el, 'id', { value: opts.id ?? '', configurable: true });
  Object.defineProperty(el, 'dataset', { value: opts.dataset ?? {}, configurable: true });
  if (opts.name) el.name = opts.name;
  el.closest = ((sel: string) => (sel === '#f-measure' && opts.inMeasureForm ? ({} as Element) : null)) as HTMLElement['closest'];
  return el;
}

describe('Integración Fase 4: db.ts, ai.ts, domPatches.ts, reorder.ts y controladores src/app/*', () => {
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
    const html = renderAiJobStatus(state);
    expect(html).toContain('No se pudo generar el informe');
    expect(html).toContain('Reintentar');
    expect(state.settings.ai.summary).toBe('Informe anterior');
  });

  it('resuelve selectores de foco y parches DOM sin reconstruir la vista (domPatches.ts & reorder.ts)', () => {
    if (typeof HTMLElement !== 'undefined') {
      expect(focusSelector(makeFakeElement({ id: 'wizardNext' }))).toBe('#wizardNext');
      expect(focusSelector(makeFakeElement({ dataset: { liveR: '0|1' } }))).toBe('[data-live-r="0|1"]');
      expect(focusSelector(makeFakeElement({ dataset: { logW: '2|0' } }))).toBe('[data-log-w="2|0"]');
      expect(focusSelector(makeFakeElement({ name: 'weight', inMeasureForm: true }))).toBe('#f-measure [name="weight"]');
      expect(focusSelector(makeFakeElement({ dataset: { act: 'selEx', arg: 'Push|Press' } }))).toBe(
        '[data-act="selEx"][data-arg="Push|Press"]',
      );
    }

    const badge = {
      textContent: '',
      classList: { remove: vi.fn(), add: vi.fn(), toggle: vi.fn() },
    };
    const bar = { outerHTML: '', dataset: {} };
    const fakeRoot = {
      querySelectorAll: (sel: string) => (sel === '[data-nav-rest]' ? [badge] : []),
      querySelector: (sel: string) => (sel === '#rest-timer-bar' ? bar : null),
    } as unknown as HTMLElement;

    updateNavRestBadges(fakeRoot, 75);
    expect(badge.textContent).toBe('1:15');
    expect(badge.classList.toggle).toHaveBeenCalledWith('hidden', false);

    const state = makeTestState();
    state.liveWorkout = initLiveWorkout(state, 'Push');
    updateRestBarDom(fakeRoot, state);
    expect(bar.outerHTML).toContain('id="rest-timer-bar"');

    const items = ['A', 'B', 'C'];
    expect(moveItem(items, 0, 2)).toBe(true);
    expect(items).toEqual(['B', 'C', 'A']);
    expect(moveItem(items, 1, 1)).toBe(false);
  });

  it('ejecuta flujos clave de controladores en src/app/*: phaseDel con askConfirm y restStart sin render completo', async () => {
    const state = makeTestState();
    state.liveWorkout = initLiveWorkout(state, 'Push');

    const bar = { outerHTML: '', dataset: {} };
    const restInput = { placeholder: '' };
    const fakeRoot = {
      querySelector: (sel: string) => (sel === '#rest-timer-bar' ? bar : null),
      querySelectorAll: (sel: string) => (sel === '[data-live-rest]' ? [restInput] : []),
    } as unknown as HTMLElement;

    const renderSpy = vi.fn();
    const persistSpy = vi.fn(async () => {});
    const askConfirmSpy = vi.fn(async () => false);

    const ctx: AppContext = {
      state,
      root: fakeRoot,
      render: renderSpy,
      reload: async () => {},
      persist: persistSpy,
      toast: () => {},
      setTab: () => {},
      getLastRoutine: () => 'Push',
      setLastRoutine: () => {},
      queueSync: () => {},
      updateSyncDom: () => {},
      askConfirm: askConfirmSpy,
      clearActiveWorkouts: () => {},
      addExToDraft: () => {},
      syncWorkoutRoutineNames: () => {},
    };

    const planCtrl = createPlanController(ctx);
    const workoutCtrl = createWorkoutController(ctx);

    // 1. phaseDel cancelado en askConfirm no borra la fase
    await planCtrl.actions.phaseDel({ dataset: { arg: '0' } } as unknown as HTMLElement);
    expect(askConfirmSpy).toHaveBeenCalledTimes(1);
    expect(state.settings.phases).toHaveLength(2);

    // 2. phaseDel confirmado borra la fase y persiste
    askConfirmSpy.mockResolvedValueOnce(true);
    await planCtrl.actions.phaseDel({ dataset: { arg: '0' } } as unknown as HTMLElement);
    expect(state.settings.phases).toHaveLength(1);
    expect(state.settings.phases[0].name).toBe('Definición');
    expect(persistSpy).toHaveBeenCalledTimes(1);

    // 3. restStart actualiza la barra de descanso sin disparar ctx.render()
    renderSpy.mockClear();
    workoutCtrl.actions.restStart({ dataset: { arg: '120' } } as unknown as HTMLElement);
    expect(renderSpy).not.toHaveBeenCalled();
    expect(state.liveWorkout?.targetRestSec).toBe(120);
    expect(restInput.placeholder).toBe('120');
    expect(bar.outerHTML).toContain('data-rest-state="running"');
    workoutCtrl.clearActiveWorkouts();

    // 4. Utilidades de contexto
    expect(splitPair('Push|Press de banca')).toEqual(['Push', 'Press de banca']);
    expect(num('72,5')).toBe(72.5);
    expect(maybeOpenInitialWizard(state)).toBe(true);
  });
});
