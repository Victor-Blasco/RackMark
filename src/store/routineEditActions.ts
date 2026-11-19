import { ROUTINE_TEMPLATES } from '../lib/seed';
import type { DayName, RoutineEx } from '../types';
import { moveItem } from '../ui/reorder';
import { routineNames, type State } from '../ui/shared';
import type { ConfirmModalOpts, ToastAction } from './types';
import { applyRoutineTemplateToState } from './routineTemplate';

/** Dependencias para editar días de rutina, ejercicios de cada día y plantillas. */
export interface RoutineEditDeps {
  getState: () => State;
  getLastRoutine: () => DayName;
  setLastRoutine: (day: DayName) => void;
  persist: () => Promise<void>;
  render: () => void;
  syncWorkoutRoutineNames: (oldName?: string, newName?: string) => void;
  askConfirm: (opts: ConfirmModalOpts) => Promise<boolean>;
  toast: (msg: string, action?: ToastAction) => void;
}

/**
 * Crea las acciones inmutables para manipular rutinas, plantillas y filas en `Plan`.
 *
 * @param deps - Puentes de estado, confirmación, sincronización y persistencia.
 * @returns Manejadores tipados para editar la estructura semanal de rutinas.
 */
export function createRoutineEditActions(deps: RoutineEditDeps) {
  const state = () => deps.getState();

  const updateRoutineRows = async (day: string, updater: (rows: RoutineEx[]) => RoutineEx[]) => {
    const S = state();
    const current = S.settings.routines[day] ?? [];
    S.settings = {
      ...S.settings,
      routines: { ...S.settings.routines, [day]: updater(current) },
    };
    await deps.persist();
  };

  return {
    async removeRoutineDay(name: string) {
      const S = state();
      const names = routineNames(S.settings);
      if (!name || !S.settings.routines[name]) return;
      if (names.length <= 1) { deps.toast('Debes mantener al menos una rutina activa.'); return; }
      const count = S.settings.routines[name].length;
      if (count > 0) {
        const confirmed = await deps.askConfirm({
          title: `Eliminar rutina "${name}"`,
          message: `Contiene ${count} ${count === 1 ? 'ejercicio' : 'ejercicios'} configurados. El historial ya guardado se conservará.`,
          confirmLabel: 'Eliminar rutina',
          danger: true,
        });
        if (!confirmed) return;
      }
      const { [name]: _removedRoutine, ...routines } = S.settings.routines;
      const { [name]: _removedMeta, ...routineMeta } = S.settings.routineMeta ?? {};
      S.settings = { ...S.settings, routines, routineMeta };
      const remaining = routineNames(S.settings);
      if (deps.getLastRoutine() === name) deps.setLastRoutine(remaining[0] ?? 'Push');
      if (S.planRoutine === name) S.planRoutine = remaining[0];
      if (S.planTargetRoutine === name) S.planTargetRoutine = remaining[0];
      if (S.sel.home === name) { const { home: _home, ...restSel } = S.sel; S.sel = restSel; }
      deps.syncWorkoutRoutineNames();
      await deps.persist();
      deps.toast(`Rutina "${name}" eliminada.`);
    },

    async applyTemplate(key: string) {
      const tpl = ROUTINE_TEMPLATES[key];
      if (!tpl) return;
      const confirmed = await deps.askConfirm({
        title: `Aplicar plantilla "${tpl.label}"`,
        message: 'Reemplazará la distribución actual de rutinas y objetivos.',
        confirmLabel: 'Aplicar plantilla',
      });
      if (!confirmed) return;
      applyRoutineTemplateToState(state(), key, deps.getLastRoutine, deps.setLastRoutine, deps.syncWorkoutRoutineNames);
      await deps.persist();
      deps.toast(`Plantilla "${tpl.label}" aplicada.`);
    },

    async quickAddToRoutine(day: string, name: string) {
      if (!day || !name) return;
      state().planTargetRoutine = day;
      await updateRoutineRows(day, (list) => [...list, { name, sets: 3, reps: 10 }]);
      deps.toast(`Añadido «${name}» a ${day}`);
    },

    async deleteRoutineRow(day: string, idx: number) {
      const removed = state().settings.routines[day]?.[idx];
      if (!removed) return;
      await updateRoutineRows(day, (list) => list.filter((_, i) => i !== idx));
      deps.toast(`Eliminado «${removed.name || 'fila vacía'}» de ${day}.`, {
        label: 'Deshacer',
        onAction: () => {
          const cur = state().settings.routines[day];
          if (!cur) return;
          const pos = Math.min(idx, cur.length);
          void updateRoutineRows(day, (list) => [...list.slice(0, pos), removed, ...list.slice(pos)]);
        },
      });
    },

    async moveRoutineRow(day: string, idx: number, dir: number) {
      const list = [...(state().settings.routines[day] ?? [])];
      if (!moveItem(list, idx, idx + dir)) return;
      await updateRoutineRows(day, () => list);
    },

    async reorderRoutineRows(day: string, from: number, to: number) {
      const list = [...(state().settings.routines[day] ?? [])];
      if (!moveItem(list, from, to)) return;
      await updateRoutineRows(day, () => list);
    },

    async changeRoutineExName(day: string, idx: number, val: string) {
      const S = state();
      if (val === '__new__') {
        S.activeModal = { type: 'exercise', routine: day, rowIdx: idx };
        deps.render();
        return;
      }
      if (!S.settings.routines[day]?.[idx]) return;
      await updateRoutineRows(day, (list) => list.map((item, i) => (i === idx ? { ...item, name: val } : item)));
    },

    async changeRoutineExSets(day: string, idx: number, raw: string) {
      if (!state().settings.routines[day]?.[idx]) return;
      const sets = Math.max(1, +raw || 1);
      await updateRoutineRows(day, (list) => list.map((item, i) => (i === idx ? { ...item, sets } : item)));
    },

    async changeRoutineExReps(day: string, idx: number, raw: string) {
      if (!state().settings.routines[day]?.[idx]) return;
      const reps = Math.max(1, +raw || 1);
      await updateRoutineRows(day, (list) => list.map((item, i) => (i === idx ? { ...item, reps } : item)));
    },
  };
}
