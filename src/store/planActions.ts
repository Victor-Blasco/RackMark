import { ROUTINE_COLORS, ROUTINE_TEMPLATES, isValidIsoDate, norm } from '../lib/seed';
import type { AiTone, DayName } from '../types';
import { moveItem } from '../ui/reorder';
import { routineColor, routineNames, todayIso, type RangeKey, type State } from '../ui/shared';
import { createPlanModalActions, type SaveExercisePayload, type SaveRoutinePayload } from './planModalActions';
import { applyRoutineTemplateToState } from './wizardActions';

export type { SaveExercisePayload, SaveRoutinePayload };

/** Dependencias necesarias para acciones de `Plan`, `Home`, `Rutina` y modales. */
export interface PlanActionDeps {
  getState: () => State;
  getLastRoutine: () => DayName;
  setLastRoutine: (day: DayName) => void;
  persist: () => Promise<void>;
  render: () => void;
  setTab: (tab: string) => void;
  navigateTab: (tab: string) => void;
  syncWorkoutRoutineNames: (oldName?: string, newName?: string) => void;
  addExToDraft: (name: string, fallbackSets?: number, fallbackReps?: number) => void;
  askConfirm: (opts: { title: string; message: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
  toast: (msg: string) => void;
  startWorkoutDay: (day?: DayName) => Promise<void>;
  openLogDay: (day?: DayName) => Promise<void>;
  runAiAnalysis: () => void;
  retryAiAnalysis: () => void;
  dismissAiJob: () => void;
  openWizard: () => void;
  closeModal: () => void;
}

/** Tipo de retorno completo de las acciones de planificación, resumen y detalle. */
export type PlanActions = ReturnType<typeof createPlanActions>;

/**
 * Crea el conjunto unificado de acciones para `Home`, `Rutina / Día`, `Plan` y modales.
 *
 * @param deps - Puentes de estado, persistencia, confirmaciones e IA.
 * @returns Acciones tipadas para todas las vistas del núcleo de entrenamiento.
 */
export function createPlanActions(deps: PlanActionDeps) {
  const state = () => deps.getState();
  const modalActions = createPlanModalActions(deps);

  return {
    ...modalActions,
    openWizard: () => deps.openWizard(),
    startWorkout: (day?: DayName) => void deps.startWorkoutDay(day),
    openLog: (day?: DayName) => void deps.openLogDay(day),
    runAi: () => deps.runAiAnalysis(),
    retryAi: () => deps.retryAiAnalysis(),
    dismissAi: () => deps.dismissAiJob(),

    setAiTone: async (tone: AiTone) => {
      state().settings.aiTone = tone;
      await deps.persist();
    },

    setAiTab: (idx: number) => {
      state().aiTab = Math.max(0, idx || 0);
      deps.render();
    },

    setRange: (scope: string, key: RangeKey) => {
      const S = state();
      S.ranges = { ...S.ranges, [scope]: key };
      if (key === 'Custom') {
        const cur = S.customRanges?.[scope] ?? {};
        if (!cur.from && !cur.to) {
          S.customRanges = {
            ...S.customRanges,
            [scope]: { from: todayIso(new Date(Date.now() - 30 * 864e5)), to: todayIso() },
          };
        }
      }
      deps.render();
    },

    setCustomRangeDate: (scope: string, edge: 'from' | 'to', val: string) => {
      const S = state();
      if (val && !isValidIsoDate(val)) return;
      const cur = S.customRanges?.[scope] ?? {};
      S.customRanges = {
        ...S.customRanges,
        [scope]: { ...cur, [edge]: val || undefined },
      };
      deps.render();
    },

    setExMetric: (metric: 'top' | 'e1rm' | 'volume') => {
      state().exMetric = metric;
      deps.render();
    },

    setHomeExQuery: (q: string) => {
      state().homeExQuery = q;
      deps.render();
    },

    selectHomeEx: (exName: string) => {
      const S = state();
      S.sel = { ...S.sel, home: exName };
      delete S.homeExQuery;
      deps.render();
    },

    openExDetail: (day: DayName, exName: string) => {
      const S = state();
      S.sel = { ...S.sel, [day]: exName };
      deps.navigateTab(day);
    },

    selectDayEx: (day: DayName, exName: string) => {
      const S = state();
      S.sel = { ...S.sel, [day]: exName };
      deps.render();
    },

    setDayScope: (day: DayName, mode: 'routine' | 'extra') => {
      const S = state();
      S.dayExtra = { ...S.dayExtra, [day]: mode === 'extra' };
      const nextSel = { ...S.sel };
      delete nextSel[day];
      S.sel = nextSel;
      deps.render();
    },

    setPlanTab: (tab: 'routines' | 'exercises') => {
      state().planTab = tab;
      deps.render();
    },

    setTargetRoutine: (routine: string) => {
      state().planTargetRoutine = routine;
      deps.render();
    },

    setPlanSearch: (q: string) => {
      state().planSearch = q;
      deps.render();
    },

    setExerciseMapSearch: (q: string) => {
      state().exerciseMapSearch = q;
      deps.render();
    },

    clearExerciseMapSearch: () => {
      state().exerciseMapSearch = '';
      deps.render();
    },

    setExerciseMapMuscle: (muscle?: string) => {
      state().exerciseMapMuscle = muscle || undefined;
      deps.render();
    },

    toggleExerciseMapAll: () => {
      const S = state();
      S.showAllExerciseMap = !S.showAllExerciseMap;
      deps.render();
    },

    openUnmapped: () => {
      state().planTab = 'exercises';
      deps.navigateTab('plan');
    },

    openExerciseModal: (opts: { routine?: string; rowIdx?: number; fromLog?: boolean } = {}) => {
      const S = state();
      S.exModal = opts;
      S.activeModal = { type: 'exercise', ...opts };
      deps.render();
    },

    openRoutineModalNew: () => {
      const S = state();
      const used = new Set(routineNames(S.settings).map((r) => routineColor(r, S.settings)));
      const nextColor =
        ROUTINE_COLORS.find((c) => !used.has(c)) ??
        ROUTINE_COLORS[routineNames(S.settings).length % ROUTINE_COLORS.length];
      const modal = { mode: 'create' as const, name: '', sub: '', color: nextColor };
      S.routineModal = modal;
      S.activeModal = { type: 'routine', ...modal };
      deps.render();
    },

    openRoutineModalEdit: (name: string) => {
      const S = state();
      if (!name || !S.settings.routines[name]) return;
      const modal = {
        mode: 'edit' as const,
        oldName: name,
        name,
        sub: S.settings.routineMeta?.[name]?.sub ?? '',
        color: routineColor(name, S.settings),
      };
      S.routineModal = modal;
      S.activeModal = { type: 'routine', ...modal };
      deps.render();
    },

    async removeRoutineDay(name: string) {
      const S = state();
      const names = routineNames(S.settings);
      if (!name || !S.settings.routines[name]) return;
      if (names.length <= 1) {
        deps.toast('Debes mantener al menos una rutina activa.');
        return;
      }
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
      delete S.settings.routines[name];
      if (S.settings.routineMeta) delete S.settings.routineMeta[name];
      const remaining = routineNames(S.settings);
      if (deps.getLastRoutine() === name) deps.setLastRoutine(remaining[0] ?? 'Push');
      if (S.sel.home === name) delete S.sel.home;
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
      applyRoutineTemplateToState(
        state(),
        key,
        deps.getLastRoutine,
        deps.setLastRoutine,
        deps.syncWorkoutRoutineNames,
      );
      await deps.persist();
      deps.toast(`Plantilla "${tpl.label}" aplicada.`);
    },

    async addRoutineRow(day: string) {
      const S = state();
      const list = S.settings.routines[day] ?? [];
      S.settings.routines[day] = [...list, { name: '', sets: 2, reps: 10 }];
      await deps.persist();
    },

    async quickAddToRoutine(day: string, name: string) {
      if (!day || !name) return;
      const S = state();
      S.planTargetRoutine = day;
      const list = S.settings.routines[day] ?? [];
      S.settings.routines[day] = [...list, { name, sets: 3, reps: 10 }];
      await deps.persist();
      deps.toast(`Añadido «${name}» a ${day}`);
    },

    async deleteRoutineRow(day: string, idx: number) {
      const S = state();
      const list = S.settings.routines[day];
      if (!list) return;
      S.settings.routines[day] = list.filter((_, i) => i !== idx);
      await deps.persist();
    },

    async moveRoutineRow(day: string, idx: number, dir: number) {
      const S = state();
      const list = [...(S.settings.routines[day] ?? [])];
      if (!moveItem(list, idx, idx + dir)) return;
      S.settings.routines[day] = list;
      await deps.persist();
    },

    async reorderRoutineRows(day: string, from: number, to: number) {
      const S = state();
      const list = [...(S.settings.routines[day] ?? [])];
      if (!moveItem(list, from, to)) return;
      S.settings.routines[day] = list;
      await deps.persist();
    },

    async changeRoutineExName(day: string, idx: number, val: string) {
      const S = state();
      if (val === '__new__') {
        S.exModal = { routine: day, rowIdx: idx };
        S.activeModal = { type: 'exercise', routine: day, rowIdx: idx };
        deps.render();
        return;
      }
      const list = S.settings.routines[day];
      if (!list?.[idx]) return;
      S.settings.routines[day] = list.map((item, i) => (i === idx ? { ...item, name: val } : item));
      await deps.persist();
    },

    async changeRoutineExSets(day: string, idx: number, raw: string) {
      const list = state().settings.routines[day];
      if (!list?.[idx]) return;
      const sets = Math.max(1, +raw || 1);
      state().settings.routines[day] = list.map((item, i) => (i === idx ? { ...item, sets } : item));
      await deps.persist();
    },

    async changeRoutineExReps(day: string, idx: number, raw: string) {
      const list = state().settings.routines[day];
      if (!list?.[idx]) return;
      const reps = Math.max(1, +raw || 1);
      state().settings.routines[day] = list.map((item, i) => (i === idx ? { ...item, reps } : item));
      await deps.persist();
    },

    async assignRefName(ref: string, val: string) {
      if (!val.trim()) return;
      state().settings.refNames[ref] = val.trim();
      await deps.persist();
    },

    async changePrimaryMuscle(exName: string, primary: string) {
      const n = norm(exName);
      const cur = state().settings.muscles[n] ?? { p: '', s: [] };
      state().settings.muscles[n] = { ...cur, p: primary };
      await deps.persist();
    },

    async changeSecondaryMuscles(exName: string, rawSec: string) {
      const n = norm(exName);
      const cur = state().settings.muscles[n] ?? { p: '', s: [] };
      state().settings.muscles[n] = {
        ...cur,
        s: rawSec.split(',').map((x) => x.trim()).filter(Boolean),
      };
      await deps.persist();
    },

    async mergeExercises(from: string, to: string) {
      if (!from || !to || from === to) return;
      state().settings.aliases[from] = to;
      await deps.persist();
    },

    async unmergeExercise(alias: string) {
      delete state().settings.aliases[alias];
      await deps.persist();
    },

    async addPhase(rawName: string, rawStart: string) {
      const name = rawName.trim().slice(0, 80);
      const start = rawStart.trim();
      if (!name || !isValidIsoDate(start)) {
        deps.toast('Introduce un nombre y una fecha válida para la fase.');
        return;
      }
      state().settings.phases = [...state().settings.phases, { name, start }];
      await deps.persist();
    },

    async deletePhase(sortedIdx: number) {
      const S = state();
      const sortedBefore = [...S.settings.phases].sort((a, b) => a.start.localeCompare(b.start));
      const target = sortedBefore[sortedIdx];
      if (!target) return;
      const confirmed = await deps.askConfirm({
        title: `Eliminar fase "${target.name}"`,
        message: `Se eliminará la fase "${target.name}" (desde ${target.start.slice(8, 10)}/${target.start.slice(5, 7)}/${target.start.slice(0, 4)}). Esta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar fase',
        danger: true,
      });
      if (!confirmed) return;
      const sortedAfter = [...S.settings.phases].sort((a, b) => a.start.localeCompare(b.start));
      let delIdx = sortedAfter.indexOf(target);
      if (delIdx < 0) delIdx = sortedAfter.findIndex((p) => p.name === target.name && p.start === target.start);
      if (delIdx < 0) return;
      sortedAfter.splice(delIdx, 1);
      S.settings.phases = sortedAfter;
      await deps.persist();
    },
  };
}
