import { deleteKey } from '../lib/db';
import { isValidIsoDate, norm } from '../lib/seed';
import { markBucketDeletes } from '../lib/sync';
import type { DayName, LogDraft, LogExDraft, SetRec } from '../types';
import { moveItem } from '../ui/reorder';
import { routineNames, todayIso, type State } from '../ui/shared';
import { defaultSetsForEx, manualSessionId } from './exerciseCatalog';
import { initLogDraft } from './logSelectors';
import { persistCompletedSession } from './sessionPersistence';

/** Dependencias necesarias para ejecutar acciones en `Registrar hecho`. */
export interface LogActionDeps {
  getState: () => State;
  saveDraftOnly: (draft?: LogDraft) => void;
  commitDraft: (draft?: LogDraft) => void;
  reload: () => Promise<void>;
  setTab: (tab: string) => void;
  queueSync: () => void;
  toast: (msg: string) => void;
  askConfirm: (opts: { title: string; message: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
  openNoteModal: (exName: string) => void;
  onSearchChange: (q: string) => void;
  onStartLiveTab: () => void;
  onOpenNewExerciseModal: () => void;
}

/** Tipo de retorno completo de las acciones de `Registrar hecho`. */
export type LogWorkoutActions = ReturnType<typeof createLogWorkoutActions>;

const mapDraftEx = (
  draft: LogDraft,
  ei: number,
  updater: (ex: LogExDraft) => LogExDraft,
): LogDraft => ({
  ...draft,
  dirty: true,
  exercises: draft.exercises.map((ex, i) => (i === ei ? updater(ex) : ex)),
});

const mapDraftSet = (
  draft: LogDraft,
  ei: number,
  si: number,
  updater: (s: SetRec) => SetRec,
): LogDraft =>
  mapDraftEx(draft, ei, (ex) => {
    const sets = ex.sets.map((s, j) => (j === si ? updater(s) : s));
    return {
      ...ex,
      sets,
      done: sets.some((x) => Boolean(x.done && x.r > 0)),
    };
  });

/**
 * Crea el conjunto de acciones reactivas e inmutables para `Registrar hecho`.
 *
 * @param deps - Puentes al estado, persistencia, confirmaciones y navegación.
 * @returns Métodos tipados para editar borradores históricos sin temporizadores activos.
 */
export function createLogWorkoutActions(deps: LogActionDeps) {
  const ensureDraft = (): LogDraft => {
    const state = deps.getState();
    return state.logDraft ?? initLogDraft(state, routineNames(state.settings)[0] ?? 'Libre', todayIso());
  };

  async function confirmSwitchDraft(nextDay: DayName | 'Libre', nextDate: string, nextSessionId?: string): Promise<boolean> {
    const cur = deps.getState().logDraft;
    if (!cur?.dirty) return true;
    const targetSid = nextSessionId ?? manualSessionId(nextDate, nextDay);
    if (cur.day === nextDay && cur.date === nextDate && (cur.sessionId ?? manualSessionId(cur.date, cur.day)) === targetSid) {
      return true;
    }
    return deps.askConfirm({
      title: 'Cambiar de sesión sin guardar',
      message: 'Tienes series o cambios sin guardar en el entrenamiento actual. Si cambias ahora se descartarán.',
      confirmLabel: 'Descartar cambios',
      danger: true,
    });
  }

  return {
    openLiveWorkoutTab: () => deps.onStartLiveTab(),
    openNewExerciseModal: () => deps.onOpenNewExerciseModal(),
    openFixedNote: (exName: string) => deps.openNoteModal(exName),
    setAddQuery: (q: string) => deps.onSearchChange(q),

    async changeDate(rawDate: string) {
      const state = deps.getState();
      if (!isValidIsoDate(rawDate)) {
        deps.toast('Introduce una fecha válida.');
        deps.commitDraft(state.logDraft);
        return;
      }
      const day = ensureDraft().day;
      if (!(await confirmSwitchDraft(day, rawDate))) {
        deps.commitDraft(state.logDraft);
        return;
      }
      deps.commitDraft(initLogDraft(state, day, rawDate));
    },

    async selectDay(day: DayName | 'Libre') {
      const state = deps.getState();
      const date = ensureDraft().date;
      if (!(await confirmSwitchDraft(day, date))) return;
      deps.commitDraft(initLogDraft(state, day, date));
    },

    async resetDraft() {
      const confirmed = await deps.askConfirm({
        title: 'Reiniciar borrador',
        message: 'Se restaurarán los ejercicios y series por defecto de la rutina actual.',
        confirmLabel: 'Reiniciar',
        danger: true,
      });
      if (!confirmed) return;
      const state = deps.getState();
      const cur = ensureDraft();
      deps.commitDraft(initLogDraft(state, cur.day, cur.date, cur.sessionId));
    },

    toggleExercise(ei: number) {
      const draft = ensureDraft();
      const ex = draft.exercises[ei];
      if (!ex) return;
      const validSets = ex.sets.filter((s) => s.r > 0);
      if (!validSets.length) {
        deps.toast('Indica al menos 1 repetición antes de marcar ✓.');
        return;
      }
      const next = !validSets.every((s) => s.done);
      const nextDraft = mapDraftEx(draft, ei, (item) => ({
        ...item,
        done: next,
        sets: item.sets.map((s) => ({ ...s, done: next ? s.r > 0 : false })),
      }));
      deps.commitDraft({
        ...nextDraft,
        startedAt: next ? nextDraft.startedAt ?? Date.now() : nextDraft.startedAt,
      });
    },

    toggleSet(ei: number, si: number) {
      const draft = ensureDraft();
      const s = draft.exercises[ei]?.sets[si];
      if (!s) return;
      if (!s.done && !(s.r > 0)) {
        deps.toast('Indica al menos 1 repetición antes de marcar la serie ✓.');
        document.querySelector<HTMLInputElement>(`[data-log-r="${ei}|${si}"]`)?.focus?.();
        return;
      }
      const nextDone = !s.done;
      if (nextDone) {
        try {
          navigator?.vibrate?.(15);
        } catch {
          /* vibración opcional */
        }
      }
      const nextDraft = mapDraftSet(draft, ei, si, (set) => ({ ...set, done: nextDone }));
      deps.commitDraft({
        ...nextDraft,
        startedAt: nextDone ? nextDraft.startedAt ?? Date.now() : nextDraft.startedAt,
      });
    },

    applyTargetWeight(ei: number, targetW: number) {
      if (!Number.isFinite(targetW)) return;
      const w = Math.max(0, targetW);
      const draft = ensureDraft();
      deps.commitDraft(mapDraftEx(draft, ei, (ex) => ({
        ...ex,
        sets: ex.sets.map((s) => (s.done ? s : { ...s, w })),
      })));
    },

    addSet(ei: number) {
      const draft = ensureDraft();
      const ex = draft.exercises[ei];
      if (!ex) return;
      const last = ex.sets[ex.sets.length - 1];
      const added = last ? { w: last.w, r: last.r, done: false } : { w: 0, r: 10, done: false };
      deps.commitDraft(mapDraftEx(draft, ei, (item) => ({ ...item, sets: [...item.sets, added] })));
    },

    delSet(ei: number, si: number) {
      const draft = ensureDraft();
      const ex = draft.exercises[ei];
      if (!ex || ex.sets.length <= 1) return;
      deps.commitDraft(mapDraftEx(draft, ei, (item) => {
        const sets = item.sets.filter((_, j) => j !== si);
        return { ...item, sets, done: sets.some((s) => Boolean(s.done && s.r > 0)) };
      }));
    },

    stepWeight(ei: number, si: number, delta: number) {
      const draft = ensureDraft();
      const s = draft.exercises[ei]?.sets[si];
      if (!s || !Number.isFinite(delta)) return;
      const nextW = Math.max(0, Math.round((s.w + delta) * 10) / 10);
      deps.commitDraft(mapDraftSet(draft, ei, si, (set) => ({ ...set, w: nextW })));
    },

    updateWeight(ei: number, si: number, raw: string, finalize = false) {
      const draft = ensureDraft();
      const s = draft.exercises[ei]?.sets[si];
      if (!s) return;
      const trimmed = raw.trim();
      if (!finalize && (!trimmed || /[.,]$/.test(trimmed))) return;
      const nextW = Math.max(0, parseFloat(trimmed.replace(',', '.')) || 0);
      const nextDraft = mapDraftSet(draft, ei, si, (set) => ({ ...set, w: nextW }));
      if (finalize || s.done) deps.commitDraft(nextDraft);
      else deps.saveDraftOnly(nextDraft);
    },

    stepReps(ei: number, si: number, delta: number) {
      const draft = ensureDraft();
      const s = draft.exercises[ei]?.sets[si];
      if (!s || !Number.isFinite(delta)) return;
      const nextR = Math.max(0, s.r + delta);
      const nextDone = nextR === 0 ? false : Boolean(s.done);
      deps.commitDraft(mapDraftSet(draft, ei, si, (set) => ({ ...set, r: nextR, done: nextDone })));
    },

    updateReps(ei: number, si: number, raw: string, finalize = false) {
      const draft = ensureDraft();
      const s = draft.exercises[ei]?.sets[si];
      if (!s) return;
      const trimmed = raw.trim();
      if (!trimmed && !finalize) return;
      const nextR = Math.max(0, parseInt(trimmed, 10) || 0);
      const nextDone = nextR === 0 ? false : Boolean(s.done);
      const nextDraft = mapDraftSet(draft, ei, si, (set) => ({ ...set, r: nextR, done: nextDone }));
      if (finalize || Boolean(s.done) !== nextDone || nextDone) deps.commitDraft(nextDraft);
      else deps.saveDraftOnly(nextDraft);
    },

    updateRest(ei: number, si: number, raw: string) {
      const draft = ensureDraft();
      if (!draft.exercises[ei]?.sets[si]) return;
      const trimmed = raw.trim();
      deps.saveDraftOnly(mapDraftSet(draft, ei, si, (set) => {
        if (!trimmed) {
          const { restSec: _rest, ...clean } = set;
          return clean;
        }
        return { ...set, restSec: Math.min(1800, Math.max(0, Math.round(Number(trimmed) || 0))) };
      }));
    },

    updateRir(ei: number, si: number, raw: string) {
      const draft = ensureDraft();
      if (!draft.exercises[ei]?.sets[si]) return;
      const trimmed = raw.trim();
      deps.saveDraftOnly(mapDraftSet(draft, ei, si, (set) => {
        if (!trimmed) {
          const { rir: _rir, ...clean } = set;
          return clean;
        }
        return { ...set, rir: Math.min(10, Math.max(0, Math.round(Number(trimmed) || 0))) };
      }));
    },

    updateNote(ei: number, note: string) {
      const draft = ensureDraft();
      if (!draft.exercises[ei]) return;
      deps.saveDraftOnly(mapDraftEx(draft, ei, (ex) => ({ ...ex, note })));
    },

    removeExercise(ei: number) {
      const draft = ensureDraft();
      deps.commitDraft({
        ...draft,
        dirty: true,
        exercises: draft.exercises.filter((_, i) => i !== ei),
      });
    },

    moveExercise(ei: number, dir: number) {
      const draft = ensureDraft();
      const exercises = [...draft.exercises];
      if (!moveItem(exercises, ei, ei + dir)) return;
      deps.commitDraft({ ...draft, dirty: true, exercises });
    },

    reorderExercises(from: number, to: number) {
      const draft = ensureDraft();
      const exercises = [...draft.exercises];
      if (!moveItem(exercises, from, to)) return;
      deps.commitDraft({ ...draft, dirty: true, exercises });
    },

    addExerciseByName(rawName: string, fallbackSets?: number, fallbackReps?: number) {
      const clean = rawName.trim();
      if (!clean) return;
      const state = deps.getState();
      const draft = ensureDraft();
      const existingIdx = draft.exercises.findIndex((e) => norm(e.name) === norm(clean));
      deps.onSearchChange('');
      if (existingIdx >= 0) {
        document.querySelector<HTMLElement>(`[data-ex-idx="${existingIdx}"]`)?.scrollIntoView?.({
          behavior: 'smooth',
          block: 'center',
        });
        return;
      }
      const nextEx: LogExDraft = {
        name: clean,
        done: false,
        sets: defaultSetsForEx(state, clean, fallbackSets, fallbackReps, false),
        note: '',
      };
      deps.commitDraft({ ...draft, dirty: true, exercises: [...draft.exercises, nextEx] });
    },

    async saveSession() {
      const state = deps.getState();
      const draft = ensureDraft();
      const saved = await persistCompletedSession(
        state,
        {
          sessionId: draft.sessionId ?? manualSessionId(draft.date, draft.day),
          day: draft.day,
          date: draft.date,
          exercises: draft.exercises,
          replaceExisting: true,
        },
        deps.toast,
      );
      if (!saved) return;
      const savedDay = draft.day;
      deps.commitDraft(undefined);
      await deps.reload();
      if (savedDay !== 'Libre') deps.setTab(savedDay);
      deps.queueSync();
      deps.toast(`Sesión guardada: ${saved} ${saved === 1 ? 'ejercicio' : 'ejercicios'}.`);
    },

    async editHistorySession(sessionId: string, date: string, day: DayName | 'Libre') {
      const nextDay = day || 'Libre';
      if (!(await confirmSwitchDraft(nextDay, date, sessionId || undefined))) return;
      const state = deps.getState();
      deps.commitDraft(initLogDraft(state, nextDay, date, sessionId || undefined));
      window.scrollTo?.(0, 0);
    },

    async deleteHistorySession(sessionId: string, date: string) {
      const state = deps.getState();
      const byId = state.strength.filter((r) => r.sessionId === sessionId);
      const toDel = byId.length ? byId : state.strength.filter((r) => r.date === date);
      if (!toDel.length) return;
      const confirmed = await deps.askConfirm({
        title: `Borrar sesión del ${date}`,
        message: `Se eliminarán ${toDel.length} ${toDel.length === 1 ? 'ejercicio' : 'ejercicios'} de esta sesión. Esta acción no se puede deshacer.`,
        confirmLabel: 'Borrar sesión',
        danger: true,
      });
      if (!confirmed) return;
      for (const r of toDel) await deleteKey('strength', r.id);
      markBucketDeletes('strength', toDel.map((r) => ({ key: r.id, date: r.date })));
      await deps.reload();
      deps.commitDraft(state.logDraft);
      deps.queueSync();
      deps.toast('Sesión borrada.');
    },
  };
}
