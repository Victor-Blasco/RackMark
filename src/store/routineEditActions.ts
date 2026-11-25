import { ROUTINE_TEMPLATES, norm } from '../lib/seed';
import type { DayName, RoutineEx } from '../types';
import { moveItem } from '../ui/reorder';
import { humanizeError, routineNames, type State } from '../ui/shared';
import type { ConfirmModalOpts, ToastAction } from './types';
import { applyRoutineTemplateToState, confirmRemoveRoutineOpts, confirmTemplateOpts } from './routineTemplate';

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

  const reorderRoutineRows = async (day: string, from: number, to: number) => {
    const list = [...(state().settings.routines[day] ?? [])];
    if (!moveItem(list, from, to)) return;
    await updateRoutineRows(day, () => list);
  };

  const changeRowNum = async (day: string, idx: number, field: 'sets' | 'reps', raw: string) => {
    if (!state().settings.routines[day]?.[idx]) return;
    const val = Math.max(1, +raw || 1);
    await updateRoutineRows(day, (list) => list.map((item, i) => (i === idx ? { ...item, [field]: val } : item)));
  };

  return {
    async removeRoutineDay(name: string) {
      const S = state();
      const names = routineNames(S.settings);
      if (!name || !S.settings.routines[name]) return;
      if (names.length <= 1) { deps.toast('Debes mantener al menos una rutina activa.'); return; }
      const confirmOpts = confirmRemoveRoutineOpts(S, name);
      if (confirmOpts && !(await deps.askConfirm(confirmOpts))) return;
      const cur = state();
      if (!cur.settings.routines[name] || routineNames(cur.settings).length <= 1) return;
      const { [name]: _removedRoutine, ...routines } = cur.settings.routines;
      const { [name]: _removedMeta, ...routineMeta } = cur.settings.routineMeta ?? {};
      cur.settings = { ...cur.settings, routines, routineMeta };
      const remaining = routineNames(cur.settings);
      if (deps.getLastRoutine() === name) deps.setLastRoutine(remaining[0] ?? 'Push');
      if (cur.planRoutine === name) cur.planRoutine = remaining[0];
      deps.syncWorkoutRoutineNames();
      await deps.persist();
      deps.toast(`Rutina "${name}" eliminada.`);
    },

    async applyTemplate(key: string) {
      const tpl = ROUTINE_TEMPLATES[key];
      const confirmOpts = tpl ? confirmTemplateOpts(state(), key) : null;
      if (!tpl || !confirmOpts || !(await deps.askConfirm(confirmOpts))) return;
      applyRoutineTemplateToState(state(), key, deps.getLastRoutine, deps.setLastRoutine, deps.syncWorkoutRoutineNames);
      await deps.persist();
      deps.toast(`Plantilla "${tpl.label}" aplicada.`);
    },

    async quickAddToRoutine(day: string, name: string) {
      if (!day || !name) return;
      const S = state();
      if ((S.settings.routines[day] ?? []).some((x) => norm(x.name) === norm(name))) {
        deps.toast(`«${name}» ya está en ${day}.`);
        return;
      }
      await updateRoutineRows(day, (list) => [...list, { name, sets: 3, reps: 10 }]);
      deps.toast(`Añadido «${name}» a ${day}`);
    },

    async removeRoutineExByName(day: string, name: string) {
      if (!day || !name) return;
      const k = norm(name);
      const list = state().settings.routines[day] ?? [];
      if (!list.some((x) => norm(x.name) === k)) return;
      await updateRoutineRows(day, (rows) => rows.filter((x) => norm(x.name) !== k));
      deps.toast(`Quitado «${name}» de ${day}.`);
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
          void updateRoutineRows(day, (list) => [...list.slice(0, pos), removed, ...list.slice(pos)]).catch((e) =>
            deps.toast(`No se pudo deshacer: ${humanizeError(e)}`),
          );
        },
      });
    },

    moveRoutineRow: (day: string, idx: number, dir: number) => reorderRoutineRows(day, idx, idx + dir),
    reorderRoutineRows,

    async changeRoutineExName(day: string, idx: number, val: string) {
      const S = state();
      if (val === '__new__') {
        S.activeModal = { type: 'exercise', routine: day, rowIdx: idx };
        deps.render();
        return;
      }
      const rows = S.settings.routines[day];
      if (!rows?.[idx]) return;
      if (val && rows.some((item, i) => i !== idx && norm(item.name) === norm(val))) {
        deps.toast(`«${val}» ya está en ${day}.`);
        deps.render();
        return;
      }
      await updateRoutineRows(day, (list) => list.map((item, i) => (i === idx ? { ...item, name: val } : item)));
    },

    changeRoutineExSets: (day: string, idx: number, raw: string) => changeRowNum(day, idx, 'sets', raw),
    changeRoutineExReps: (day: string, idx: number, raw: string) => changeRowNum(day, idx, 'reps', raw),

    async changeRoutineFreq(day: string, nextFreq: number) {
      const S = state();
      if (!day || !S.settings.routines[day]) return;
      const freq = Math.max(0, Math.min(7, Math.round(nextFreq)));
      const prevMeta = S.settings.routineMeta ?? {};
      const { [day]: curEntry, ...restMeta } = prevMeta;
      const { freq: _oldFreq, ...cleanEntry } = curEntry ?? {};
      const nextEntry = freq === 1 ? cleanEntry : { ...cleanEntry, freq };
      const hasKeys = Boolean(nextEntry.color || nextEntry.sub || freq !== 1);
      const routineMeta = hasKeys ? { ...restMeta, [day]: nextEntry } : restMeta;
      S.settings = { ...S.settings, routineMeta };
      await deps.persist();
    },
  };
}
