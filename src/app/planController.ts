import type { ExperienceLevel, Measure, RoutineEx, TrainingGoal } from '../types';
import { putMany, saveSettings } from '../lib/db';
import { ROUTINE_COLORS, ROUTINE_TEMPLATES, isValidIsoDate, norm } from '../lib/seed';
import { markBucketUpserts, markSettingsDirty } from '../lib/sync';
import { MODAL_FOCUSABLE_SELECTOR, captureModalTrigger, restoreModalFocus } from '../ui/domPatches';
import { allExerciseNames } from '../ui/logView';
import { renderPlanCatalogResults, renderPlanExerciseMapResults } from '../ui/planView';
import { moveItem } from '../ui/reorder';
import { fmtDate, routineColor, routineNames, todayIso } from '../ui/shared';
import { RESERVED_ROUTINE_NORMS, isRoutineTab } from '../ui/shellView';
import {
  createWizardDraft,
  daysActivityFactor,
  goalCalorieDelta,
  goalPhaseName,
  recommendTemplate,
} from '../ui/wizardView';
import { arg, num, splitPair, type AppContext } from './context';

export interface PlanController {
  actions: Record<string, (el: HTMLElement) => void | Promise<void>>;
  changes: Record<string, (el: HTMLInputElement | HTMLSelectElement) => void | Promise<void>>;
  handleInput: (el: HTMLInputElement) => boolean;
  handleSubmit: (f: HTMLFormElement, fd: FormData) => Promise<boolean>;
  handleReorder: (scope: string, from: number, to: number) => Promise<boolean>;
}

export function createPlanController(ctx: AppContext): PlanController {
  function syncWizardStep1Dom(): void {
    const w = ctx.state.wizard;
    if (!w || w.step !== 1) return;
    const val = (id: string) => ctx.root.querySelector<HTMLInputElement>(`#${id}`)?.value;
    const age = val('wizAge');
    if (age !== undefined) w.age = age;
    const height = val('wizHeight');
    if (height !== undefined) w.height = height;
    const weight = val('wizWeight');
    if (weight !== undefined) w.weight = weight;
    const bf = val('wizBf');
    if (bf !== undefined) w.bf = bf;
    const waist = val('wizWaist');
    if (waist !== undefined) w.waist = waist;
  }

  function applyTemplateToState(tplKey: string): string | undefined {
    const tpl = ROUTINE_TEMPLATES[tplKey];
    if (!tpl) return undefined;
    const S = ctx.state;
    S.settings.routines = structuredClone(tpl.routines);
    S.settings.routineMeta = structuredClone(tpl.meta);
    const remaining = routineNames(S.settings);
    if (!isRoutineTab(S, ctx.getLastRoutine())) ctx.setLastRoutine(remaining[0] ?? 'Push');
    if (S.sel.home && !S.settings.routines[S.sel.home]) delete S.sel.home;
    ctx.syncWorkoutRoutineNames();
    return tpl.label;
  }

  const actions: Record<string, (el: HTMLElement) => void | Promise<void>> = {
    openWizard: () => {
      captureModalTrigger(ctx.root);
      ctx.state.wizard = createWizardDraft(ctx.state);
      ctx.render();
      ctx.root.querySelector<HTMLElement>('#wizAge')?.focus?.();
    },
    wizardSkip: async () => {
      const S = ctx.state;
      S.wizard = undefined;
      if (!S.settings.onboardingCompleted) {
        S.settings.onboardingCompleted = true;
        await ctx.persist();
        restoreModalFocus(ctx.root, S);
        return;
      }
      ctx.render();
      restoreModalFocus(ctx.root, S);
    },
    wizardBack: () => {
      const S = ctx.state;
      if (!S.wizard || S.wizard.step <= 1) return;
      S.wizard.step = (S.wizard.step - 1) as 1 | 2;
      S.wizard.anim = 'prev';
      ctx.render();
      const modal = ctx.root.querySelector<HTMLElement>('#wizard-modal');
      const target =
        modal?.querySelector<HTMLElement>('[data-act="wizardBack"]') ??
        modal?.querySelector<HTMLElement>('#wizardNext') ??
        modal?.querySelector<HTMLElement>(MODAL_FOCUSABLE_SELECTOR);
      target?.focus?.({ preventScroll: true });
    },
    wizardPickSex: (el) => {
      const w = ctx.state.wizard;
      if (!w) return;
      syncWizardStep1Dom();
      w.sex = arg(el) === 'mujer' ? 'mujer' : 'hombre';
      ctx.render();
    },
    wizardPickGoal: (el) => {
      const w = ctx.state.wizard;
      if (!w) return;
      w.goal = arg(el) as TrainingGoal;
      ctx.render();
    },
    wizardPickExp: (el) => {
      const w = ctx.state.wizard;
      if (!w) return;
      const exp = arg(el) as ExperienceLevel;
      w.experience = exp;
      w.templateKey = recommendTemplate(w.daysPerWeek, exp);
      w.aiTone = exp === 'beginner' ? 'simple' : 'technical';
      ctx.render();
    },
    wizardPickDays: (el) => {
      const w = ctx.state.wizard;
      if (!w) return;
      const d = Number(arg(el));
      if (d === 2 || d === 3 || d === 4 || d === 5 || d === 6) {
        w.daysPerWeek = d;
        w.templateKey = recommendTemplate(d, w.experience);
        ctx.render();
      }
    },
    wizardPickTpl: (el) => {
      const w = ctx.state.wizard;
      if (!w) return;
      w.templateKey = arg(el);
      ctx.render();
    },
    wizardPickTone: (el) => {
      const w = ctx.state.wizard;
      if (!w) return;
      w.aiTone = arg(el) === 'simple' ? 'simple' : 'technical';
      ctx.render();
    },
    planTab: (el) => {
      ctx.state.planTab = arg(el) === 'exercises' ? 'exercises' : 'routines';
      ctx.render();
    },
    toggleExerciseMapAll: () => {
      ctx.state.showAllExerciseMap = !ctx.state.showAllExerciseMap;
      ctx.render();
    },
    openUnmapped: () => {
      ctx.state.planTab = 'exercises';
      ctx.setTab('plan');
      ctx.render();
      if (typeof window !== 'undefined') window.scrollTo?.(0, 0);
    },
    openExModal: (el) => {
      captureModalTrigger(ctx.root);
      ctx.state.exModal = { routine: arg(el) || undefined };
      ctx.render();
      ctx.root.querySelector<HTMLElement>('#newExName')?.focus?.();
    },
    openExModalLog: () => {
      captureModalTrigger(ctx.root);
      ctx.state.exModal = { fromLog: true };
      ctx.render();
      ctx.root.querySelector<HTMLElement>('#newExName')?.focus?.();
    },
    rtModalNew: () => {
      const S = ctx.state;
      captureModalTrigger(ctx.root);
      const used = new Set(routineNames(S.settings).map((r) => routineColor(r, S.settings)));
      const nextColor =
        ROUTINE_COLORS.find((c) => !used.has(c)) ??
        ROUTINE_COLORS[routineNames(S.settings).length % ROUTINE_COLORS.length];
      S.routineModal = { mode: 'create', name: '', sub: '', color: nextColor };
      ctx.render();
      ctx.root.querySelector<HTMLElement>('#rtModalName')?.focus?.();
    },
    rtModalEdit: (el) => {
      const S = ctx.state;
      const name = arg(el);
      if (!name || !S.settings.routines[name]) return;
      captureModalTrigger(ctx.root);
      S.routineModal = {
        mode: 'edit',
        oldName: name,
        name,
        sub: S.settings.routineMeta?.[name]?.sub ?? '',
        color: routineColor(name, S.settings),
      };
      ctx.render();
      ctx.root.querySelector<HTMLElement>('#rtModalName')?.focus?.();
    },
    rtRemoveDay: async (el) => {
      const S = ctx.state;
      const name = arg(el);
      const names = routineNames(S.settings);
      if (!name || !S.settings.routines[name]) return;
      if (names.length <= 1) {
        ctx.toast('Debes mantener al menos una rutina activa.');
        return;
      }
      const count = S.settings.routines[name].length;
      if (
        count > 0 &&
        !(await ctx.askConfirm({
          title: `Eliminar rutina "${name}"`,
          message: `Contiene ${count} ${count === 1 ? 'ejercicio' : 'ejercicios'} configurados. El historial ya guardado se conservará.`,
          confirmLabel: 'Eliminar rutina',
          danger: true,
        }))
      ) {
        return;
      }
      delete S.settings.routines[name];
      if (S.settings.routineMeta) delete S.settings.routineMeta[name];
      const remaining = routineNames(S.settings);
      if (ctx.getLastRoutine() === name) ctx.setLastRoutine(remaining[0] ?? 'Push');
      if (S.sel.home === name) delete S.sel.home;
      ctx.syncWorkoutRoutineNames();
      await ctx.persist();
      ctx.toast(`Rutina "${name}" eliminada.`);
    },
    rtApplyTpl: async (el) => {
      const key = arg(el);
      const tpl = ROUTINE_TEMPLATES[key];
      if (!tpl) return;
      if (
        !(await ctx.askConfirm({
          title: `Aplicar plantilla "${tpl.label}"`,
          message: 'Reemplazará la distribución actual de rutinas y objetivos.',
          confirmLabel: 'Aplicar plantilla',
        }))
      ) {
        return;
      }
      applyTemplateToState(key);
      await ctx.persist();
      ctx.toast(`Plantilla "${tpl.label}" aplicada.`);
    },
    rtAdd: async (el) => {
      const d = arg(el);
      (ctx.state.settings.routines[d] ??= []).push({ name: '', sets: 2, reps: 10 });
      await ctx.persist();
    },
    rtQuickAdd: async (el) => {
      const [d, name] = splitPair(arg(el));
      if (!d || !name) return;
      ctx.state.planTargetRoutine = d;
      (ctx.state.settings.routines[d] ??= []).push({ name, sets: 3, reps: 10 });
      await ctx.persist();
      ctx.toast(`Añadido «${name}» a ${d}`);
    },
    rtDel: async (el) => {
      const [d, i] = splitPair(arg(el));
      ctx.state.settings.routines[d]?.splice(+i, 1);
      await ctx.persist();
    },
    rtMove: async (el) => {
      const parts = arg(el).split('|');
      const dir = Number(parts.pop());
      const idx = Number(parts.pop());
      const d = parts.join('|');
      const list = ctx.state.settings.routines[d];
      if (!list || !moveItem(list, idx, idx + dir)) return;
      await ctx.persist();
    },
    merge: async () => {
      const f = ctx.root.querySelector<HTMLSelectElement>('#mergeFrom')?.value ?? '';
      const t = ctx.root.querySelector<HTMLSelectElement>('#mergeTo')?.value ?? '';
      if (!f || !t || f === t) return;
      ctx.state.settings.aliases[f] = t;
      await ctx.persist();
    },
    unmerge: async (el) => {
      delete ctx.state.settings.aliases[arg(el)];
      await ctx.persist();
    },
    phaseDel: async (el) => {
      const S = ctx.state;
      const raw = arg(el);
      if (raw === '') return;
      const idx = Number(raw);
      const sortedBefore = [...S.settings.phases].sort((a, b) => a.start.localeCompare(b.start));
      if (!Number.isInteger(idx) || idx < 0 || idx >= sortedBefore.length) return;
      const target = sortedBefore[idx];
      if (
        !(await ctx.askConfirm({
          title: `Eliminar fase "${target.name}"`,
          message: `Se eliminará la fase "${target.name}" (desde ${fmtDate(target.start)}). Esta acción no se puede deshacer.`,
          confirmLabel: 'Eliminar fase',
          danger: true,
        }))
      ) {
        return;
      }
      const sortedAfter = [...S.settings.phases].sort((a, b) => a.start.localeCompare(b.start));
      let delIdx = sortedAfter.indexOf(target);
      if (delIdx < 0) delIdx = sortedAfter.findIndex((p) => p.name === target.name && p.start === target.start);
      if (delIdx < 0) return;
      sortedAfter.splice(delIdx, 1);
      S.settings.phases = sortedAfter;
      await ctx.persist();
    },
  };

  const changes: Record<string, (el: HTMLInputElement | HTMLSelectElement) => void | Promise<void>> = {
    planTargetRoutine: (el) => {
      ctx.state.planTargetRoutine = el.value;
      ctx.render();
    },
    rtName: async (el) => {
      const S = ctx.state;
      const [d, i] = splitPair(arg(el));
      if (el.value === '__new__') {
        captureModalTrigger(ctx.root);
        S.exModal = { routine: d, rowIdx: +i };
        ctx.render();
        ctx.root.querySelector<HTMLElement>('#newExName')?.focus?.();
        return;
      }
      const item = S.settings.routines[d]?.[+i];
      if (!item) return;
      item.name = el.value;
      await ctx.persist();
    },
    rtSets: async (el) => {
      const [d, i] = splitPair(arg(el));
      const item = ctx.state.settings.routines[d]?.[+i];
      if (!item) return;
      item.sets = Math.max(1, +el.value || 1);
      await ctx.persist();
    },
    rtReps: async (el) => {
      const [d, i] = splitPair(arg(el));
      const item = ctx.state.settings.routines[d]?.[+i];
      if (!item) return;
      item.reps = Math.max(1, +el.value || 1);
      await ctx.persist();
    },
    refName: async (el) => {
      if (!el.value.trim()) return;
      ctx.state.settings.refNames[arg(el)] = el.value.trim();
      await ctx.persist();
    },
    musP: async (el) => {
      const n = norm(arg(el));
      const cur = ctx.state.settings.muscles[n] ?? { p: '', s: [] };
      ctx.state.settings.muscles[n] = { ...cur, p: el.value };
      await ctx.persist();
    },
    musS: async (el) => {
      const rawArg = arg(el);
      const n = norm(rawArg);
      const S = ctx.state;
      const cur = S.settings.muscles[n] ?? { p: '', s: [] };
      const primarySel = [...ctx.root.querySelectorAll<HTMLSelectElement>('select[data-change="musP"]')].find(
        (s) => s.dataset.arg === rawArg,
      );
      S.settings.muscles[n] = {
        ...cur,
        p: cur.p || primarySel?.value || '',
        s: el.value.split(',').map((x) => x.trim()).filter(Boolean),
      };
      await ctx.persist();
    },
    pfSex: async (el) => {
      ctx.state.settings.profile.sex = el.value;
      await ctx.persist();
    },
    pfAge: async (el) => {
      const n = Math.round(Number(el.value));
      if (!Number.isFinite(n) || n < 12 || n > 110) {
        ctx.toast('Edad inválida (12–110 años).');
        ctx.render();
        return;
      }
      ctx.state.settings.profile.age = n;
      await ctx.persist();
    },
    pfHeight: async (el) => {
      const n = Math.round(Number(el.value));
      if (!Number.isFinite(n) || n < 100 || n > 250) {
        ctx.toast('Altura inválida (100–250 cm).');
        ctx.render();
        return;
      }
      ctx.state.settings.profile.height = n;
      await ctx.persist();
    },
    pfGoal: async (el) => {
      const p = ctx.state.settings.profile;
      if (el.value === 'bulk' || el.value === 'cut' || el.value === 'recomp' || el.value === 'strength') p.goal = el.value;
      else delete p.goal;
      await ctx.persist();
    },
    pfExp: async (el) => {
      const p = ctx.state.settings.profile;
      if (el.value === 'beginner' || el.value === 'intermediate' || el.value === 'advanced') p.experience = el.value;
      else delete p.experience;
      await ctx.persist();
    },
    pfDays: async (el) => {
      const n = Number(el.value);
      const p = ctx.state.settings.profile;
      if (Number.isFinite(n) && n >= 1 && n <= 7) p.daysPerWeek = Math.round(n);
      else delete p.daysPerWeek;
      await ctx.persist();
    },
  };

  function handleInput(el: HTMLInputElement): boolean {
    if (el.dataset.input === 'exerciseMapSearch') {
      const S = ctx.state;
      S.exerciseMapSearch = el.value;
      const countEl = ctx.root.querySelector<HTMLElement>('#exercise-map-count');
      const listEl = ctx.root.querySelector<HTMLElement>('#exercise-map-results');
      if (countEl && listEl) {
        const res = renderPlanExerciseMapResults(S);
        countEl.textContent = res.countText;
        listEl.innerHTML = res.listHtml;
      } else {
        ctx.render();
      }
      return true;
    }
    if (el.dataset.input !== 'planSearch') return false;
    const S = ctx.state;
    S.planSearch = el.value;
    const countEl = ctx.root.querySelector<HTMLElement>('#planCatalogCount');
    const listEl = ctx.root.querySelector<HTMLElement>('#planCatalogList');
    if (countEl && listEl) {
      const res = renderPlanCatalogResults(S);
      countEl.textContent = res.countText;
      listEl.innerHTML = res.listHtml;
    } else {
      ctx.render();
    }
    return true;
  }

  async function handleSubmit(f: HTMLFormElement, fd: FormData): Promise<boolean> {
    const S = ctx.state;
    if (f.id === 'f-new-ex') {
      const rawName = String(fd.get('name') ?? '').trim().slice(0, 80);
      if (!rawName) return true;
      const modal = S.exModal;
      const existingName = allExerciseNames(S).find((n) => norm(n) === norm(rawName));
      if (existingName && !modal?.fromLog && modal?.rowIdx == null) {
        ctx.toast(`Ya existe "${existingName}" en tu biblioteca.`);
        return true;
      }
      const finalName = existingName ?? rawName;
      const primary = String(fd.get('primary') ?? '').trim();
      const sec = fd.getAll('secondary').map((x) => String(x)).filter((m) => m && m !== primary);
      if (primary) S.settings.muscles[norm(finalName)] = { p: primary, s: [...new Set(sec)] };
      if (!existingName) S.settings.customNames[`manual:${norm(finalName)}`] = finalName;
      const sets = Math.max(1, Math.min(20, Math.round(Number(fd.get('sets')) || 3)));
      const reps = Math.max(1, Math.min(100, Math.round(Number(fd.get('reps')) || 10)));
      const targetRoutine = String(fd.get('routine') ?? modal?.routine ?? '').trim();
      if (!modal?.fromLog && targetRoutine && S.settings.routines[targetRoutine]) {
        const list = S.settings.routines[targetRoutine];
        if (modal?.rowIdx != null && modal.routine === targetRoutine && list[modal.rowIdx]) {
          list[modal.rowIdx] = { name: finalName, sets, reps };
        } else {
          list.push({ name: finalName, sets, reps });
        }
      }
      S.exModal = undefined;
      await ctx.persist();
      if (modal?.fromLog) ctx.addExToDraft(finalName, sets, reps);
      restoreModalFocus(ctx.root, S);
      ctx.toast(existingName ? `Ejercicio "${finalName}" actualizado.` : `Ejercicio "${finalName}" creado.`);
      return true;
    }

    if (f.id === 'f-routine-meta' && S.routineModal) {
      const rm = S.routineModal;
      const rawName = String(fd.get('name') ?? '').replace(/\|/g, '/').trim().slice(0, 40);
      if (!rawName) return true;
      if (
        RESERVED_ROUTINE_NORMS.has(norm(rawName)) ||
        rawName === '__proto__' ||
        rawName === 'constructor' ||
        rawName === 'prototype'
      ) {
        ctx.toast(`"${rawName}" es un nombre reservado. Elige otro nombre.`);
        return true;
      }
      const existingKeys = routineNames(S.settings);
      const conflict = existingKeys.find((k) => norm(k) === norm(rawName) && (rm.mode === 'create' || k !== rm.oldName));
      if (conflict) {
        ctx.toast(`Ya existe una rutina llamada "${conflict}".`);
        return true;
      }

      const sub = String(fd.get('sub') ?? '').trim().slice(0, 40);
      const color = String(fd.get('color') ?? '').trim();
      const validColor = ROUTINE_COLORS.includes(color) ? color : rm.color;
      S.settings.routineMeta ??= {};

      if (rm.mode === 'create') {
        if (existingKeys.length >= 20) {
          ctx.toast('Máximo 20 rutinas permitidas.');
          return true;
        }
        S.settings.routines[rawName] = [];
        S.settings.routineMeta[rawName] = { color: validColor, ...(sub ? { sub } : {}) };
        S.routineModal = undefined;
        await ctx.persist();
        restoreModalFocus(ctx.root, S);
        ctx.toast(`Rutina "${rawName}" creada.`);
      } else if (rm.oldName && S.settings.routines[rm.oldName]) {
        const oldName = rm.oldName;
        if (rawName !== oldName) {
          const nextRoutines: Record<string, RoutineEx[]> = {};
          for (const [k, v] of Object.entries(S.settings.routines)) {
            nextRoutines[k === oldName ? rawName : k] = v;
          }
          S.settings.routines = nextRoutines;
          delete S.settings.routineMeta[oldName];
          if (ctx.getLastRoutine() === oldName) ctx.setLastRoutine(rawName);
          if (S.tab === oldName) ctx.setTab(rawName);
          if (S.sel.home === oldName) S.sel.home = rawName;
          ctx.syncWorkoutRoutineNames(oldName, rawName);
          const migrated = S.strength.filter((r) => r.day === oldName).map((r) => ({ ...r, day: rawName }));
          if (migrated.length) {
            await putMany('strength', migrated);
            markBucketUpserts('strength', migrated);
            S.strength = S.strength.map((r) => (r.day === oldName ? { ...r, day: rawName } : r));
          }
        }
        S.settings.routineMeta[rawName] = { color: validColor, ...(sub ? { sub } : {}) };
        S.routineModal = undefined;
        await ctx.persist();
        restoreModalFocus(ctx.root, S);
        ctx.toast(`Rutina "${rawName}" actualizada.`);
      }
      return true;
    }

    if (f.id === 'f-phase') {
      const name = String(fd.get('name') ?? '').trim().slice(0, 80);
      const start = String(fd.get('start') ?? '').trim();
      if (!name || !isValidIsoDate(start)) {
        ctx.toast('Introduce un nombre y una fecha válida para la fase.');
        return true;
      }
      S.settings.phases.push({ name, start });
      await ctx.persist();
      return true;
    }

    if (f.id === 'f-wizard' && S.wizard) {
      const w = S.wizard;
      if (w.step === 1) {
        syncWizardStep1Dom();
        const age = num(w.age);
        const height = num(w.height);
        if (age == null || age < 12 || age > 110) {
          ctx.toast('Introduce una edad válida (12–110 años).');
          return true;
        }
        if (height == null || height < 100 || height > 250) {
          ctx.toast('Introduce una altura válida (100–250 cm).');
          return true;
        }
        const weight = w.weight.trim() ? num(w.weight) : undefined;
        if (weight !== undefined && (weight < 25 || weight > 300)) {
          ctx.toast('Introduce un peso válido (25–300 kg).');
          return true;
        }
        w.step = 2;
        w.anim = 'next';
        ctx.render();
        ctx.root.querySelector<HTMLElement>('#wizard-modal #wizardNext')?.focus?.({ preventScroll: true });
        return true;
      }
      if (w.step === 2) {
        w.step = 3;
        w.anim = 'next';
        ctx.render();
        ctx.root.querySelector<HTMLElement>('#wizard-modal #wizardNext')?.focus?.({ preventScroll: true });
        return true;
      }

      const wasOnboarded = Boolean(S.settings.onboardingCompleted);
      const today = todayIso();
      const age = Math.round(num(w.age) || S.settings.profile.age || 25);
      const height = Math.round(num(w.height) || S.settings.profile.height || 170);
      S.settings.profile = {
        sex: w.sex,
        age,
        height,
        goal: w.goal,
        experience: w.experience,
        daysPerWeek: w.daysPerWeek,
      };
      S.settings.aiTone = w.aiTone;
      S.settings.onboardingCompleted = true;

      if (w.templateKey !== 'keep') {
        applyTemplateToState(w.templateKey);
      }

      const phaseName = goalPhaseName(w.goal);
      if (!wasOnboarded && !S.strength.length && S.settings.phases.length === 0) {
        S.settings.phases = [{ name: phaseName, start: today }];
      } else {
        const existingPhase = S.settings.phases.find((p) => p.start === today);
        if (existingPhase) existingPhase.name = phaseName;
        else S.settings.phases.push({ name: phaseName, start: today });
      }

      S.calcDraft = {
        ...S.calcDraft,
        act: daysActivityFactor(w.daysPerWeek),
        goal: goalCalorieDelta(w.goal),
      };

      const weightVal = num(w.weight);
      const bfVal = num(w.bf);
      const waistVal = num(w.waist);
      if (weightVal != null || bfVal != null || waistVal != null) {
        const existingMeasure = S.measures.find((x) => x.date === today);
        const m: Measure = { ...(existingMeasure ?? { date: today }) };
        if (weightVal != null && weightVal >= 20 && weightVal <= 350) m.weight = weightVal;
        if (bfVal != null && bfVal >= 2 && bfVal <= 70) m.bf = bfVal;
        if (waistVal != null && waistVal >= 35 && waistVal <= 220) m.waist = waistVal;
        await putMany('measures', [m]);
        markBucketUpserts('measures', [m]);
      }

      S.wizard = undefined;
      await saveSettings(S.settings);
      markSettingsDirty();
      await ctx.reload();
      ctx.render();
      restoreModalFocus(ctx.root, S);
      ctx.queueSync();
      ctx.toast('Perfil y plan inicial configurados.');
      return true;
    }

    return false;
  }

  async function handleReorder(scope: string, from: number, to: number): Promise<boolean> {
    if (!scope.startsWith('rt:')) return false;
    const d = scope.slice(3);
    const list = ctx.state.settings.routines[d];
    if (!list || !moveItem(list, from, to)) return true;
    await ctx.persist();
    return true;
  }

  return { actions, changes, handleInput, handleSubmit, handleReorder };
}
