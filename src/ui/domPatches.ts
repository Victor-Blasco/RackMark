import { fmtMMSS, renderRestTimerBar } from './logView';
import { liveExQuickInfo } from './workoutView';
import type { State } from './shared';

export const MODAL_DIALOG_SELECTOR = '#confirm-modal, #wizard-modal, #ex-modal, #rt-modal, #note-modal, #workout-summary-modal';
export const MODAL_FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let lastModalTrigger: { selector: string | null; index: number } | null = null;

export function focusSelector(el: Element | null): string | null {
  if (!(el instanceof HTMLElement)) return null;
  if (el.id) return `#${CSS.escape(el.id)}`;
  if (el.dataset.logW) return `[data-log-w="${CSS.escape(el.dataset.logW)}"]`;
  if (el.dataset.logR) return `[data-log-r="${CSS.escape(el.dataset.logR)}"]`;
  if (el.dataset.logRest) return `[data-log-rest="${CSS.escape(el.dataset.logRest)}"]`;
  if (el.dataset.logNote != null) return `[data-log-note="${CSS.escape(el.dataset.logNote)}"]`;
  if (el.dataset.liveW) return `[data-live-w="${CSS.escape(el.dataset.liveW)}"]`;
  if (el.dataset.liveR) return `[data-live-r="${CSS.escape(el.dataset.liveR)}"]`;
  if (el.dataset.liveRest) return `[data-live-rest="${CSS.escape(el.dataset.liveRest)}"]`;
  if (el.dataset.liveNote != null) return `[data-live-note="${CSS.escape(el.dataset.liveNote)}"]`;
  if (el.closest('#f-measure') && (el as HTMLInputElement).name) {
    return `#f-measure [name="${CSS.escape((el as HTMLInputElement).name)}"]`;
  }
  if (el.dataset.act) {
    const argVal = el.dataset.arg != null ? `[data-arg="${CSS.escape(el.dataset.arg)}"]` : '';
    return `[data-act="${CSS.escape(el.dataset.act)}"]${argVal}`;
  }
  if (el.dataset.change) {
    const argVal = el.dataset.arg != null ? `[data-arg="${CSS.escape(el.dataset.arg)}"]` : '';
    return `[data-change="${CSS.escape(el.dataset.change)}"]${argVal}`;
  }
  return null;
}

export const hasModalTrigger = (): boolean => lastModalTrigger != null;

export function captureModalTrigger(root: HTMLElement): void {
  const activeEl = document.activeElement;
  if (!(activeEl instanceof HTMLElement) || activeEl.closest(MODAL_DIALOG_SELECTOR) || activeEl === document.body) {
    lastModalTrigger = null;
    return;
  }
  const selector = focusSelector(activeEl);
  const index = selector ? Math.max(0, [...root.querySelectorAll<HTMLElement>(selector)].indexOf(activeEl)) : 0;
  lastModalTrigger = { selector, index };
}

export function restoreModalFocus(root: HTMLElement, S: State): void {
  if (S.confirmModal || S.wizard || S.exModal || S.routineModal || S.noteModal) return;
  const trigger = lastModalTrigger;
  lastModalTrigger = null;
  if (!trigger) return;
  if (trigger.selector) {
    const matches = root.querySelectorAll<HTMLElement>(trigger.selector);
    const target = matches[trigger.index] ?? matches[0];
    if (target) {
      target.focus({ preventScroll: true });
      return;
    }
  }
  document.getElementById('main-content')?.focus({ preventScroll: true });
}

export function playRestBeep(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [880, 1046].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.08, now + i * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.16 + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.16);
      osc.stop(now + i * 0.16 + 0.15);
    });
    setTimeout(() => { void ctx.close().catch(() => {}); }, 600);
  } catch { /* AudioContext opcional según navegador */ }
}

export function updateNavRestBadges(root: HTMLElement, remSec: number): void {
  const text = remSec > 0 ? fmtMMSS(remSec) : '';
  root.querySelectorAll<HTMLElement>('[data-nav-rest]').forEach((el) => {
    el.textContent = text;
    el.classList.toggle('hidden', remSec <= 0);
  });
}

export function updateRestBarDom(root: HTMLElement, S: State): void {
  const live = S.liveWorkout;
  const until = live?.restUntil;
  const remSec = until != null ? Math.max(0, Math.ceil((until - Date.now()) / 1000)) : 0;
  updateNavRestBadges(root, remSec);
  const elapsedEl = root.querySelector<HTMLElement>('#live-elapsed');
  if (elapsedEl && live) {
    const min = Math.max(0, Math.floor((Date.now() - live.startedAt) / 60000));
    elapsedEl.textContent = min < 60 ? `${min} min` : `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
  }
  const bar = root.querySelector<HTMLElement>('#rest-timer-bar');
  if (!bar || !live) return;
  const nextState = until != null && remSec > 0 ? 'running' : until != null ? 'done' : 'idle';
  if (bar.dataset.restState === 'running' && nextState === 'running') {
    const valEl = root.querySelector<HTMLElement>('#rest-timer-val');
    if (valEl) {
      valEl.textContent = fmtMMSS(remSec);
      return;
    }
  }
  bar.outerHTML = renderRestTimerBar(live);
}

export function updateLogCountersDom(root: HTMLElement, S: State, ei?: number): void {
  const draft = S.logDraft;
  if (!draft) return;
  const doneExCount = draft.exercises.filter((e) => e.sets.some((s) => s.done && s.r > 0)).length;
  const doneSetsCount = draft.exercises.reduce((acc, e) => acc + e.sets.filter((s) => s.done && s.r > 0).length, 0);
  const totalSetsCount = draft.exercises.reduce((acc, e) => acc + e.sets.length, 0);

  const summary = document.getElementById('logCountSummary');
  if (summary) summary.textContent = `${doneExCount}/${draft.exercises.length} ejercicios · ${doneSetsCount}/${totalSetsCount} series marcadas ✓`;

  const saveBtns = root.querySelectorAll<HTMLButtonElement>('button[data-act="logSave"]');
  saveBtns.forEach((btn, idx) => {
    const label = idx === 0 ? ` Guardar (${doneSetsCount})` : ` Guardar sesión (${doneSetsCount} series)`;
    const svg = btn.querySelector('svg');
    btn.textContent = '';
    if (svg) btn.appendChild(svg);
    btn.appendChild(document.createTextNode(label));
  });

  if (ei != null && draft.exercises[ei]) {
    const ex = draft.exercises[ei];
    const doneInEx = ex.sets.filter((s) => s.done && s.r > 0).length;
    const allDoneInEx = ex.sets.length > 0 && doneInEx === ex.sets.length;
    const counter = root.querySelector<HTMLElement>(`[data-ex-counter="${ei}"]`);
    if (counter) {
      counter.textContent = `${doneInEx}/${ex.sets.length}`;
      counter.className = `ml-1 tabular-nums text-xs font-semibold ${allDoneInEx ? 'text-emerald-300' : 'text-gray-400'}`;
    }
    const card = root.querySelector<HTMLElement>(`[data-ex-idx="${ei}"]`);
    if (card) {
      card.classList.remove('border-emeraldGreen/50', 'border-electricBlue/50', 'border-white/10');
      card.classList.add(allDoneInEx ? 'border-emeraldGreen/50' : doneInEx > 0 ? 'border-electricBlue/50' : 'border-white/10');
    }
    const toggleBtn = root.querySelector<HTMLElement>(`[data-act="logToggleEx"][data-arg="${ei}"]`);
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-pressed', String(allDoneInEx));
      const box = toggleBtn.querySelector<HTMLElement>('span');
      if (box) {
        box.className = `mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${allDoneInEx ? 'border-emeraldGreen bg-emeraldGreen/20 text-emeraldGreen' : doneInEx > 0 ? 'border-electricBlue bg-electricBlue/20 text-blue-300' : 'border-gray-600 text-transparent'}`;
      }
    }
  }
}

export function syncSetDom(root: HTMLElement, S: State, ei: number, si: number): void {
  const ex = S.logDraft?.exercises[ei];
  const s = ex?.sets[si];
  if (!ex || !s) return;
  const row = root.querySelector<HTMLElement>(`[data-set-row="${ei}|${si}"]`);
  if (row) {
    row.className = `flex flex-wrap sm:flex-nowrap items-center gap-1.5 rounded-xl p-1.5 transition-colors ${s.done ? 'bg-emeraldGreen/10' : ''}`;
    const label = row.querySelector<HTMLElement>('span');
    if (label) label.className = `w-5 shrink-0 text-center tabular-nums text-xs font-bold ${s.done ? 'text-emerald-300' : 'text-gray-400'}`;
  }
  const btn = root.querySelector<HTMLElement>(`[data-act="logToggleSet"][data-arg="${ei}|${si}"]`);
  if (btn) {
    btn.setAttribute('aria-pressed', String(Boolean(s.done)));
    btn.setAttribute('aria-label', `${s.done ? 'Desmarcar' : 'Completar'} serie ${si + 1} de ${ex.name}`);
    btn.className = `ml-auto sm:ml-0 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors active:scale-95 ${s.done ? 'border-emeraldGreen bg-emeraldGreen text-gray-950' : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-emeraldGreen/60 hover:text-white'}`;
  }
  updateLogCountersDom(root, S, ei);
}

export function updateLiveCountersDom(root: HTMLElement, S: State, ei?: number): void {
  const live = S.liveWorkout;
  if (!live) return;
  const doneExCount = live.exercises.filter((e) => e.sets.length > 0 && e.sets.every((s) => s.done && s.r > 0)).length;
  const doneSetsCount = live.exercises.reduce((acc, e) => acc + e.sets.filter((s) => s.done && s.r > 0).length, 0);
  const totalSetsCount = live.exercises.reduce((acc, e) => acc + e.sets.length, 0);

  const countSummary = document.getElementById('liveCountSummary');
  if (countSummary) countSummary.textContent = `${doneSetsCount}/${totalSetsCount} series`;

  const finishLabel = document.getElementById('liveFinishLabel');
  if (finishLabel) finishLabel.textContent = `Terminar (${doneSetsCount})`;

  const menuSummary = document.getElementById('liveMenuSummary');
  if (menuSummary) menuSummary.textContent = `Ejercicios (${doneExCount}/${live.exercises.length} listos)`;

  if (ei != null && live.exercises[ei]) {
    const item = live.exercises[ei];
    const { infoLine, doneInEx, allDoneInEx } = liveExQuickInfo(S, live.day, item);
    const exCounter = root.querySelector<HTMLElement>(`[data-live-ex-counter="${ei}"]`);
    if (exCounter) {
      exCounter.textContent = `${doneInEx}/${item.sets.length} series`;
      exCounter.className = `shrink-0 pt-1 text-xs font-bold tabular-nums ${allDoneInEx ? 'text-emerald-300' : 'text-gray-400'}`;
    }
    const menuCount = root.querySelector<HTMLElement>(`[data-live-menu-count="${ei}"]`);
    if (menuCount) {
      menuCount.textContent = `${doneInEx}/${item.sets.length}`;
      menuCount.className = `shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-xs font-bold tabular-nums ${allDoneInEx ? 'text-emerald-300' : 'text-gray-400'}`;
    }
    const menuInfo = root.querySelector<HTMLElement>(`[data-live-menu-info="${ei}"]`);
    if (menuInfo) menuInfo.textContent = infoLine;
  }
}

export function syncLiveSetDom(root: HTMLElement, S: State, ei: number, si: number): void {
  const ex = S.liveWorkout?.exercises[ei];
  const s = ex?.sets[si];
  if (!ex || !s) return;
  const row = root.querySelector<HTMLElement>(`[data-live-set="${ei}|${si}"]`);
  if (row) {
    row.className = `py-3 space-y-2 transition-colors ${s.done ? 'bg-emeraldGreen/10 -mx-2 px-2 rounded-lg' : ''}`;
  }
  const lbl = root.querySelector<HTMLElement>(`[data-live-set-lbl="${ei}|${si}"]`);
  if (lbl) {
    lbl.textContent = `Serie ${si + 1}${s.done ? ' · Hecha' : ''}`;
    lbl.className = `font-bold tabular-nums ${s.done ? 'text-emerald-300' : 'text-gray-300'}`;
  }
  const btn = root.querySelector<HTMLElement>(`[data-act="liveToggleSet"][data-arg="${ei}|${si}"]`);
  if (btn) {
    btn.setAttribute('aria-pressed', String(Boolean(s.done)));
    btn.setAttribute('aria-label', `${s.done ? 'Desmarcar' : 'Marcar'} serie ${si + 1}`);
    btn.className = `flex h-11 w-11 sm:w-20 items-center justify-center gap-1 rounded-xl border text-xs font-bold transition-colors active:scale-95 ${s.done ? 'border-emeraldGreen bg-emeraldGreen text-gray-950' : 'border-white/15 bg-white/5 text-gray-200 hover:border-emeraldGreen/60'}`;
    const span = btn.querySelector('span');
    if (span) span.textContent = s.done ? 'Hecha' : 'Listo';
  }
  updateLiveCountersDom(root, S, ei);
}
