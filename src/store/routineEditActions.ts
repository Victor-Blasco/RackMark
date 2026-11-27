import { findAnalyzedExercise } from '../lib/analysis';
import { ROUTINE_TEMPLATES, norm } from '../lib/seed';
import type { DayName, RoutineEx } from '../types';
import { moveItem } from '../ui/reorder';
import { humanizeError, routineNames, type State } from '../ui/shared';
import type { ConfirmModalOpts, ToastAction } from './types';
import { distributeWeeklyFreqs, routineFreq } from './planSelectors';
import { applyRoutineTemplateToState, confirmRemoveRoutineOpts, confirmTemplateOpts } from './routineTemplate';

/** Dependencias para editar días de rutina, ejercicios de cada día y plantillas. */
export interface RoutineEditDeps {
  getState: () => State;
  getLastRoutine: () => DayName;
  setLastRoutine: (day: DayName) => void;
  setTab?: (tab: string) => void;
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
      const { [name]: _rs, ...restSel } = cur.sel;
      cur.sel = restSel;
      if (cur.dayExtra) {
        const { [name]: _rd, ...restExtra } = cur.dayExtra;
        cur.dayExtra = restExtra;
      }
      if (cur.ranges) {
        const { [name]: _rr, ...restRanges } = cur.ranges;
        cur.ranges = restRanges;
      }
      if (cur.customRanges) {
        const { [name]: _rc, ...restCustom } = cur.customRanges;
        cur.customRanges = restCustom;
      }
      const remaining = routineNames(cur.settings);
      if (deps.getLastRoutine() === name) deps.setLastRoutine(remaining[0] ?? 'Push');
      if (cur.planRoutine === name) cur.planRoutine = remaining[0];
      if (cur.tab === name) {
        const nextTab = remaining[0] ?? 'home';
        if (deps.setTab) deps.setTab(nextTab);
        else cur.tab = nextTab;
      }
      deps.syncWorkoutRoutineNames();
      await deps.persist();
      deps.toast(`Rutina "${name}" eliminada.`);
    },

    async applyTemplate(key: string) {
      const tpl = ROUTINE_TEMPLATES[key];
      const confirmOpts = tpl ? confirmTemplateOpts(state(), key) : null;
      if (!tpl || !confirmOpts || !(await deps.askConfirm(confirmOpts))) return;
      applyRoutineTemplateToState(state(), key, deps.getLastRoutine, deps.setLastRoutine, deps.syncWorkoutRoutineNames, undefined, deps.setTab);
      await deps.persist();
      deps.toast(`Plantilla "${tpl.label}" aplicada.`);
    },

    async quickAddToRoutine(day: string, name: string, customSets?: number, customReps?: number) {
      if (!day || !name) return;
      const S = state();
      if ((S.settings.routines[day] ?? []).some((x) => norm(x.name) === norm(name))) {
        deps.toast(`«${name}» ya está en ${day}.`);
        return;
      }
      const last = findAnalyzedExercise(S.analysis, name)?.last;
      const sets = Math.max(1, Math.min(20, Math.round(customSets ?? (last ? last.sets.length : 3))));
      const reps = Math.max(1, Math.min(100, Math.round(customReps ?? (last?.sets[0]?.r || 10))));
      await updateRoutineRows(day, (list) => [...list, { name, sets, reps }]);
      deps.toast(`Añadido «${name}» (${sets}×${reps}) a ${day}`);
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
    async changeRoutineExRest(day: string, idx: number, restSec?: number) {
      if (!state().settings.routines[day]?.[idx]) return;
      const clean = restSec != null && Number.isFinite(restSec) && restSec >= 15
        ? Math.min(1800, Math.round(restSec))
        : undefined;
      await updateRoutineRows(day, (list) => list.map((item, i) => {
        if (i !== idx) return item;
        const { restSec: _prev, ...base } = item;
        return clean != null ? { ...base, restSec: clean } : base;
      }));
    },

    async changeRoutineFreq(day: string, nextFreq: number) {
      const S = state();
      if (!day || !S.settings.routines[day]) return;
      const otherSum = routineNames(S.settings)
        .filter((r) => r !== day)
        .reduce((sum, r) => sum + routineFreq(S.settings, r), 0);
      const maxForDay = Math.max(0, 7 - otherSum);
      const freq = Math.max(0, Math.min(maxForDay, Math.round(nextFreq)));
      const prevMeta = S.settings.routineMeta ?? {};
      const { [day]: curEntry, ...restMeta } = prevMeta;
      const { freq: _oldFreq, ...cleanEntry } = curEntry ?? {};
      const nextEntry = freq === 1 ? cleanEntry : { ...cleanEntry, freq };
      const hasKeys = Boolean(nextEntry.color || nextEntry.sub || freq !== 1);
      const routineMeta = hasKeys ? { ...restMeta, [day]: nextEntry } : restMeta;
      S.settings = { ...S.settings, routineMeta };
      await deps.persist();
    },

    async distributeFreqsToProfileDays() {
      const S = state();
      const dpw = S.settings.profile.daysPerWeek;
      if (dpw == null) return;
      const freqs = distributeWeeklyFreqs(routineNames(S.settings), dpw);
      const nextMeta: NonNullable<typeof S.settings.routineMeta> = {};
      for (const [day, entry] of Object.entries(S.settings.routineMeta ?? {})) {
        const { freq: _oldFreq, ...clean } = entry;
        if (clean.color || clean.sub) nextMeta[day] = clean;
      }
      for (const [day, freq] of Object.entries(freqs)) {
        if (freq !== 1) nextMeta[day] = { ...(nextMeta[day] ?? {}), freq };
      }
      S.settings = { ...S.settings, routineMeta: nextMeta };
      await deps.persist();
    },

    async syncProfileDaysToPlan(days: number) {
      const S = state();
      const val = Math.max(1, Math.min(7, Math.round(days)));
      S.settings = { ...S.settings, profile: { ...S.settings.profile, daysPerWeek: val } };
      await deps.persist();
      deps.toast(`Días de entreno del perfil actualizados a ${val} d/sem.`);
    },
  };
}
