import { epley } from '../lib/analysis';
import { deleteKey, putMany } from '../lib/db';
import { isValidIsoDate, norm } from '../lib/seed';
import { markBucketDeletes, markBucketUpserts } from '../lib/sync';
import type { DayName, LiveWorkout, LogExDraft, StrengthRow } from '../types';
import {
  captureModalTrigger,
  playRestBeep,
  restoreModalFocus,
  syncLiveSetDom,
  syncSetDom,
  updateLiveCountersDom,
  updateLogCountersDom,
  updateNavRestBadges,
  updateRestBarDom,
} from '../ui/domPatches';
import { manualSessionId, quickExSuggestions } from '../ui/logView';
import { moveItem } from '../ui/reorder';
import { filterSelectionOptions } from '../ui/selection';
import { routineNames, todayIso } from '../ui/shared';
import { defaultSetsForEx, initLiveWorkout, initLogDraft } from '../ui/views';
import { arg, saveDraft, saveLive, type AppContext } from './context';

function applyRepsEdit(
  ex: LogExDraft | undefined,
  ei: number,
  si: number,
  el: HTMLInputElement,
  finalize: boolean,
  onPersist: () => void,
  onSyncSet: (ei: number, si: number) => void,
  onUpdateCounters: (ei: number) => void,
): void {
  const s = ex?.sets[si];
  if (!ex || !s) return;
  const raw = el.value.trim();
  if (!raw && !finalize) return;
  const nextR = Math.max(0, parseInt(raw, 10) || 0);
  if (finalize && !raw) el.value = '0';
  s.r = nextR;
  const wasDone = Boolean(s.done);
  if (s.r === 0 && s.done) {
    s.done = false;
    ex.done = ex.sets.some((x) => Boolean(x.done && x.r > 0));
  }
  onPersist();
  if (wasDone !== Boolean(s.done)) onSyncSet(ei, si);
  else if (s.done || finalize) onUpdateCounters(ei);
}

export interface WorkoutController {
  actions: Record<string, (el: HTMLElement) => void | Promise<void>>;
  changes: Record<string, (el: HTMLInputElement | HTMLSelectElement) => void | Promise<void>>;
  handleInput: (el: HTMLInputElement) => boolean;
  handleFocusout: (el: HTMLInputElement) => boolean;
  handleReorder: (from: number, to: number) => void;
  syncRestTicker: () => void;
  clearActiveWorkouts: () => void;
  addExToDraft: (name: string, fallbackSets?: number, fallbackReps?: number) => void;
  syncWorkoutRoutineNames: (oldName?: string, newName?: string) => void;
}

export function createWorkoutController(ctx: AppContext): WorkoutController {
  let restTimerInterval: ReturnType<typeof setInterval> | undefined;

  function addExToDraft(name: string, fallbackSets?: number, fallbackReps?: number): void {
    const clean = name.trim();
    if (!clean) return;
    const S = ctx.state;
    const today = todayIso();
    const firstRoutine = routineNames(S.settings)[0] ?? 'Libre';
    const draft = S.logDraft ?? (S.logDraft = initLogDraft(S, firstRoutine, today));
    const existingIdx = draft.exercises.findIndex((e) => norm(e.name) === norm(clean));
    if (existingIdx < 0) {
      draft.exercises.push({
        name: clean,
        done: false,
        sets: defaultSetsForEx(S, clean, fallbackSets, fallbackReps, false),
        note: '',
      });
    }
    draft.dirty = true;
    saveDraft(draft);
    ctx.render();
    if (existingIdx >= 0) {
      ctx.root.querySelector<HTMLElement>(`[data-ex-idx="${existingIdx}"]`)?.scrollIntoView?.({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }

  function syncRestTicker(): void {
    const S = ctx.state;
    const until = S.liveWorkout?.restUntil;
    const active = until != null && until > Date.now();
    if (active && restTimerInterval == null) {
      restTimerInterval = setInterval(() => {
        const curState = ctx.state;
        const targetUntil = curState.liveWorkout?.restUntil;
        if (targetUntil == null) {
          clearInterval(restTimerInterval);
          restTimerInterval = undefined;
          updateNavRestBadges(ctx.root, 0);
          return;
        }
        updateRestBarDom(ctx.root, curState);
        if (targetUntil <= Date.now()) {
          clearInterval(restTimerInterval);
          restTimerInterval = undefined;
          try {
            navigator?.vibrate?.([40, 40, 40]);
          } catch {
            /* navigator.vibrate opcional */
          }
          playRestBeep();
          if (curState.tab !== 'workout') ctx.toast('Descanso completado · listo para la siguiente serie.');
        }
      }, 1000);
    } else if (!active && restTimerInterval != null) {
      clearInterval(restTimerInterval);
      restTimerInterval = undefined;
    }
  }

  function clearActiveWorkouts(): void {
    const S = ctx.state;
    S.logDraft = undefined;
    saveDraft(undefined);
    S.liveWorkout = undefined;
    saveLive(undefined);
    syncRestTicker();
    updateNavRestBadges(ctx.root, 0);
  }

  function syncWorkoutRoutineNames(oldName?: string, newName?: string): void {
    const S = ctx.state;
    if (oldName && newName) {
      if (S.logDraft?.day === oldName) {
        S.logDraft.day = newName;
        saveDraft(S.logDraft);
      }
      if (S.liveWorkout?.day === oldName) {
        S.liveWorkout.day = newName;
        saveLive(S.liveWorkout);
      }
      return;
    }
    if (S.logDraft && S.logDraft.day !== 'Libre' && !S.settings.routines[S.logDraft.day]) {
      S.logDraft.day = routineNames(S.settings)[0] ?? 'Libre';
      saveDraft(S.logDraft);
    }
  }

  async function persistCompletedSession(opts: {
    sessionId: string;
    day: DayName | 'Libre';
    date: string;
    exercises: LogExDraft[];
    replaceExisting?: boolean;
    defaultDurPerEx?: number;
    tsBase?: number;
  }): Promise<number> {
    if (!isValidIsoDate(opts.date)) {
      ctx.toast('Selecciona una fecha válida antes de guardar.');
      return 0;
    }
    const S = ctx.state;
    const rows: StrengthRow[] = [];
    const usedIds = new Set<string>();
    const fallbackTs = opts.tsBase ?? (Date.parse(`${opts.date}T12:00:00Z`) || Date.now());
    for (const ex of opts.exercises) {
      const sets = ex.sets
        .filter((s) => s.done && s.r > 0)
        .map((s) => ({
          w: Math.max(0, Number(s.w) || 0),
          r: Math.max(1, Math.round(Number(s.r) || 0)),
          ...(s.restSec != null && Number.isFinite(s.restSec) && s.restSec >= 0 ? { restSec: Math.round(s.restSec) } : {}),
          ...(s.rir != null && Number.isFinite(s.rir) && s.rir >= 0 && s.rir <= 10 ? { rir: Math.round(s.rir) } : {}),
        }));
      if (!sets.length) continue;
      const durMin = ex.meta?.durMin ?? opts.defaultDurPerEx;
      const slug = norm(ex.name) || encodeURIComponent(ex.name.trim()).replace(/%/g, '').slice(0, 24) || 'ex';
      let rowId = ex.meta?.id ?? `${opts.sessionId}-${slug}`;
      if (usedIds.has(rowId)) {
        let n = 2;
        while (usedIds.has(`${rowId}-${n}`)) n++;
        rowId = `${rowId}-${n}`;
      }
      usedIds.add(rowId);
      rows.push({
        id: rowId,
        sessionId: opts.sessionId,
        ts: ex.meta?.ts ?? fallbackTs,
        date: opts.date,
        ref: `name:${ex.name.trim()}`,
        sets,
        ...(durMin != null ? { durMin } : {}),
        ...(ex.meta?.avgHr != null ? { avgHr: ex.meta.avgHr } : {}),
        ...(ex.meta?.maxHr != null ? { maxHr: ex.meta.maxHr } : {}),
        ...(ex.meta?.minHr != null ? { minHr: ex.meta.minHr } : {}),
        ...(ex.meta?.kcal != null ? { kcal: ex.meta.kcal } : {}),
        ...(ex.note.trim() ? { note: ex.note.trim() } : {}),
        ...(opts.day !== 'Libre' ? { day: opts.day } : {}),
      });
    }
    if (!rows.length) {
      ctx.toast('Marca con ✓ al menos una serie completada (con repeticiones > 0) antes de guardar.');
      return 0;
    }
    if (opts.replaceExisting) {
      const legacySid = `manual-${opts.date}`;
      const oldSessionRows = S.strength.filter(
        (r) =>
          r.sessionId === opts.sessionId ||
          (r.id.startsWith('manual-') && r.sessionId === legacySid && (r.day ?? 'Libre') === opts.day),
      );
      for (const r of oldSessionRows) await deleteKey('strength', r.id);
      if (oldSessionRows.length) {
        markBucketDeletes('strength', oldSessionRows.map((r) => ({ key: r.id, date: r.date })));
      }
    }
    await putMany('strength', rows);
    markBucketUpserts('strength', rows);
    return rows.length;
  }

  function finalizePendingRest(live: LiveWorkout): void {
    if (live.restStartedAt == null) return;
    const elapsedSec = Math.min(1800, Math.max(1, Math.round((Date.now() - live.restStartedAt) / 1000)));
    if (live.restRef) {
      const refSet = live.exercises[live.restRef.ei]?.sets[live.restRef.si];
      if (refSet && (refSet.restSec == null || refSet.restSec === live.targetRestSec)) {
        refSet.restSec = elapsedSec;
        const restInp = ctx.root.querySelector<HTMLInputElement>(`[data-live-rest="${live.restRef.ei}|${live.restRef.si}"]`);
        if (restInp) restInp.value = String(elapsedSec);
      }
    }
    delete live.restStartedAt;
    delete live.restUntil;
    delete live.restRef;
  }

  function applyLiveExPick(rawName: string): void {
    const S = ctx.state;
    const live = S.liveWorkout;
    const name = rawName.trim();
    if (!live || !live.pickerMode) return;
    if (!name) {
      ctx.toast('Elige o escribe un ejercicio.');
      return;
    }
    const planned = live.day !== 'Libre' ? S.settings.routines[live.day]?.find((x) => norm(x.name) === norm(name)) : undefined;
    const exDraft: LogExDraft = {
      name,
      done: false,
      sets: defaultSetsForEx(S, name, planned?.sets ?? 3, planned?.reps ?? 10, false),
      note: '',
    };
    if (live.pickerMode === 'swap' && live.exercises[live.curIdx]) {
      live.exercises.splice(live.curIdx, 1, exDraft);
      delete live.lastCompletedExIdx;
      ctx.toast(`Cambiado a ${name}.`);
    } else {
      const insertAt = live.exercises.length ? Math.min(live.curIdx + 1, live.exercises.length) : 0;
      live.exercises.splice(insertAt, 0, exDraft);
      live.curIdx = insertAt;
      delete live.lastCompletedExIdx;
      ctx.toast(`${name} añadido al entreno.`);
    }
    delete live.pickerMode;
    delete live.pickerQuery;
    delete live.exMenuOpen;
    saveLive(live);
    ctx.render();
  }

  function selectLiveEx(idx: number): void {
    const live = ctx.state.liveWorkout;
    if (!live || !live.exercises.length) return;
    live.curIdx = Math.min(Math.max(0, idx), live.exercises.length - 1);
    delete live.lastCompletedExIdx;
    delete live.pickerMode;
    delete live.exMenuOpen;
    saveLive(live);
    ctx.render();
    if (typeof window !== 'undefined') window.scrollTo?.(0, 0);
  }

  async function confirmSwitchDraft(
    nextDay: DayName | 'Libre',
    nextDate: string,
    nextSessionId?: string,
  ): Promise<boolean> {
    const cur = ctx.state.logDraft;
    if (!cur?.dirty) return true;
    const targetSid = nextSessionId ?? manualSessionId(nextDate, nextDay);
    if (
      cur.day === nextDay &&
      cur.date === nextDate &&
      (cur.sessionId ?? manualSessionId(cur.date, cur.day)) === targetSid
    ) {
      return true;
    }
    return ctx.askConfirm({
      title: 'Cambiar de sesión sin guardar',
      message: 'Tienes series o cambios sin guardar en el entrenamiento actual. Si cambias ahora se descartarán.',
      confirmLabel: 'Descartar cambios',
      danger: true,
    });
  }

  const actions: Record<string, (el: HTMLElement) => void | Promise<void>> = {
    goLog: async (el) => {
      const S = ctx.state;
      const day = arg(el) as DayName | '';
      const today = todayIso();
      if (day) {
        const sameDraft = S.logDraft && S.logDraft.day === day && S.logDraft.date === today;
        if (!sameDraft) {
          if (!(await confirmSwitchDraft(day, today))) return;
          S.logDraft = initLogDraft(S, day, today);
          saveDraft(S.logDraft);
        }
      } else if (!S.logDraft) {
        S.logDraft = initLogDraft(S, routineNames(S.settings)[0] ?? 'Libre', today);
        saveDraft(S.logDraft);
      }
      ctx.setTab('log');
      ctx.render();
      if (typeof window !== 'undefined') window.scrollTo?.(0, 0);
    },
    logDay: async (el) => {
      const S = ctx.state;
      const day = arg(el) as DayName | 'Libre';
      const date = S.logDraft?.date ?? todayIso();
      if (!(await confirmSwitchDraft(day, date))) return;
      S.logDraft = initLogDraft(S, day, date);
      saveDraft(S.logDraft);
      ctx.render();
    },
    logReset: async () => {
      const S = ctx.state;
      if (
        !(await ctx.askConfirm({
          title: 'Reiniciar borrador',
          message: 'Se restaurarán los ejercicios y series por defecto de la rutina actual.',
          confirmLabel: 'Reiniciar',
          danger: true,
        }))
      ) {
        return;
      }
      const day = S.logDraft?.day ?? routineNames(S.settings)[0] ?? 'Libre';
      const date = S.logDraft?.date ?? todayIso();
      S.logDraft = initLogDraft(S, day, date, S.logDraft?.sessionId);
      saveDraft(S.logDraft);
      ctx.render();
    },
    logToggleEx: (el) => {
      const S = ctx.state;
      const ex = S.logDraft?.exercises[+arg(el)];
      if (!ex || !S.logDraft) return;
      const validSets = ex.sets.filter((s) => s.r > 0);
      if (!validSets.length) {
        ctx.toast('Indica al menos 1 repetición antes de marcar ✓.');
        return;
      }
      const next = !validSets.every((s) => s.done);
      for (const s of ex.sets) {
        s.done = next ? s.r > 0 : false;
      }
      ex.done = next;
      if (next) S.logDraft.startedAt ??= Date.now();
      S.logDraft.dirty = true;
      saveDraft(S.logDraft);
      ctx.render();
    },
    logToggleSet: (el) => {
      const [ei, si] = arg(el).split('|').map(Number);
      const S = ctx.state;
      const draft = S.logDraft;
      const ex = draft?.exercises[ei];
      const s = ex?.sets[si];
      if (!draft || !ex || !s) return;
      if (!s.done && !(s.r > 0)) {
        ctx.toast('Indica al menos 1 repetición antes de marcar la serie ✓.');
        ctx.root.querySelector<HTMLInputElement>(`[data-log-r="${ei}|${si}"]`)?.focus?.();
        return;
      }
      s.done = !s.done;
      ex.done = ex.sets.some((x) => Boolean(x.done && x.r > 0));
      draft.dirty = true;
      if (s.done) {
        draft.startedAt ??= Date.now();
        try {
          navigator?.vibrate?.(15);
        } catch {
          /* navigator.vibrate opcional */
        }
      }
      saveDraft(draft);
      syncSetDom(ctx.root, S, ei, si);
    },
    logApplyWeight: (el) => {
      const [eiStr, wStr] = arg(el).split('|');
      const ei = +eiStr;
      const targetW = parseFloat(wStr);
      const draft = ctx.state.logDraft;
      const ex = draft?.exercises[ei];
      if (!draft || !ex || !Number.isFinite(targetW)) return;
      for (const s of ex.sets) {
        if (!s.done) s.w = Math.max(0, targetW);
      }
      draft.dirty = true;
      saveDraft(draft);
      ctx.render();
    },
    restStart: (el) => {
      const live = ctx.state.liveWorkout;
      if (!live) return;
      const sec = Math.max(15, +arg(el) || 90);
      live.targetRestSec = sec;
      live.restStartedAt = Date.now();
      live.restUntil = live.restStartedAt + sec * 1000;
      saveLive(live);
      syncRestTicker();
      updateRestBarDom(ctx.root, ctx.state);
      ctx.root.querySelectorAll<HTMLInputElement>('[data-live-rest]').forEach((inp) => {
        inp.placeholder = String(live.targetRestSec);
      });
    },
    restAdjust: (el) => {
      const live = ctx.state.liveWorkout;
      if (!live) return;
      const deltaSec = +arg(el) || 0;
      const base = Math.max(Date.now(), live.restUntil ?? Date.now());
      live.restStartedAt ??= Date.now();
      live.restUntil = Math.max(Date.now() + 1000, base + deltaSec * 1000);
      saveLive(live);
      updateRestBarDom(ctx.root, ctx.state);
      syncRestTicker();
    },
    restStop: () => {
      const live = ctx.state.liveWorkout;
      if (!live) return;
      finalizePendingRest(live);
      saveLive(live);
      syncRestTicker();
      updateRestBarDom(ctx.root, ctx.state);
    },
    startWorkout: async (el) => {
      const S = ctx.state;
      const day = arg(el);
      if (day) {
        if (S.liveWorkout && S.liveWorkout.day !== day) {
          const hasDone = S.liveWorkout.exercises.some((e) => e.sets.some((s) => s.done && s.r > 0));
          if (
            hasDone &&
            !(await ctx.askConfirm({
              title: 'Entrenamiento en curso',
              message: `Tienes un entreno en curso (${S.liveWorkout.day}). ¿Empezar uno nuevo de "${day}" y descartar el actual?`,
              confirmLabel: 'Empezar nuevo',
              danger: true,
            }))
          ) {
            ctx.setTab('workout');
            ctx.render();
            return;
          }
        }
        if (!S.liveWorkout || S.liveWorkout.day !== day) {
          S.liveWorkout = initLiveWorkout(S, day);
          saveLive(S.liveWorkout);
        }
      }
      ctx.setTab('workout');
      ctx.render();
      if (typeof window !== 'undefined') window.scrollTo?.(0, 0);
    },
    liveStart: (el) => {
      const S = ctx.state;
      const day = arg(el) || 'Libre';
      S.liveWorkout = initLiveWorkout(S, day);
      saveLive(S.liveWorkout);
      syncRestTicker();
      ctx.render();
      if (typeof window !== 'undefined') window.scrollTo?.(0, 0);
    },
    liveSetRestPreset: (el) => {
      const live = ctx.state.liveWorkout;
      if (!live) return;
      live.targetRestSec = Math.max(15, +arg(el) || 90);
      saveLive(live);
      updateRestBarDom(ctx.root, ctx.state);
      ctx.root.querySelectorAll<HTMLInputElement>('[data-live-rest]').forEach((inp) => {
        inp.placeholder = String(live.targetRestSec);
      });
    },
    liveToggleMenu: () => {
      const live = ctx.state.liveWorkout;
      if (!live) return;
      const hadPicker = Boolean(live.pickerMode);
      live.exMenuOpen = !live.exMenuOpen;
      if (live.exMenuOpen) delete live.pickerMode;
      saveLive(live);
      const wrap = ctx.root.querySelector<HTMLElement>('#live-ex-menu-wrap');
      const btn = ctx.root.querySelector<HTMLElement>('[data-act="liveToggleMenu"]');
      if (wrap && btn && !hadPicker) {
        const open = Boolean(live.exMenuOpen);
        wrap.dataset.open = String(open);
        wrap.setAttribute('aria-hidden', String(!open));
        wrap.classList.toggle('grid-rows-[1fr]', open);
        wrap.classList.toggle('opacity-100', open);
        wrap.classList.toggle('translate-y-0', open);
        wrap.classList.toggle('grid-rows-[0fr]', !open);
        wrap.classList.toggle('opacity-0', !open);
        wrap.classList.toggle('-translate-y-1', !open);
        wrap.classList.toggle('pointer-events-none', !open);
        wrap.classList.toggle('!mt-0', !open);
        const nav = ctx.root.querySelector<HTMLElement>('#live-ex-menu');
        if (nav) nav.toggleAttribute('inert', !open);
        btn.setAttribute('aria-expanded', String(open));
        btn.classList.toggle('border-electricBlue', open);
        btn.classList.toggle('bg-electricBlue/20', open);
        btn.classList.toggle('text-white', open);
        btn.classList.toggle('border-white/15', !open);
        btn.classList.toggle('bg-white/5', !open);
        btn.classList.toggle('text-gray-100', !open);
        return;
      }
      ctx.render();
    },
    liveDiscard: async () => {
      const S = ctx.state;
      const live = S.liveWorkout;
      if (!live) return;
      const hasDone = live.exercises.some((e) => e.sets.some((s) => s.done && s.r > 0));
      if (
        hasDone &&
        !(await ctx.askConfirm({
          title: 'Descartar entrenamiento',
          message: '¿Descartar el entrenamiento en curso? Se perderán las series marcadas.',
          confirmLabel: 'Descartar',
          danger: true,
        }))
      ) {
        return;
      }
      S.liveWorkout = undefined;
      saveLive(undefined);
      syncRestTicker();
      updateNavRestBadges(ctx.root, 0);
      ctx.render();
      ctx.toast('Entreno descartado.');
    },
    liveSave: async () => {
      const S = ctx.state;
      const live = S.liveWorkout;
      if (!live) return;
      const validEx = live.exercises.filter((e) => e.sets.some((s) => s.done && s.r > 0));
      const totalDurMin = Math.max(1, Math.round((Date.now() - live.startedAt) / 60000));
      const perExDur = validEx.length > 0 ? Math.max(0.2, Math.round((totalDurMin / validEx.length) * 10) / 10) : undefined;
      const baseSid = manualSessionId(live.date, live.day);
      const hasCollision = S.strength.some((r) => r.sessionId === baseSid);
      const sessionId = hasCollision ? `${baseSid}-${Math.floor(live.startedAt / 1000).toString(36)}` : baseSid;

      let totalSets = 0;
      let tonnageKg = 0;
      const prNames: string[] = [];
      for (const ex of validEx) {
        const doneSets = ex.sets.filter((s) => s.done && s.r > 0);
        totalSets += doneSets.length;
        for (const s of doneSets) tonnageKg += Math.max(0, s.w) * s.r;
        const prev = [...S.analysis.exercises.values()].find((e) => norm(e.name) === norm(ex.name));
        if (prev && prev.n > 0) {
          const bestW = Math.max(...doneSets.map((s) => s.w));
          const bestE1rm = Math.max(...doneSets.map((s) => epley(s.w, s.r)));
          if (bestW > prev.maxWeight + 0.05 || bestE1rm > prev.maxE1rm + 0.05) prNames.push(ex.name);
        }
      }

      const saved = await persistCompletedSession({
        sessionId,
        day: live.day,
        date: live.date,
        exercises: live.exercises,
        defaultDurPerEx: perExDur,
        tsBase: live.startedAt,
      });
      if (!saved) return;
      captureModalTrigger(ctx.root);
      const savedDay = live.day;
      S.liveWorkout = undefined;
      saveLive(undefined);
      syncRestTicker();
      updateNavRestBadges(ctx.root, 0);
      await ctx.reload();
      if (savedDay !== 'Libre') ctx.setTab(savedDay);
      S.workoutSummary = {
        day: savedDay,
        durationMin: totalDurMin,
        exercises: saved,
        sets: totalSets,
        tonnageKg: Math.round(tonnageKg),
        prNames,
      };
      ctx.render();
      ctx.root.querySelector<HTMLElement>('#workout-summary-modal [data-act="closeWorkoutSummary"]')?.focus?.({
        preventScroll: true,
      });
      ctx.queueSync();
    },
    closeWorkoutSummary: () => {
      const S = ctx.state;
      if (!S.workoutSummary) return;
      S.workoutSummary = undefined;
      ctx.render();
      restoreModalFocus(ctx.root, S);
    },
    liveGoEx: (el) => {
      const idx = +arg(el);
      if (!Number.isNaN(idx)) selectLiveEx(idx);
    },
    livePrevEx: () => {
      const live = ctx.state.liveWorkout;
      if (live && live.curIdx > 0) selectLiveEx(live.curIdx - 1);
    },
    liveNextEx: () => {
      const live = ctx.state.liveWorkout;
      if (live && live.curIdx < live.exercises.length - 1) selectLiveEx(live.curIdx + 1);
    },
    liveClearBanner: () => {
      const live = ctx.state.liveWorkout;
      if (!live) return;
      delete live.lastCompletedExIdx;
      saveLive(live);
      ctx.render();
    },
    liveAddExtraSetPrev: () => {
      const live = ctx.state.liveWorkout;
      const prevIdx = live?.lastCompletedExIdx;
      const prevEx = prevIdx != null ? live?.exercises[prevIdx] : undefined;
      if (!live || prevIdx == null || !prevEx) return;
      const last = prevEx.sets.at(-1) ?? { w: 0, r: 8 };
      prevEx.sets.push({ w: last.w, r: last.r, done: false });
      selectLiveEx(prevIdx);
    },
    liveOpenPicker: (el) => {
      const live = ctx.state.liveWorkout;
      if (!live) return;
      live.pickerMode = arg(el) === 'swap' ? 'swap' : 'add';
      delete live.pickerQuery;
      delete live.exMenuOpen;
      saveLive(live);
      ctx.render();
    },
    liveClosePicker: () => {
      const live = ctx.state.liveWorkout;
      if (!live) return;
      delete live.pickerMode;
      delete live.pickerQuery;
      saveLive(live);
      ctx.render();
    },
    livePickEx: (el) => applyLiveExPick(arg(el)),
    livePickFromSelect: () => {
      const sel = ctx.root.querySelector<HTMLSelectElement>('#livePickerSelect');
      applyLiveExPick(sel?.value ?? '');
    },
    livePickCustom: () => {
      const inp = ctx.root.querySelector<HTMLInputElement>('#livePickerCustom');
      applyLiveExPick(inp?.value ?? '');
    },
    liveApplyWeight: (el) => {
      const [eiStr, wStr] = arg(el).split('|');
      const live = ctx.state.liveWorkout;
      const ex = live?.exercises[+eiStr];
      const targetW = parseFloat(wStr);
      if (!live || !ex || !Number.isFinite(targetW)) return;
      for (const s of ex.sets) {
        if (!s.done) s.w = Math.max(0, targetW);
      }
      saveLive(live);
      ctx.render();
    },
    liveAddSet: (el) => {
      const live = ctx.state.liveWorkout;
      const ex = live?.exercises[+arg(el)];
      if (!live || !ex) return;
      const last = ex.sets.at(-1) ?? { w: 0, r: 8 };
      ex.sets.push({ w: last.w, r: last.r, done: false });
      saveLive(live);
      ctx.render();
    },
    liveDelSet: (el) => {
      const [ei, si] = arg(el).split('|').map(Number);
      const live = ctx.state.liveWorkout;
      const ex = live?.exercises[ei];
      if (!live || !ex || ex.sets.length <= 1 || si < 0 || si >= ex.sets.length) return;
      ex.sets.splice(si, 1);
      ex.done = ex.sets.some((x) => Boolean(x.done && x.r > 0));
      if (live.restRef?.ei === ei) {
        if (live.restRef.si === si) delete live.restRef;
        else if (live.restRef.si > si) live.restRef.si -= 1;
      }
      saveLive(live);
      ctx.render();
    },
    liveStepW: (el) => {
      const [ei, si, delta] = arg(el).split('|').map(Number);
      const S = ctx.state;
      const s = S.liveWorkout?.exercises[ei]?.sets[si];
      if (!S.liveWorkout || !s || !Number.isFinite(delta)) return;
      s.w = Math.max(0, Math.round((s.w + delta) * 10) / 10);
      saveLive(S.liveWorkout);
      const inp = ctx.root.querySelector<HTMLInputElement>(`[data-live-w="${ei}|${si}"]`);
      if (inp) {
        inp.value = String(s.w);
        if (s.done) updateLiveCountersDom(ctx.root, S, ei);
      } else {
        ctx.render();
      }
    },
    liveStepR: (el) => {
      const [ei, si, delta] = arg(el).split('|').map(Number);
      const S = ctx.state;
      const ex = S.liveWorkout?.exercises[ei];
      const s = ex?.sets[si];
      if (!S.liveWorkout || !ex || !s || !Number.isFinite(delta)) return;
      s.r = Math.max(0, Math.round(s.r + delta));
      const wasDone = Boolean(s.done);
      if (s.r === 0 && s.done) {
        s.done = false;
        ex.done = ex.sets.some((x) => Boolean(x.done && x.r > 0));
      }
      saveLive(S.liveWorkout);
      const inp = ctx.root.querySelector<HTMLInputElement>(`[data-live-r="${ei}|${si}"]`);
      if (inp) {
        inp.value = String(s.r);
        if (wasDone !== Boolean(s.done)) syncLiveSetDom(ctx.root, S, ei, si);
        else updateLiveCountersDom(ctx.root, S, ei);
      } else {
        ctx.render();
      }
    },
    liveToggleSet: (el) => {
      const [ei, si] = arg(el).split('|').map(Number);
      const S = ctx.state;
      const live = S.liveWorkout;
      const ex = live?.exercises[ei];
      const s = ex?.sets[si];
      if (!live || !ex || !s) return;
      if (!s.done && !(s.r > 0)) {
        ctx.toast('Indica al menos 1 repetición antes de marcar la serie.');
        ctx.root.querySelector<HTMLInputElement>(`[data-live-r="${ei}|${si}"]`)?.focus?.();
        return;
      }
      const hadPrevBanner = live.lastCompletedExIdx != null;
      const wasAllDone =
        live.exercises.length > 0 &&
        live.exercises.every((e) => e.sets.length > 0 && e.sets.every((x) => Boolean(x.done && x.r > 0)));
      let advanced = false;
      if (!s.done) {
        finalizePendingRest(live);
        s.done = true;
        ex.done = ex.sets.some((x) => Boolean(x.done && x.r > 0));
        try {
          navigator?.vibrate?.(15);
        } catch {
          /* navigator.vibrate opcional */
        }
        const hasMoreSets = live.exercises.some((e) => e.sets.some((x) => !(x.done && x.r > 0)));
        if (hasMoreSets) {
          live.restStartedAt = Date.now();
          live.restUntil = live.restStartedAt + live.targetRestSec * 1000;
          live.restRef = { ei, si };
        } else {
          delete live.restStartedAt;
          delete live.restUntil;
          delete live.restRef;
        }
        const exCompleted = ex.sets.length > 0 && ex.sets.every((x) => Boolean(x.done && x.r > 0));
        if (exCompleted) {
          const afterIdx = live.exercises.findIndex((e, i) => i > ei && e.sets.some((x) => !(x.done && x.r > 0)));
          const nextIdx =
            afterIdx >= 0
              ? afterIdx
              : live.exercises.findIndex((e, i) => i !== ei && e.sets.some((x) => !(x.done && x.r > 0)));
          if (nextIdx >= 0) {
            live.lastCompletedExIdx = ei;
            live.curIdx = nextIdx;
            delete live.exMenuOpen;
            delete live.pickerMode;
            advanced = true;
          } else {
            delete live.lastCompletedExIdx;
          }
        } else {
          delete live.lastCompletedExIdx;
        }
      } else {
        s.done = false;
        ex.done = ex.sets.some((x) => Boolean(x.done && x.r > 0));
        if (live.restRef?.ei === ei && live.restRef?.si === si) {
          delete live.restStartedAt;
          delete live.restUntil;
          delete live.restRef;
        }
        if (live.lastCompletedExIdx === ei) delete live.lastCompletedExIdx;
      }
      const nowAllDone =
        live.exercises.length > 0 &&
        live.exercises.every((e) => e.sets.length > 0 && e.sets.every((x) => Boolean(x.done && x.r > 0)));
      const nowPrevBanner = live.lastCompletedExIdx != null;
      saveLive(live);
      if (!wasAllDone && nowAllDone) {
        const completedSets = live.exercises.reduce((total, exercise) => total + exercise.sets.filter((set) => set.done && set.r > 0).length, 0);
        const durationMin = Math.max(1, Math.round((Date.now() - live.startedAt) / 60000));
        ctx.toast(`Entreno completo · ${completedSets} series · ${durationMin} min.`);
      }
      syncRestTicker();
      if (advanced || wasAllDone !== nowAllDone || hadPrevBanner !== nowPrevBanner) {
        ctx.render();
        if (advanced && typeof window !== 'undefined') window.scrollTo?.(0, 0);
      } else {
        syncLiveSetDom(ctx.root, S, ei, si);
      }
      updateRestBarDom(ctx.root, S);
    },
    logRemoveEx: (el) => {
      const draft = ctx.state.logDraft;
      if (!draft) return;
      draft.exercises.splice(+arg(el), 1);
      draft.dirty = true;
      saveDraft(draft);
      ctx.render();
    },
    logMoveEx: (el) => {
      const draft = ctx.state.logDraft;
      if (!draft) return;
      const [ei, dir] = arg(el).split('|').map(Number);
      if (!moveItem(draft.exercises, ei, ei + dir)) return;
      draft.dirty = true;
      saveDraft(draft);
      ctx.render();
    },
    logAddEx: () => {
      const sel = ctx.root.querySelector<HTMLSelectElement>('#logAddSelect');
      delete ctx.state.logAddQuery;
      if (sel?.value) addExToDraft(sel.value);
    },
    logAddCustomEx: () => {
      const inp = ctx.root.querySelector<HTMLInputElement>('#logNewExName');
      if (inp?.value.trim()) addExToDraft(inp.value);
    },
    logAddQuick: (el) => addExToDraft(arg(el)),
    logAddSet: (el) => {
      const draft = ctx.state.logDraft;
      const ex = draft?.exercises[+arg(el)];
      if (!ex || !draft) return;
      const last = ex.sets[ex.sets.length - 1];
      ex.sets.push(last ? { w: last.w, r: last.r, done: false } : { w: 0, r: 10, done: false });
      draft.dirty = true;
      saveDraft(draft);
      ctx.render();
    },
    logDelSet: (el) => {
      const [ei, si] = arg(el).split('|').map(Number);
      const draft = ctx.state.logDraft;
      const ex = draft?.exercises[ei];
      if (!ex || !draft) return;
      ex.sets.splice(si, 1);
      ex.done = ex.sets.some((s) => Boolean(s.done));
      draft.dirty = true;
      saveDraft(draft);
      ctx.render();
    },
    logStepW: (el) => {
      const [ei, si, step] = arg(el).split('|').map(Number);
      const draft = ctx.state.logDraft;
      const s = draft?.exercises[ei]?.sets[si];
      if (!s || !draft) return;
      s.w = Math.max(0, Math.round((s.w + step) * 10) / 10);
      draft.dirty = true;
      saveDraft(draft);
      const inp = ctx.root.querySelector<HTMLInputElement>(`[data-log-w="${ei}|${si}"]`);
      if (inp) inp.value = String(s.w);
      else ctx.render();
    },
    logStepR: (el) => {
      const [ei, si, step] = arg(el).split('|').map(Number);
      const S = ctx.state;
      const draft = S.logDraft;
      const ex = draft?.exercises[ei];
      const s = ex?.sets[si];
      if (!ex || !s || !draft) return;
      s.r = Math.max(0, s.r + step);
      const wasDone = Boolean(s.done);
      if (s.r === 0 && s.done) {
        s.done = false;
        ex.done = ex.sets.some((x) => Boolean(x.done && x.r > 0));
      }
      draft.dirty = true;
      saveDraft(draft);
      const inp = ctx.root.querySelector<HTMLInputElement>(`[data-log-r="${ei}|${si}"]`);
      if (inp) inp.value = String(s.r);
      else ctx.render();
      if (wasDone !== Boolean(s.done)) syncSetDom(ctx.root, S, ei, si);
      else updateLogCountersDom(ctx.root, S, ei);
    },
    logSave: async () => {
      const S = ctx.state;
      const draft = S.logDraft;
      if (!draft) return;
      const saved = await persistCompletedSession({
        sessionId: draft.sessionId ?? manualSessionId(draft.date, draft.day),
        day: draft.day,
        date: draft.date,
        exercises: draft.exercises,
        replaceExisting: true,
      });
      if (!saved) return;
      const savedDay = draft.day;
      S.logDraft = undefined;
      saveDraft(undefined);
      await ctx.reload();
      if (savedDay !== 'Libre') ctx.setTab(savedDay);
      ctx.render();
      ctx.queueSync();
      ctx.toast(`Sesión guardada: ${saved} ${saved === 1 ? 'ejercicio' : 'ejercicios'}.`);
    },
    logEditSession: async (el) => {
      const S = ctx.state;
      const parts = arg(el).split('|');
      const [sessionId, date, day] = parts.length >= 3 ? parts : ['', parts[0], parts[1]];
      const nextDay = (day as DayName | 'Libre') || 'Libre';
      if (!(await confirmSwitchDraft(nextDay, date, sessionId || undefined))) return;
      S.logDraft = initLogDraft(S, nextDay, date, sessionId || undefined);
      saveDraft(S.logDraft);
      ctx.render();
      if (typeof window !== 'undefined') window.scrollTo?.(0, 0);
    },
    logDelSession: async (el) => {
      const S = ctx.state;
      const [sessionId, date] = arg(el).split('|');
      const byId = S.strength.filter((r) => r.sessionId === sessionId);
      const toDel = byId.length ? byId : S.strength.filter((r) => r.date === date);
      if (!toDel.length) return;
      if (
        !(await ctx.askConfirm({
          title: `Borrar sesión del ${date}`,
          message: `Se eliminarán ${toDel.length} ${toDel.length === 1 ? 'ejercicio' : 'ejercicios'} de esta sesión. Esta acción no se puede deshacer.`,
          confirmLabel: 'Borrar sesión',
          danger: true,
        }))
      ) {
        return;
      }
      for (const r of toDel) await deleteKey('strength', r.id);
      markBucketDeletes('strength', toDel.map((r) => ({ key: r.id, date: r.date })));
      await ctx.reload();
      ctx.render();
      ctx.queueSync();
      ctx.toast('Sesión borrada.');
    },
  };

  const changes: Record<string, (el: HTMLInputElement | HTMLSelectElement) => void | Promise<void>> = {
    logDate: async (el) => {
      const S = ctx.state;
      if (!isValidIsoDate(el.value)) {
        if (S.logDraft) el.value = S.logDraft.date;
        ctx.toast('Introduce una fecha válida.');
        return;
      }
      const day = S.logDraft?.day ?? routineNames(S.settings)[0] ?? 'Libre';
      if (!(await confirmSwitchDraft(day, el.value))) {
        if (S.logDraft) el.value = S.logDraft.date;
        return;
      }
      S.logDraft = initLogDraft(S, day, el.value);
      saveDraft(S.logDraft);
      ctx.render();
    },
  };

  function handleInput(el: HTMLInputElement): boolean {
    const S = ctx.state;
    if (el.dataset.livePickerSearch && S.liveWorkout) {
      S.liveWorkout.pickerQuery = el.value;
      saveLive(S.liveWorkout);
      const { avail } = quickExSuggestions(S, S.liveWorkout.day, S.liveWorkout.exercises.map((e) => e.name), 8);
      const options = filterSelectionOptions(avail.map((name) => ({ id: name, label: name })), el.value);
      const select = ctx.root.querySelector<HTMLSelectElement>('#livePickerSelect');
      if (select) {
        select.replaceChildren(new Option(`Resultados (${options.length})…`, ''));
        options.forEach((option) => select.add(new Option(option.label, option.id)));
      }
      return true;
    }
    if (el.dataset.input === 'logAddSearch' && S.logDraft) {
      S.logAddQuery = el.value;
      ctx.render();
      return true;
    }
    if (!S.logDraft && !S.liveWorkout) return false;
    if (S.logDraft) {
      const draft = S.logDraft;
      if (el.dataset.logW) {
        const [ei, si] = el.dataset.logW.split('|').map(Number);
        const s = draft.exercises[ei]?.sets[si];
        if (s) {
          s.w = Math.max(0, parseFloat(el.value.replace(',', '.')) || 0);
          draft.dirty = true;
          saveDraft(draft);
        }
        return true;
      }
      if (el.dataset.logR) {
        const [ei, si] = el.dataset.logR.split('|').map(Number);
        applyRepsEdit(
          draft.exercises[ei],
          ei,
          si,
          el,
          false,
          () => {
            draft.dirty = true;
            saveDraft(draft);
          },
          (x, y) => syncSetDom(ctx.root, S, x, y),
          (x) => updateLogCountersDom(ctx.root, S, x),
        );
        return true;
      }
      if (el.dataset.logRest) {
        const [ei, si] = el.dataset.logRest.split('|').map(Number);
        const s = draft.exercises[ei]?.sets[si];
        if (s) {
          const raw = el.value.trim();
          if (!raw) delete s.restSec;
          else s.restSec = Math.min(1800, Math.max(0, Math.round(Number(raw) || 0)));
          draft.dirty = true;
          saveDraft(draft);
        }
        return true;
      }
      if (el.dataset.logRir) {
        const [ei, si] = el.dataset.logRir.split('|').map(Number);
        const s = draft.exercises[ei]?.sets[si];
        if (s) {
          const raw = el.value.trim();
          if (!raw) delete s.rir;
          else s.rir = Math.min(10, Math.max(0, Math.round(Number(raw) || 0)));
          draft.dirty = true;
          saveDraft(draft);
        }
        return true;
      }
      if (el.dataset.logNote != null) {
        const ex = draft.exercises[+el.dataset.logNote];
        if (ex) {
          ex.note = el.value;
          draft.dirty = true;
          saveDraft(draft);
        }
        return true;
      }
    }
    const live = S.liveWorkout;
    if (!live) return false;
    if (el.dataset.liveW) {
      const [ei, si] = el.dataset.liveW.split('|').map(Number);
      const s = live.exercises[ei]?.sets[si];
      if (s) {
        s.w = Math.max(0, parseFloat(el.value.replace(',', '.')) || 0);
        saveLive(live);
        if (s.done) updateLiveCountersDom(ctx.root, S, ei);
      }
      return true;
    }
    if (el.dataset.liveR) {
      const [ei, si] = el.dataset.liveR.split('|').map(Number);
      applyRepsEdit(
        live.exercises[ei],
        ei,
        si,
        el,
        false,
        () => saveLive(live),
        (x, y) => syncLiveSetDom(ctx.root, S, x, y),
        (x) => updateLiveCountersDom(ctx.root, S, x),
      );
      return true;
    }
    if (el.dataset.liveRest) {
      const [ei, si] = el.dataset.liveRest.split('|').map(Number);
      const s = live.exercises[ei]?.sets[si];
      if (s) {
        const raw = el.value.trim();
        if (!raw) delete s.restSec;
        else s.restSec = Math.min(1800, Math.max(0, Math.round(Number(raw) || 0)));
        saveLive(live);
      }
      return true;
    }
    if (el.dataset.liveRir) {
      const [ei, si] = el.dataset.liveRir.split('|').map(Number);
      const s = live.exercises[ei]?.sets[si];
      if (s) {
        const raw = el.value.trim();
        if (!raw) delete s.rir;
        else s.rir = Math.min(10, Math.max(0, Math.round(Number(raw) || 0)));
        saveLive(live);
      }
      return true;
    }
    if (el.dataset.liveNote != null) {
      const ex = live.exercises[+el.dataset.liveNote];
      if (ex) {
        ex.note = el.value;
        saveLive(live);
      }
      return true;
    }
    return false;
  }

  function handleFocusout(el: HTMLInputElement): boolean {
    const S = ctx.state;
    if (el.dataset.logR && S.logDraft) {
      const draft = S.logDraft;
      const [ei, si] = el.dataset.logR.split('|').map(Number);
      applyRepsEdit(
        draft.exercises[ei],
        ei,
        si,
        el,
        true,
        () => {
          draft.dirty = true;
          saveDraft(draft);
        },
        (x, y) => syncSetDom(ctx.root, S, x, y),
        (x) => updateLogCountersDom(ctx.root, S, x),
      );
      return true;
    }
    if (el.dataset.liveR && S.liveWorkout) {
      const live = S.liveWorkout;
      const [ei, si] = el.dataset.liveR.split('|').map(Number);
      applyRepsEdit(
        live.exercises[ei],
        ei,
        si,
        el,
        true,
        () => saveLive(live),
        (x, y) => syncLiveSetDom(ctx.root, S, x, y),
        (x) => updateLiveCountersDom(ctx.root, S, x),
      );
      return true;
    }
    return false;
  }

  function handleReorder(from: number, to: number): void {
    const draft = ctx.state.logDraft;
    if (!draft || !moveItem(draft.exercises, from, to)) return;
    draft.dirty = true;
    saveDraft(draft);
    ctx.render();
  }

  return {
    actions,
    changes,
    handleInput,
    handleFocusout,
    handleReorder,
    syncRestTicker,
    clearActiveWorkouts,
    addExToDraft,
    syncWorkoutRoutineNames,
  };
}
