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
      commitDraft(mapDraftEx(ensureDraft(), ei, (ex) => ({
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
      commitDraft(mapDraftEx(draft, ei, (item) => ({ ...item, sets: [...item.sets, added] })));
    },

    delSet(ei: number, si: number) {
      const draft = ensureDraft();
      const ex = draft.exercises[ei];
      const removedSet = ex?.sets[si];
      if (!ex || !removedSet || ex.sets.length <= 1) return;
      commitDraft(mapDraftEx(draft, ei, (item) => {
        const sets = item.sets.filter((_, j) => j !== si);
        return { ...item, sets, done: sets.some((s) => Boolean(s.done && s.r > 0)) };
      }));
      toast(`Serie ${si + 1} eliminada.`, {
        label: 'Deshacer',
        onAction: () => {
          const cur = ensureDraft();
          if (!cur.exercises[ei]) return;
          commitDraft(mapDraftEx(cur, ei, (item) => {
            const sets = [...item.sets.slice(0, si), removedSet, ...item.sets.slice(si)];
            return { ...item, sets, done: sets.some((s) => Boolean(s.done && s.r > 0)) };
          }));
        },
      });
    },

    removeExercise(ei: number) {
      const draft = ensureDraft();
      const removed = draft.exercises[ei];
      if (!removed) return;
      commitDraft({ ...draft, dirty: true, exercises: draft.exercises.filter((_, i) => i !== ei) });
      toast(`Eliminado «${removed.name}».`, {
        label: 'Deshacer',
        onAction: () => {
          const cur = ensureDraft();
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
