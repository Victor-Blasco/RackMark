import type { LogDraft } from '../types';
import { moveItem } from '../ui/reorder';
import { mapDraftEx, mapDraftSet } from './logInputActions';
import type { ToastAction } from './types';

export { mapDraftEx, mapDraftSet };

/**
 * Crea las acciones inmutables sobre series y orden de ejercicios para `Registrar hecho`.
 *
 * @param ensureDraft - Garantiza la existencia de un borrador inicializado.
 * @param commitDraft - Guarda el borrador y notifica a Preact.
 * @param toast - Muestra avisos de validación al usuario (con acción opcional `Deshacer`).
 * @returns Manejadores para marcar, añadir, quitar y reordenar series o ejercicios.
 */
export function createLogSetActions(
  ensureDraft: () => LogDraft,
  commitDraft: (draft?: LogDraft) => void,
  toast: (msg: string, action?: ToastAction) => void,
) {
  return {
    toggleExercise(ei: number) {
      const draft = ensureDraft();
      const ex = draft.exercises[ei];
      if (!ex) return;
      const validSets = ex.sets.filter((s) => s.r > 0);
      if (!validSets.length) {
        toast('Indica al menos 1 repetición antes de marcar ✓.');
        return;
      }
      const next = !validSets.every((s) => s.done);
      const nextDraft = mapDraftEx(draft, ei, (item) => ({
        ...item,
        done: next,
        sets: item.sets.map((s) => ({ ...s, done: next ? s.r > 0 : false })),
      }));
      commitDraft({
        ...nextDraft,
        startedAt: next ? nextDraft.startedAt ?? Date.now() : nextDraft.startedAt,
      });
    },

    toggleSet(ei: number, si: number) {
      const draft = ensureDraft();
      const s = draft.exercises[ei]?.sets[si];
      if (!s) return;
      if (!s.done && !(s.r > 0)) {
        toast('Indica al menos 1 repetición antes de marcar la serie ✓.');
        return;
      }
      const nextDone = !s.done;
      if (nextDone) {
        try { navigator?.vibrate?.(15); } catch { /* vibración opcional */ }
      }
      const nextDraft = mapDraftSet(draft, ei, si, (set) => ({ ...set, done: nextDone }));
      commitDraft({
        ...nextDraft,
        startedAt: nextDone ? nextDraft.startedAt ?? Date.now() : nextDraft.startedAt,
      });
    },

    applyTargetWeight(ei: number, targetW: number) {
      if (!Number.isFinite(targetW)) return;
      const w = Math.max(0, targetW);
      commitDraft(mapDraftEx(ensureDraft(), ei, (ex) => {
        const sets = ex.sets.map((s) => (s.done ? s : { ...s, w, done: s.r > 0 }));
        return { ...ex, sets, done: sets.some((s) => Boolean(s.done && s.r > 0)) };
      }));
    },

    toggleAllSets() {
      const draft = ensureDraft();
      const validSets = draft.exercises.flatMap((ex) => ex.sets.filter((s) => s.r > 0));
      if (!validSets.length) {
        toast('Indica al menos 1 repetición antes de marcar ✓.');
        return;
      }
      const next = !validSets.every((s) => s.done);
      const exercises = draft.exercises.map((ex) => {
        const sets = ex.sets.map((s) => ({ ...s, done: next ? s.r > 0 : false }));
        return { ...ex, sets, done: sets.some((s) => Boolean(s.done && s.r > 0)) };
      });
      commitDraft({
        ...draft,
        dirty: true,
        exercises,
        startedAt: next ? draft.startedAt ?? Date.now() : draft.startedAt,
      });
    },

    addSet(ei: number) {
      const draft = ensureDraft();
      const ex = draft.exercises[ei];
      if (!ex) return;
      const last = ex.sets[ex.sets.length - 1];
      const r = last ? last.r : 10;
      const added = { w: last ? last.w : 0, r, done: r > 0 };
      commitDraft(mapDraftEx(draft, ei, (item) => {
        const sets = [...item.sets, added];
        return { ...item, sets, done: sets.some((s) => Boolean(s.done && s.r > 0)) };
      }));
    },

    delSet(ei: number, si: number) {
      const draft = ensureDraft();
      const ex = draft.exercises[ei];
      const removedSet = ex?.sets[si];
      if (!ex || !removedSet || ex.sets.length <= 1) return;
      const draftKey = `${draft.date}|${draft.day}|${draft.sessionId ?? ''}`;
      const exName = ex.name;
      commitDraft(mapDraftEx(draft, ei, (item) => {
        const sets = item.sets.filter((_, j) => j !== si);
        return { ...item, sets, done: sets.some((s) => Boolean(s.done && s.r > 0)) };
      }));
      toast(`Serie ${si + 1} eliminada.`, {
        label: 'Deshacer',
        onAction: () => {
          const cur = ensureDraft();
          if (`${cur.date}|${cur.day}|${cur.sessionId ?? ''}` !== draftKey) return;
          const targetEi = cur.exercises[ei]?.name === exName ? ei : cur.exercises.findIndex((x) => x.name === exName);
          if (targetEi < 0) return;
          commitDraft(mapDraftEx(cur, targetEi, (item) => {
            const idx = Math.min(si, item.sets.length);
            const sets = [...item.sets.slice(0, idx), removedSet, ...item.sets.slice(idx)];
            return { ...item, sets, done: sets.some((s) => Boolean(s.done && s.r > 0)) };
          }));
        },
      });
    },

    removeExercise(ei: number) {
      const draft = ensureDraft();
      const removed = draft.exercises[ei];
      if (!removed) return;
      const draftKey = `${draft.date}|${draft.day}|${draft.sessionId ?? ''}`;
      commitDraft({ ...draft, dirty: true, exercises: draft.exercises.filter((_, i) => i !== ei) });
      toast(`Eliminado «${removed.name}».`, {
        label: 'Deshacer',
        onAction: () => {
          const cur = ensureDraft();
          if (`${cur.date}|${cur.day}|${cur.sessionId ?? ''}` !== draftKey) return;
          const list = cur.exercises;
          if (list.some((e) => e.name === removed.name)) return;
          const idx = Math.min(ei, list.length);
          commitDraft({ ...cur, dirty: true, exercises: [...list.slice(0, idx), removed, ...list.slice(idx)] });
        },
      });
    },

    moveExercise(ei: number, dir: number) {
      const draft = ensureDraft();
      const exercises = [...draft.exercises];
      if (!moveItem(exercises, ei, ei + dir)) return;
      commitDraft({ ...draft, dirty: true, exercises });
    },

    reorderExercises(from: number, to: number) {
      const draft = ensureDraft();
      const exercises = [...draft.exercises];
      if (!moveItem(exercises, from, to)) return;
      commitDraft({ ...draft, dirty: true, exercises });
    },
  };
}
