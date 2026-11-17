import { defaultSetsForEx, exerciseContext, quickExSuggestions, renderRestTimerBar, renderStepper } from './logView';
import { filterSelectionOptions } from './selection';
import { icon } from './icons';
import { esc, fmtDate, routineColor, routineNames, todayIso, type State } from './shared';
import type { DayName, LiveWorkout, LogExDraft } from '../types';

function suggestedNextRoutine(S: State, routines: DayName[]): DayName | undefined {
  if (!routines.length) return undefined;
  const lastWithRoutine = [...S.analysis.sessions].reverse().find((s) => s.day && routines.includes(s.day));
  if (!lastWithRoutine?.day) return routines[0];
  const idx = routines.indexOf(lastWithRoutine.day);
  return routines[(idx + 1) % routines.length];
}

function fmtElapsed(startedAt: number): string {
  const min = Math.max(0, Math.floor((Date.now() - startedAt) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/** Inicializa una sesión en vivo paso a paso para la rutina seleccionada. */
export function initLiveWorkout(S: State, day: DayName | 'Libre'): LiveWorkout {
  const exercises: LogExDraft[] = day === 'Libre'
    ? []
    : (S.settings.routines[day] ?? []).map((r) => ({
        name: r.name,
        done: false,
        sets: defaultSetsForEx(S, r.name, r.sets, r.reps, false),
        note: '',
      }));
  return {
    date: todayIso(),
    day,
    startedAt: Date.now(),
    curIdx: 0,
    exercises,
    targetRestSec: S.liveWorkout?.targetRestSec ?? 90,
    ...(exercises.length === 0 ? { pickerMode: 'add' as const } : {}),
  };
}

function renderDayPicker(S: State): string {
  const routines = routineNames(S.settings);
  const suggested = suggestedNextRoutine(S, routines);
  const lastByDay = new Map<string, string>();
  for (const s of S.analysis.sessions) {
    if (s.day) lastByDay.set(s.day, s.date);
  }

  return `<div class="mx-auto max-w-xl space-y-5 py-1">
    <div class="space-y-1">
      <h2 class="text-xl font-extrabold text-white">Iniciar entrenamiento</h2>
      <p class="text-sm text-gray-400">Elige qué toca hoy. Verás un ejercicio cada vez con peso, reps y descanso.</p>
    </div>

    <div class="divide-y divide-white/10 border-y border-white/10">
      ${routines.map((d, idx) => {
        const list = S.settings.routines[d] ?? [];
        const totalSets = list.reduce((acc, ex) => acc + ex.sets, 0);
        const col = routineColor(d, S.settings, idx);
        const sub = S.settings.routineMeta?.[d]?.sub;
        const lastDate = lastByDay.get(d);
        const isNext = d === suggested;
        return `<button type="button" data-act="liveStart" data-arg="${esc(d)}" class="flex min-h-[68px] w-full items-center justify-between gap-3 py-3.5 px-1 text-left transition-colors active:bg-white/5 ${isNext ? 'bg-electricBlue/[0.06]' : 'hover:bg-white/[0.03]'}">
          <div class="min-w-0 flex-1 space-y-0.5">
            <div class="flex flex-wrap items-center gap-2">
              <span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background-color:${col}" aria-hidden="true"></span>
              <span class="text-base font-extrabold text-white">${esc(d)}</span>
              ${sub ? `<span class="text-xs text-gray-400">· ${esc(sub)}</span>` : ''}
              ${isNext ? `<span class="rounded-full bg-electricBlue px-2 py-0.5 text-[10px] font-bold text-white">Toca hoy</span>` : ''}
            </div>
            <p class="text-xs text-gray-400 tabular-nums">${list.length} ejercicios · ${totalSets} series${lastDate ? ` · Última ${fmtDate(lastDate)}` : ''}</p>
          </div>
          ${icon('play', `h-4 w-4 shrink-0 ${isNext ? 'text-blue-300' : 'text-gray-400'}`)}
        </button>`;
      }).join('')}

      <button type="button" data-act="liveStart" data-arg="Libre" class="flex min-h-[64px] w-full items-center justify-between gap-3 py-3.5 px-1 text-left transition-colors hover:bg-white/[0.03] active:bg-white/5">
        <div class="space-y-0.5">
          <p class="text-sm font-bold text-white">Entreno libre</p>
          <p class="text-xs text-gray-400">Empieza vacío y añade ejercicios sobre la marcha.</p>
        </div>
        ${icon('plus', 'h-5 w-5 shrink-0 text-blue-300')}
      </button>
    </div>

    <div class="pt-1 text-center">
      <button type="button" data-act="tab" data-arg="log" class="inline-flex min-h-[44px] items-center gap-1.5 px-3 text-xs font-semibold text-gray-300 hover:text-white">
        ${icon('edit', 'h-3.5 w-3.5')} ¿Ya terminaste? Registrar un entreno ya hecho
      </button>
    </div>
  </div>`;
}

/** Resume el estado y marca rápida de un ejercicio para el menú hamburguesa de `En vivo`. */
export function liveExQuickInfo(S: State, day: DayName | 'Libre', item: LogExDraft): { infoLine: string; doneInEx: number; allDoneInEx: boolean } {
  const { tgt, hist, doneInEx, allDoneInEx } = exerciseContext(S, day, item);
  const doneToday = item.sets.filter((s) => s.done && s.r > 0);
  const bestToday = doneToday.length
    ? doneToday.reduce((a, b) => (b.w > a.w || (b.w === a.w && b.r > a.r) ? b : a))
    : null;
  const quickInfo = bestToday
    ? `Hoy ${bestToday.w} kg × ${bestToday.r}`
    : hist?.last
      ? `Últ. ${hist.last.top} kg × ${hist.last.repsAtTop}`
      : 'Sin historial';
  return {
    infoLine: `${tgt ? `Obj ${tgt.sets}×${tgt.reps} · ` : ''}${quickInfo}`,
    doneInEx,
    allDoneInEx,
  };
}

function renderExMenu(S: State, live: LiveWorkout, curIdx: number): string {
  const open = Boolean(live.exMenuOpen);
  const doneExCount = live.exercises.filter((e) => e.sets.length > 0 && e.sets.every((s) => s.done && s.r > 0)).length;

  return `<div id="live-ex-menu-wrap" data-open="${open}" aria-hidden="${!open}" class="grid transition-[grid-template-rows,opacity,transform,margin] duration-200 ease-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr] opacity-100 translate-y-0' : 'grid-rows-[0fr] opacity-0 -translate-y-1 pointer-events-none !mt-0'}">
    <div class="overflow-hidden">
      <nav id="live-ex-menu" ${open ? '' : 'inert'} aria-label="Ejercicios del entrenamiento" class="rounded-2xl border border-white/15 bg-floatDark p-2.5 shadow-2xl shadow-black/45 space-y-2">
        <div class="flex items-center justify-between px-1.5 pb-1">
          <span id="liveMenuSummary" class="text-xs font-bold uppercase tracking-wide text-gray-300">Ejercicios (${doneExCount}/${live.exercises.length} listos)</span>
          <button type="button" class="flex min-h-[44px] sm:min-h-[34px] items-center gap-1 rounded-full bg-white/5 px-3.5 text-xs font-semibold text-gray-300 hover:bg-white/10 hover:text-white" data-act="liveToggleMenu">${icon('close', 'h-3.5 w-3.5')} Cerrar</button>
        </div>

        ${live.exercises.length ? `<div class="space-y-1 max-h-[55vh] overflow-y-auto pr-0.5">
          ${live.exercises.map((item, idx) => {
            const active = idx === curIdx;
            const { infoLine, doneInEx, allDoneInEx } = liveExQuickInfo(S, live.day, item);

            return `<button type="button" data-act="liveGoEx" data-arg="${idx}" class="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${active ? 'bg-electricBlue/20 ring-1 ring-electricBlue/40' : 'hover:bg-white/[0.05]'}">
              <div class="flex min-w-0 flex-1 items-center gap-2.5">
                <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${allDoneInEx ? 'bg-emeraldGreen/20 text-emerald-300' : active ? 'bg-electricBlue text-white' : 'bg-white/10 text-gray-300'}">${allDoneInEx ? icon('check', 'h-3.5 w-3.5') : idx + 1}</span>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <span class="truncate text-sm font-bold ${active ? 'text-white' : allDoneInEx ? 'text-emerald-200' : 'text-gray-100'}">${esc(item.name)}</span>
                    ${active ? `<span class="shrink-0 rounded-full bg-electricBlue/25 px-2 py-0.5 text-[10px] font-bold text-blue-200">Actual</span>` : ''}
                  </div>
                  <p data-live-menu-info="${idx}" class="truncate text-xs text-gray-400 tabular-nums">${esc(infoLine)}</p>
                </div>
              </div>
              <span data-live-menu-count="${idx}" class="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-xs font-bold tabular-nums ${allDoneInEx ? 'text-emerald-300' : 'text-gray-400'}">${doneInEx}/${item.sets.length}</span>
            </button>`;
          }).join('')}
        </div>` : `<p class="px-2.5 py-3 text-xs text-gray-400">Todavía no hay ejercicios en esta sesión.</p>`}

        <button type="button" class="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-electricBlue/15 text-xs font-bold text-blue-300 hover:bg-electricBlue/25" data-act="liveOpenPicker" data-arg="add">
          ${icon('plus', 'h-4 w-4')} Añadir ejercicio al entreno
        </button>
      </nav>
    </div>
  </div>`;
}

function renderPickerPanel(S: State, live: LiveWorkout, currentEx?: LogExDraft): string {
  const mode = live.pickerMode;
  if (!mode) return '';
  const { avail, quick } = quickExSuggestions(S, live.day, live.exercises.map((e) => e.name), 8);
  const query = live.pickerQuery ?? '';
  const options = filterSelectionOptions(avail.map((name) => ({ id: name, label: name })), query);
  const title = mode === 'swap' && currentEx ? `Cambiar "${currentEx.name}" por otro` : 'Añadir ejercicio a este entreno';

  return `<section aria-label="${esc(title)}" class="rounded-2xl border border-electricBlue/40 bg-floatDark p-3.5 shadow-xl shadow-black/40 space-y-3">
    <div class="flex items-center justify-between gap-2">
      <h3 class="text-sm font-extrabold text-white">${esc(title)}</h3>
      ${currentEx ? `<button type="button" class="min-h-[44px] sm:min-h-[34px] px-2.5 text-xs font-semibold text-gray-400 hover:text-white" data-act="liveClosePicker">Cancelar</button>` : ''}
    </div>

    ${quick.length ? `<div class="space-y-1.5">
      <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Sugeridos</p>
      <div class="flex flex-wrap gap-1.5">
        ${quick.map((n) => `<button type="button" data-act="livePickEx" data-arg="${esc(n)}" class="btn-sm rounded-full font-medium text-gray-100">${esc(n)}</button>`).join('')}
      </div>
    </div>` : ''}

    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <div class="flex gap-2">
        ${avail.length > 12 ? `<input id="livePickerSearch" class="inp min-h-[44px] flex-1" value="${esc(query)}" placeholder="Buscar ejercicio…" data-live-picker-search aria-label="Buscar ejercicio">` : ''}
        <select id="livePickerSelect" class="inp min-h-[44px] flex-1" aria-label="Elegir ejercicio de la lista">
          <option value="">Todos los ejercicios (${avail.length})…</option>
          ${options.map((option) => `<option value="${esc(option.id)}">${esc(option.label)}</option>`).join('')}
        </select>
        <button type="button" class="btn-primary min-h-[44px] shrink-0" data-act="livePickFromSelect">Elegir</button>
      </div>
      <div class="flex gap-2">
        <input id="livePickerCustom" class="inp min-h-[44px] flex-1" placeholder="O escribe uno nuevo…" aria-label="Nombre de ejercicio personalizado">
        <button type="button" class="btn min-h-[44px] shrink-0" data-act="livePickCustom">Usar</button>
      </div>
    </div>
  </section>`;
}

/**
 * Renderiza la vista simplificada de entrenamiento en vivo para móvil (`Iniciar entreno`).
 * Muestra el selector de rutina o, una vez iniciada, un ejercicio cada vez sin card-itis y con menú hamburguesa.
 */
export function viewWorkout(S: State): string {
  const live = S.liveWorkout;
  if (!live) return renderDayPicker(S);

  const total = live.exercises.length;
  const curIdx = total > 0 ? Math.min(Math.max(0, live.curIdx), total - 1) : 0;
  const ex = live.exercises[curIdx];
  const doneExCount = live.exercises.filter((e) => e.sets.length > 0 && e.sets.every((s) => s.done && s.r > 0)).length;
  const doneSetsCount = live.exercises.reduce((acc, e) => acc + e.sets.filter((s) => s.done && s.r > 0).length, 0);
  const totalSetsCount = live.exercises.reduce((acc, e) => acc + e.sets.length, 0);
  const allDone = total > 0 && doneExCount === total;
  const prevBannerEx = live.lastCompletedExIdx != null ? live.exercises[live.lastCompletedExIdx] : undefined;

  const routines = routineNames(S.settings);
  const rIdx = routines.indexOf(live.day);
  const dayColor = rIdx >= 0 ? routineColor(live.day, S.settings, rIdx) : '#9CA3AF';
  const activeCtx = ex ? exerciseContext(S, live.day, ex) : undefined;

  return `<div class="mx-auto max-w-xl space-y-3">
    <div class="flex items-center justify-between gap-1.5 sm:gap-2 pb-2.5 border-b border-white/10">
      <div class="flex min-w-0 items-center gap-1.5 sm:gap-2">
        <button type="button" data-act="liveToggleMenu" aria-expanded="${Boolean(live.exMenuOpen)}" aria-controls="live-ex-menu" aria-label="Abrir lista de ejercicios" class="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border px-2 sm:px-2.5 text-xs font-bold transition-colors ${live.exMenuOpen ? 'border-electricBlue bg-electricBlue/20 text-white' : 'border-white/15 bg-white/5 text-gray-100 hover:bg-white/10'}">
          ${icon('menu', 'h-4 w-4')}
          <span class="tabular-nums">${total ? `${curIdx + 1}/${total}` : '0'}</span>
        </button>
        <div class="min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="h-2 w-2 shrink-0 rounded-full" style="background-color:${dayColor}" aria-hidden="true"></span>
            <span class="truncate text-sm font-extrabold text-white">${esc(live.day)}</span>
          </div>
          <p class="flex flex-wrap items-center gap-x-1 text-[11px] leading-tight text-gray-400 tabular-nums">
            <span id="liveCountSummary" class="whitespace-nowrap">${doneSetsCount}/${totalSetsCount} series</span>
            <span class="whitespace-nowrap"><span aria-hidden="true">· </span><span id="live-elapsed">${fmtElapsed(live.startedAt)}</span></span>
          </p>
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <button type="button" class="flex h-11 items-center px-1.5 sm:px-2 text-xs font-semibold text-gray-400 hover:text-coralRed" data-act="liveDiscard">Descartar</button>
        <button type="button" class="btn-primary min-h-[44px] px-2.5 sm:px-3 text-xs sm:text-sm" data-act="liveSave">${icon('save', 'h-4 w-4')} <span id="liveFinishLabel">Terminar (${doneSetsCount})</span></button>
      </div>
    </div>

    ${renderExMenu(S, live, curIdx)}

    ${prevBannerEx ? `<div class="flex flex-wrap items-center justify-between gap-2 border-l-4 border-emeraldGreen bg-emeraldGreen/10 px-3 py-2 rounded-r-xl text-xs">
      <span class="font-semibold text-emerald-200">${esc(prevBannerEx.name)} completado · siguiente</span>
      <div class="flex flex-wrap items-center gap-1.5">
        <button type="button" class="min-h-[44px] sm:min-h-[36px] rounded-lg px-2.5 text-xs font-semibold text-gray-200 hover:bg-white/10" data-act="liveGoEx" data-arg="${live.lastCompletedExIdx}">Volver</button>
        <button type="button" class="min-h-[44px] sm:min-h-[36px] rounded-lg border border-emeraldGreen/40 px-2.5 text-xs font-bold text-emerald-200" data-act="liveAddExtraSetPrev">+ Serie extra en ${esc(prevBannerEx.name)}</button>
        <button type="button" class="flex h-11 w-11 sm:h-9 sm:w-9 items-center justify-center rounded-lg text-gray-300 hover:bg-white/10" data-act="liveClearBanner" aria-label="Cerrar aviso">${icon('close', 'h-4 w-4')}</button>
      </div>
    </div>` : ''}

    ${allDone ? `<div class="border-l-4 border-emeraldGreen bg-emeraldGreen/10 px-3 py-3 rounded-r-xl space-y-2.5">
      <div>
        <h3 class="text-sm font-extrabold text-emerald-200">¡Todos los ejercicios completados!</h3>
        <p class="text-xs text-gray-300 tabular-nums">${doneExCount} ejercicios · ${doneSetsCount} series · ${fmtElapsed(live.startedAt)}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn-primary min-h-[44px] flex-1 sm:flex-initial" data-act="liveSave">${icon('save', 'h-4 w-4')} Guardar entrenamiento</button>
        <button type="button" class="btn min-h-[44px]" data-act="liveOpenPicker" data-arg="add">+ Añadir ejercicio</button>
      </div>
    </div>` : ''}

    ${renderRestTimerBar(live)}

    ${renderPickerPanel(S, live, ex)}

    ${!ex && !live.pickerMode ? `<div class="rounded-2xl border border-white/10 bg-cardDark p-5 text-center space-y-3">
      <p class="text-sm text-gray-300">Esta rutina todavía no tiene ejercicios añadidos.</p>
      <button type="button" class="btn-primary min-h-[44px]" data-act="liveOpenPicker" data-arg="add">+ Añadir primer ejercicio al entreno</button>
    </div>` : ''}

    ${ex && activeCtx ? `<section aria-label="Ejercicio actual: ${esc(ex.name)}" class="space-y-3 pt-1">
      <div class="space-y-1.5">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <h2 class="text-xl font-extrabold text-white leading-tight">${esc(ex.name)}</h2>
            <p class="mt-0.5 text-xs text-gray-300 tabular-nums">
              ${activeCtx.tgt ? `<span class="text-gray-400">Objetivo ${activeCtx.tgt.sets}×${activeCtx.tgt.reps}</span> · ` : ''}${esc(activeCtx.lastRef)}
            </p>
          </div>
          <span data-live-ex-counter="${curIdx}" class="shrink-0 pt-1 text-xs font-bold tabular-nums ${activeCtx.allDoneInEx ? 'text-emerald-300' : 'text-gray-400'}">${activeCtx.doneInEx}/${ex.sets.length} series</span>
        </div>

        ${activeCtx.prescription || activeCtx.fixedNote || (!activeCtx.hist && ex.sets.every((s) => s.w === 0)) ? `<div class="space-y-1 border-l-2 border-emeraldGreen/70 pl-2.5 text-xs">
          ${activeCtx.prescription ? `<div class="flex flex-wrap items-center justify-between gap-2 text-gray-200"><span>${esc(activeCtx.prescription)}</span>${activeCtx.showApplyBtn ? `<button type="button" class="inline-flex min-h-[44px] sm:min-h-[34px] items-center px-2 font-bold text-emerald-300 hover:underline" data-act="liveApplyWeight" data-arg="${curIdx}|${activeCtx.targetW}">Aplicar ${activeCtx.targetW} kg</button>` : ''}</div>` : `<p class="text-gray-300">Primera vez: empieza con un peso cómodo donde controles bien todas las repeticiones.</p>`}
          ${activeCtx.fixedNote ? `<p class="text-gray-300"><span class="font-semibold text-white">Nota fija:</span> ${esc(activeCtx.fixedNote)}</p>` : ''}
        </div>` : ''}

        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-xs font-semibold text-gray-300">
          <button type="button" class="inline-flex min-h-[44px] sm:min-h-[36px] items-center gap-1 hover:text-white" data-act="liveOpenPicker" data-arg="swap">${icon('refresh', 'h-3.5 w-3.5 text-blue-300')} Cambiar ejercicio</button>
          <button type="button" class="inline-flex min-h-[44px] sm:min-h-[36px] items-center gap-1 hover:text-white" data-act="liveOpenPicker" data-arg="add">${icon('plus', 'h-3.5 w-3.5 text-blue-300')} Añadir ejercicio</button>
          <button type="button" class="inline-flex min-h-[44px] sm:min-h-[36px] items-center gap-1 hover:text-white" data-act="editNote" data-arg="${esc(ex.name)}">${icon('edit', 'h-3.5 w-3.5 text-gray-400')} Nota permanente</button>
        </div>
      </div>

      <div class="divide-y divide-white/10 border-y border-white/10">
        ${ex.sets.map((s, si) => `<div data-live-set="${curIdx}|${si}" class="py-3 space-y-2 transition-colors ${s.done ? 'bg-emeraldGreen/10 -mx-2 px-2 rounded-lg' : ''}">
          <div class="flex items-center justify-between gap-2 text-xs">
            <span data-live-set-lbl="${curIdx}|${si}" class="font-bold tabular-nums ${s.done ? 'text-emerald-300' : 'text-gray-300'}">Serie ${si + 1}${s.done ? ' · Hecha' : ''}</span>
            <label class="inline-flex min-h-[44px] sm:min-h-0 items-center gap-1.5 text-gray-400">
              <span title="Repeticiones en reserva">RIR</span>
              <input class="w-12 min-h-[44px] sm:min-h-0 rounded-lg border border-white/15 bg-transparent py-1.5 sm:py-1 text-center text-base sm:text-xs font-semibold tabular-nums text-white focus:border-electricBlue focus:outline-none" type="number" step="1" min="0" max="10" inputmode="numeric" value="${s.rir ?? ''}" placeholder="—" data-live-rir="${curIdx}|${si}" aria-label="RIR de serie ${si + 1}">
            </label>
            <label class="inline-flex min-h-[44px] sm:min-h-0 items-center gap-1.5 text-gray-400">
              <span title="Descanso real en esta serie (se rellena solo al usar el reloj)">Desc. real</span>
              <input class="w-16 min-h-[44px] sm:min-h-0 rounded-lg border border-white/15 bg-transparent py-1.5 sm:py-1 text-center text-base sm:text-xs font-semibold tabular-nums text-white focus:border-electricBlue focus:outline-none" type="number" step="5" min="0" max="1800" inputmode="numeric" value="${s.restSec ?? ''}" placeholder="${live.targetRestSec}" data-live-rest="${curIdx}|${si}" aria-label="Descanso en segundos serie ${si + 1}">
              <span>s</span>
            </label>
          </div>
          <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
            ${renderStepper({
              label: 'Peso (kg)',
              wrapCls: 'min-w-0',
              value: s.w,
              step: '0.5',
              inputMode: 'decimal',
              dataAttr: `data-live-w="${curIdx}|${si}"`,
              inputAria: `Peso kg serie ${si + 1}`,
              stepAct: 'liveStepW',
              stepArgPrefix: `${curIdx}|${si}`,
              delta: 2.5,
              decAria: `Restar 2,5 kg serie ${si + 1}`,
              incAria: `Sumar 2,5 kg serie ${si + 1}`,
              btnCls: 'flex h-11 w-11 shrink-0 items-center justify-center border border-white/15 bg-white/5 text-base font-bold text-gray-200 hover:border-electricBlue active:scale-95',
              inpCls: 'inp-stepper border-white/15 bg-transparent text-base',
            })}
            ${renderStepper({
              label: 'Reps',
              wrapCls: 'min-w-0',
              value: s.r,
              step: '1',
              inputMode: 'numeric',
              dataAttr: `data-live-r="${curIdx}|${si}"`,
              inputAria: `Repeticiones serie ${si + 1}`,
              stepAct: 'liveStepR',
              stepArgPrefix: `${curIdx}|${si}`,
              delta: 1,
              decAria: `Restar 1 repetición serie ${si + 1}`,
              incAria: `Sumar 1 repetición serie ${si + 1}`,
              btnCls: 'flex h-11 w-11 shrink-0 items-center justify-center border border-white/15 bg-white/5 text-base font-bold text-gray-200 hover:border-electricBlue active:scale-95',
              inpCls: 'inp-stepper border-white/15 bg-transparent text-base',
            })}
            <button type="button" data-act="liveToggleSet" data-arg="${curIdx}|${si}" aria-pressed="${Boolean(s.done)}" aria-label="${s.done ? 'Desmarcar' : 'Marcar'} serie ${si + 1}" class="flex h-11 w-11 sm:w-20 items-center justify-center gap-1 rounded-xl border text-xs font-bold transition-colors active:scale-95 ${s.done ? 'border-emeraldGreen bg-emeraldGreen text-gray-950' : 'border-white/15 bg-white/5 text-gray-200 hover:border-emeraldGreen/60'}" style="touch-action:manipulation">${icon('check', 'h-4 w-4')}<span class="hidden sm:inline">${s.done ? 'Hecha' : 'Listo'}</span></button>
          </div>
        </div>`).join('')}
      </div>

      <div class="space-y-2.5 pt-1">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-3">
            <button type="button" class="inline-flex min-h-[44px] items-center gap-1 text-xs sm:text-sm font-bold text-blue-300 hover:text-white" data-act="liveAddSet" data-arg="${curIdx}">+ Añadir serie</button>
            ${ex.sets.length > 1 ? `<button type="button" class="inline-flex min-h-[44px] items-center text-xs font-semibold text-rose-300 hover:text-rose-200" data-act="liveDelSet" data-arg="${curIdx}|${ex.sets.length - 1}">− Quitar serie</button>` : ''}
          </div>
        </div>
        <input class="w-full border-b border-white/15 bg-transparent py-2 text-base sm:text-sm text-gray-200 placeholder-gray-400 focus:border-electricBlue focus:outline-none" value="${esc(ex.note)}" data-live-note="${curIdx}" placeholder="Nota de hoy (sensaciones, ajustes)…" aria-label="Nota para ${esc(ex.name)}">
      </div>
    </section>` : ''}

    ${total > 1 ? `<div class="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
      <button type="button" class="flex min-h-[44px] items-center justify-center text-xs sm:text-sm font-semibold text-gray-300 hover:text-white disabled:opacity-30" data-act="livePrevEx" ${curIdx === 0 ? 'disabled' : ''}>← Anterior</button>
      <button type="button" class="flex min-h-[44px] items-center justify-center text-xs sm:text-sm font-semibold text-gray-300 hover:text-white disabled:opacity-30" data-act="liveNextEx" ${curIdx >= total - 1 ? 'disabled' : ''}>Siguiente →</button>
    </div>` : ''}
  </div>`;
}
