import type { LogDraft, LogExDraft, SetRec } from '../types';

export const mapDraftEx = (
  draft: LogDraft,
  ei: number,
  updater: (ex: LogExDraft) => LogExDraft,
): LogDraft => ({
  ...draft,
  dirty: true,
  exercises: draft.exercises.map((ex, i) => (i === ei ? updater(ex) : ex)),
});

export const mapDraftSet = (
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

const clampOptionalInt = (raw: string, max: number): number | undefined => {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return Math.min(max, Math.max(0, Math.round(Number(trimmed) || 0)));
};

/**
 * Crea las acciones de edición numérica (`kg`, `reps`, `descanso`, `RIR`) y notas de `Registrar hecho`.
 *
 * @param ensureDraft - Garantiza la existencia de un borrador inicializado.
 * @param saveDraftOnly - Guarda el borrador en `localStorage` sin forzar render.
 * @param commitDraft - Guarda el borrador y notifica a Preact.
 * @returns Manejadores de steppers e inputs numéricos/notas.
 */
export function createLogInputActions(
  ensureDraft: () => LogDraft,
  saveDraftOnly: (draft?: LogDraft) => void,
  commitDraft: (draft?: LogDraft) => void,
) {
  const setOptionalIntField = (ei: number, si: number, raw: string, key: 'restSec' | 'rir', max: number) => {
    const draft = ensureDraft();
    if (!draft.exercises[ei]?.sets[si]) return;
    const val = clampOptionalInt(raw, max);
    saveDraftOnly(
      mapDraftSet(draft, ei, si, (set) => {
        if (val == null) {
          const { [key]: _removed, ...clean } = set;
          return clean;
        }
        return { ...set, [key]: val };
      }),
    );
  };

  return {
    stepWeight(ei: number, si: number, delta: number) {
      const draft = ensureDraft();
      const s = draft.exercises[ei]?.sets[si];
      if (!s || !Number.isFinite(delta)) return;
      const nextW = Math.max(0, Math.round((s.w + delta) * 10) / 10);
      commitDraft(mapDraftSet(draft, ei, si, (set) => ({ ...set, w: nextW })));
    },

    updateWeight(ei: number, si: number, raw: string, finalize = false) {
      const draft = ensureDraft();
      const s = draft.exercises[ei]?.sets[si];
      if (!s) return;
      const trimmed = raw.trim();
      if (!finalize && (!trimmed || /[.,]$/.test(trimmed))) return;
      const nextW = Math.max(0, parseFloat(trimmed.replace(',', '.')) || 0);
      const nextDraft = mapDraftSet(draft, ei, si, (set) => ({ ...set, w: nextW }));
      if (finalize || s.done) commitDraft(nextDraft);
      else saveDraftOnly(nextDraft);
    },

    stepReps(ei: number, si: number, delta: number) {
      const draft = ensureDraft();
      const s = draft.exercises[ei]?.sets[si];
      if (!s || !Number.isFinite(delta)) return;
      const nextR = Math.max(0, s.r + delta);
      commitDraft(mapDraftSet(draft, ei, si, (set) => ({ ...set, r: nextR, done: nextR === 0 ? false : Boolean(set.done) })));
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
      if (finalize || Boolean(s.done) !== nextDone || nextDone) commitDraft(nextDraft);
      else saveDraftOnly(nextDraft);
    },

    updateRest: (ei: number, si: number, raw: string) => setOptionalIntField(ei, si, raw, 'restSec', 1800),
    updateRir: (ei: number, si: number, raw: string) => setOptionalIntField(ei, si, raw, 'rir', 10),

    updateNote(ei: number, note: string) {
      const draft = ensureDraft();
      if (!draft.exercises[ei]) return;
      saveDraftOnly(mapDraftEx(draft, ei, (ex) => ({ ...ex, note })));
    },
  };
}
