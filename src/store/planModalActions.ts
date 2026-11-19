import { putMany } from '../lib/db';
import { ROUTINE_COLORS, norm } from '../lib/seed';
import { markBucketUpserts } from '../lib/sync';
import type { DayName, RoutineEx } from '../types';
import { routineNames, type State } from '../ui/shared';
import { allExerciseNames } from './exerciseCatalog';
import { RESERVED_ROUTINE_NORMS } from './navigation';

/** Datos enviados desde el modal de creación de ejercicio. */
export interface SaveExercisePayload {
  name: string;
  primary: string;
  secondary: string[];
  sets: number;
  reps: number;
  routine: string;
}

/** Datos enviados desde el modal de creación o edición de rutina. */
export interface SaveRoutinePayload {
  name: string;
  sub: string;
  color: string;
}

/** Dependencias para guardar cambios de los modales de ejercicio y rutina. */
export interface PlanModalDeps {
  getState: () => State;
  getLastRoutine: () => DayName;
  setLastRoutine: (day: DayName) => void;
  setTab: (tab: string) => void;
  persist: () => Promise<void>;
  syncWorkoutRoutineNames: (oldName?: string, newName?: string) => void;
  addExToDraft: (name: string, fallbackSets?: number, fallbackReps?: number) => void;
  toast: (msg: string) => void;
}

/**
 * Crea los guardados de formulario para `<ExerciseModal />` y `<RoutineModal />`.
 *
 * @param deps - Puentes al estado, persistencia, sincronización y avisos.
 * @returns Métodos `saveExerciseModal` y `saveRoutineModal`.
 */
export function createPlanModalActions(deps: PlanModalDeps) {
  const state = () => deps.getState();

  return {
    async saveExerciseModal(payload: SaveExercisePayload) {
      const S = state();
      const rawName = payload.name.trim().slice(0, 80);
      if (!rawName) return;
      const modal = S.activeModal?.type === 'exercise' ? S.activeModal : undefined;
      const existingName = allExerciseNames(S).find((n) => norm(n) === norm(rawName));
      if (existingName && !modal?.fromLog && modal?.rowIdx == null) {
        deps.toast(`Ya existe "${existingName}" en tu biblioteca.`);
        return;
      }
      const finalName = existingName ?? rawName;
      const sec = payload.secondary.filter((m) => m && m !== payload.primary);
      const muscles = payload.primary
        ? { ...S.settings.muscles, [norm(finalName)]: { p: payload.primary, s: [...new Set(sec)] } }
        : S.settings.muscles;
      const customNames = existingName
        ? S.settings.customNames
        : { ...S.settings.customNames, [`manual:${norm(finalName)}`]: finalName };
      const sets = Math.max(1, Math.min(20, Math.round(payload.sets || 3)));
      const reps = Math.max(1, Math.min(100, Math.round(payload.reps || 10)));
      const targetRoutine = (payload.routine || modal?.routine || '').trim();
      let routines = S.settings.routines;
      if (!modal?.fromLog && targetRoutine && S.settings.routines[targetRoutine]) {
        const list = [...S.settings.routines[targetRoutine]];
        if (modal?.rowIdx != null && modal.routine === targetRoutine && list[modal.rowIdx]) {
          list[modal.rowIdx] = { name: finalName, sets, reps };
        } else {
          list.push({ name: finalName, sets, reps });
        }
        routines = { ...S.settings.routines, [targetRoutine]: list };
      }
      S.settings = { ...S.settings, muscles, customNames, routines };
      if (S.activeModal?.type === 'exercise') S.activeModal = null;
      await deps.persist();
      if (modal?.fromLog) deps.addExToDraft(finalName, sets, reps);
      deps.toast(existingName ? `Ejercicio "${finalName}" actualizado.` : `Ejercicio "${finalName}" creado.`);
    },

    async saveRoutineModal(payload: SaveRoutinePayload) {
      const S = state();
      const rm = S.activeModal?.type === 'routine' ? S.activeModal : undefined;
      if (!rm) return;
      const rawName = payload.name.replace(/\|/g, '/').trim().slice(0, 40);
      if (!rawName) return;
      if (RESERVED_ROUTINE_NORMS.has(norm(rawName)) || ['__proto__', 'constructor', 'prototype'].includes(rawName)) {
        deps.toast(`"${rawName}" es un nombre reservado. Elige otro nombre.`);
        return;
      }
      const existingKeys = routineNames(S.settings);
      const conflict = existingKeys.find((k) => norm(k) === norm(rawName) && (rm.mode === 'create' || k !== rm.oldName));
      if (conflict) {
        deps.toast(`Ya existe una rutina llamada "${conflict}".`);
        return;
      }
      const sub = payload.sub.trim().slice(0, 40);
      const validColor = ROUTINE_COLORS.includes(payload.color) ? payload.color : rm.color;
      const entryMeta = { color: validColor, ...(sub ? { sub } : {}) };

      if (rm.mode === 'create') {
        if (existingKeys.length >= 20) {
          deps.toast('Máximo 20 rutinas permitidas.');
          return;
        }
        S.settings = {
          ...S.settings,
          routines: { ...S.settings.routines, [rawName]: [] },
          routineMeta: { ...(S.settings.routineMeta ?? {}), [rawName]: entryMeta },
        };
        S.activeModal = null;
        await deps.persist();
        deps.toast(`Rutina "${rawName}" creada.`);
        return;
      }

      if (rm.oldName && S.settings.routines[rm.oldName]) {
        const oldName = rm.oldName;
        let nextRoutines = S.settings.routines;
        const { [oldName]: _removedMeta, ...restMeta } = S.settings.routineMeta ?? {};
        if (rawName !== oldName) {
          const rebuilt: Record<string, RoutineEx[]> = {};
          for (const [k, v] of Object.entries(S.settings.routines)) {
            rebuilt[k === oldName ? rawName : k] = v;
          }
          nextRoutines = rebuilt;
          if (deps.getLastRoutine() === oldName) deps.setLastRoutine(rawName);
          if (S.tab === oldName) deps.setTab(rawName);
          if (S.sel.home === oldName) S.sel = { ...S.sel, home: rawName };
          deps.syncWorkoutRoutineNames(oldName, rawName);
          const migrated = S.strength.filter((r) => r.day === oldName).map((r) => ({ ...r, day: rawName }));
          if (migrated.length) {
            await putMany('strength', migrated);
            markBucketUpserts('strength', migrated);
            S.strength = S.strength.map((r) => (r.day === oldName ? { ...r, day: rawName } : r));
          }
        }
        S.settings = { ...S.settings, routines: nextRoutines, routineMeta: { ...restMeta, [rawName]: entryMeta } };
        S.activeModal = null;
        await deps.persist();
        deps.toast(`Rutina "${rawName}" actualizada.`);
      }
    },
  };
}
