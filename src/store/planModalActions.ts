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

const renameKey = <T>(rec: Record<string, T> | undefined, from: string, to: string): Record<string, T> | undefined => {
  if (!rec || !(from in rec)) return rec;
  const { [from]: val, ...rest } = rec;
  return { ...rest, [to]: val };
};

/**
 * Crea los guardados de formulario para `<ExerciseModal />` y `<RoutineModal />`.
 *
 * @param deps - Puentes al estado, persistencia, sincronización y avisos.
 * @returns Métodos `saveExerciseModal` y `saveRoutineModal` (devuelven texto de error si falla la validación).
 */
export function createPlanModalActions(deps: PlanModalDeps) {
  const state = () => deps.getState();

  return {
    async saveExerciseModal(payload: SaveExercisePayload): Promise<string | undefined> {
      const S = state();
      const rawName = payload.name.trim().slice(0, 80);
      if (!rawName) return 'Introduce un nombre para el ejercicio.';
      const modal = S.activeModal?.type === 'exercise' ? S.activeModal : undefined;
      const existingName = allExerciseNames(S).find((n) => norm(n) === norm(rawName));
      if (existingName && !modal?.fromLog && modal?.rowIdx == null) return `Ya existe "${existingName}" en tu biblioteca.`;
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
        } else if (!list.some((x) => norm(x.name) === norm(finalName))) list.push({ name: finalName, sets, reps });
        routines = { ...S.settings.routines, [targetRoutine]: list };
      }
      const nextHidden = (S.settings.hiddenExercises ?? []).filter((h) => norm(h) !== norm(finalName));
      const nextSettings = { ...S.settings, muscles, customNames, routines };
      if (nextHidden.length) nextSettings.hiddenExercises = nextHidden;
      else delete nextSettings.hiddenExercises;
      S.settings = nextSettings;
      if (S.activeModal?.type === 'exercise') S.activeModal = null;
      await deps.persist();
      if (modal?.fromLog) deps.addExToDraft(finalName, sets, reps);
      deps.toast(existingName ? `Ejercicio "${finalName}" actualizado.` : `Ejercicio "${finalName}" creado.`);
      return undefined;
    },

    async saveRoutineModal(payload: SaveRoutinePayload): Promise<string | undefined> {
      const S = state();
      const rm = S.activeModal?.type === 'routine' ? S.activeModal : undefined;
      if (!rm) return undefined;
      const rawName = payload.name.replace(/\|/g, '/').trim().slice(0, 40);
      if (!rawName) return 'Introduce un nombre para la rutina.';
      if (RESERVED_ROUTINE_NORMS.has(norm(rawName)) || ['__proto__', 'constructor', 'prototype'].includes(rawName)) {
        return `"${rawName}" es un nombre reservado. Elige otro nombre.`;
      }
      const existingKeys = routineNames(S.settings);
      const conflict = existingKeys.find((k) => norm(k) === norm(rawName) && (rm.mode === 'create' || k !== rm.oldName));
      if (conflict) return `Ya existe una rutina llamada "${conflict}".`;
      const sub = payload.sub.trim().slice(0, 40);
      const validColor = ROUTINE_COLORS.includes(payload.color) ? payload.color : rm.color;
      const prevFreq = rm.mode === 'edit' && rm.oldName ? S.settings.routineMeta?.[rm.oldName]?.freq : undefined;
      const entryMeta = {
        color: validColor,
        ...(sub ? { sub } : {}),
        ...(prevFreq !== undefined ? { freq: prevFreq } : {}),
      };

      if (rm.mode === 'create') {
        if (existingKeys.length >= 20) return 'Máximo 20 rutinas permitidas.';
        S.settings = { ...S.settings, routines: { ...S.settings.routines, [rawName]: [] }, routineMeta: { ...(S.settings.routineMeta ?? {}), [rawName]: entryMeta } };
        S.planRoutine = rawName;
        S.activeModal = null;
        await deps.persist();
        deps.toast(`Rutina "${rawName}" creada.`);
        return undefined;
      }

      if (rm.oldName && S.settings.routines[rm.oldName]) {
        const oldName = rm.oldName;
        let nextRoutines = S.settings.routines;
        const { [oldName]: _removedMeta, ...restMeta } = S.settings.routineMeta ?? {};
        const renamed = rawName !== oldName;
        if (renamed) {
          const rebuilt: Record<string, RoutineEx[]> = {};
          for (const [k, v] of Object.entries(S.settings.routines)) rebuilt[k === oldName ? rawName : k] = v;
          nextRoutines = rebuilt;
        }
        S.settings = { ...S.settings, routines: nextRoutines, routineMeta: { ...restMeta, [rawName]: entryMeta } };
        if (renamed) {
          if (deps.getLastRoutine() === oldName) deps.setLastRoutine(rawName);
          if (S.tab === oldName) deps.setTab(rawName);
          if (oldName in S.sel) S.sel = renameKey(S.sel, oldName, rawName) ?? S.sel;
          S.dayExtra = renameKey(S.dayExtra, oldName, rawName);
          S.ranges = renameKey(S.ranges, oldName, rawName);
          S.customRanges = renameKey(S.customRanges, oldName, rawName);
          if (S.planRoutine === oldName) S.planRoutine = rawName;
          deps.syncWorkoutRoutineNames(oldName, rawName);
          const migrated = S.strength.filter((r) => r.day === oldName).map((r) => ({ ...r, day: rawName }));
          if (migrated.length) {
            await putMany('strength', migrated);
            markBucketUpserts('strength', migrated);
            S.strength = S.strength.map((r) => (r.day === oldName ? { ...r, day: rawName } : r));
          }
        }
        S.activeModal = null;
        await deps.persist();
        deps.toast(`Rutina "${rawName}" actualizada.`);
      }
      return undefined;
    },
  };
}
