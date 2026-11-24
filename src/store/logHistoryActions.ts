import { deleteKey } from '../lib/db';
import { markBucketDeletes } from '../lib/sync';
import type { DayName, LogDraft } from '../types';
import type { State } from '../ui/shared';
import { manualSessionId } from './exerciseCatalog';
import { initLogDraft } from './logSelectors';
import { persistCompletedSession } from './sessionPersistence';
import type { ConfirmModalOpts } from './types';

/** Subconjunto de dependencias necesarias para guardar, editar o borrar sesiones en el historial. */
export interface LogHistoryDeps {
  getState: () => State;
  commitDraft: (draft?: LogDraft) => void;
  reload: () => Promise<void>;
  setTab: (tab: string) => void;
  queueSync: () => void;
  toast: (msg: string) => void;
  askConfirm: (opts: ConfirmModalOpts) => Promise<boolean>;
}

/**
 * Crea las acciones de persistencia y gestión del historial de `Registrar hecho`.
 *
 * @param deps - Puentes de estado, almacenamiento local y sincronización.
 * @param ensureDraft - Garantiza un borrador activo.
 * @param confirmSwitchDraft - Confirma descartar cambios antes de cargar otra sesión.
 * @returns Manejadores para guardar, editar y eliminar sesiones históricas.
 */
export function createLogHistoryActions(
  deps: LogHistoryDeps,
  ensureDraft: () => LogDraft,
  confirmSwitchDraft: (nextDay: DayName | 'Libre', nextDate: string, nextSessionId?: string) => Promise<boolean>,
) {
  return {
    async saveSession() {
      const state = deps.getState();
      const draft = ensureDraft();
      const hasAnyDone = draft.exercises.some((ex) => ex.sets.some((s) => s.done && s.r > 0));
      const unmarkedWithNotes = draft.exercises.filter(
        (ex) => ex.note.trim().length > 0 && !ex.sets.some((s) => s.done && s.r > 0),
      );
      if (hasAnyDone && unmarkedWithNotes.length > 0) {
        const names = unmarkedWithNotes.map((e) => e.name).join(', ');
        const confirmed = await deps.askConfirm({
          title: 'Ejercicios con nota sin marcar',
          message: `Estos ejercicios tienen nota escrita pero ninguna serie marcada con ✓ y no se guardarán: ${names}. ¿Guardar igualmente?`,
          confirmLabel: 'Guardar sin ellos',
          danger: true,
        });
        if (!confirmed) return;
      }
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
      deps.commitDraft(initLogDraft(deps.getState(), nextDay, date, sessionId || undefined));
      if (deps.getState().tab !== 'log') deps.setTab('log');
      if (typeof window !== 'undefined') window.scrollTo?.(0, 0);
    },

    async deleteHistorySession(sessionId: string, date: string) {
      const state = deps.getState();
      const toDel = sessionId
        ? state.strength.filter((r) => r.sessionId === sessionId)
        : state.strength.filter((r) => r.date === date);
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
      const curDraft = deps.getState().logDraft;
      const editingDeleted = curDraft && (sessionId ? curDraft.sessionId === sessionId : curDraft.date === date);
      deps.commitDraft(editingDeleted ? undefined : curDraft);
      deps.queueSync();
      deps.toast('Sesión borrada.');
    },
  };
}
