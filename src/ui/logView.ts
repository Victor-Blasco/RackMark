import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { StepperInput } from '../components/common/StepperInput';
import { RestTimerBar } from '../components/workout/RestTimerBar';
import { fmtMMSS } from '../hooks/useRestTimer';
import { resolveName } from '../lib/analysis';
import { norm } from '../lib/seed';
import {
  allExerciseNames,
  defaultSetsForEx,
  exerciseContext,
  extractTargetWeight,
  manualSessionId,
  quickExSuggestions,
} from '../store/exerciseCatalog';
import type { DayName, LogDraft, LogExDraft, LogExMeta, SetRec } from '../types';
import { icon } from './icons';
import { filterSelectionOptions } from './selection';
import { empty, esc, fmtDate, routineColor, routineNames, todayIso, type State } from './shared';

export {
  allExerciseNames,
  defaultSetsForEx,
  exerciseContext,
  extractTargetWeight,
  manualSessionId,
  quickExSuggestions,
};

/**
 * Construye un borrador de sesión para una rutina y fecha dadas, combinando datos guardados en esa sesión.
 * Las series aún no guardadas nacen con `done: false` para evitar sesiones fantasma.
 *
 * @param S - Estado global de la aplicación.
 * @param day - Rutina seleccionada (`Push`, `Pull`, `Leg`, personalizada o `Libre`).
 * @param date - Fecha en formato ISO (`YYYY-MM-DD`).
 * @param sessionId - ID de sesión concreto al cargar/editar desde el historial.
 * @returns Borrador listo para editar en la vista `Registrar entreno`.
 */
export function initLogDraft(
  S: State,
  day: DayName | 'Libre',
  date: string,
  sessionId?: string,
): LogDraft {
  const targetSid = manualSessionId(date, day);
  const legacySid = `manual-${date}`;
  const inferredDayBySid = new Map(S.analysis.sessions.map((s) => [s.id, s.day ?? 'Libre']));
  const onDate = sessionId
    ? S.strength.filter((r) => r.sessionId === sessionId)
    : S.strength.filter((r) => {
        if (r.date !== date) return false;
        if (r.sessionId === targetSid) return true;
        const rowDay = r.day ?? inferredDayBySid.get(r.sessionId) ?? 'Libre';
        return rowDay === day && (r.sessionId === legacySid || !r.id.startsWith('manual-'));
      });

  const savedByNorm = new Map<string, { name: string; sets: SetRec[]; notes: string[]; meta?: LogExMeta }>();
  for (const r of onDate) {
    const name = resolveName(r.ref, S.settings);
    const k = norm(name);
    const cur = savedByNorm.get(k) ?? {
      name,
      sets: [],
      notes: [],
      meta: {
        id: r.id,
        ts: r.ts,
        ...(r.durMin != null ? { durMin: r.durMin } : {}),
        ...(r.avgHr != null ? { avgHr: r.avgHr } : {}),
        ...(r.maxHr != null ? { maxHr: r.maxHr } : {}),
        ...(r.minHr != null ? { minHr: r.minHr } : {}),
        ...(r.kcal != null ? { kcal: r.kcal } : {}),
      },
    };
    cur.sets.push(...r.sets.map((s) => ({
      w: s.w,
      r: s.r,
      done: s.r > 0,
      ...(s.restSec != null ? { restSec: s.restSec } : {}),
    })));
    if (r.note?.trim()) cur.notes.push(r.note.trim());
    savedByNorm.set(k, cur);
  }

  const exercises: LogExDraft[] = [];
  const used = new Set<string>();

  if (day !== 'Libre') {
    for (const r of S.settings.routines[day] ?? []) {
      const k = norm(r.name);
      used.add(k);
      const saved = savedByNorm.get(k);
      if (saved) {
        exercises.push({ name: r.name, done: true, sets: saved.sets, note: [...new Set(saved.notes)].join(' · '), ...(saved.meta ? { meta: saved.meta } : {}) });
      } else {
        exercises.push({
          name: r.name,
          done: false,
          sets: defaultSetsForEx(S, r.name, r.sets, r.reps, false),
          note: '',
        });
      }
    }
  }
  for (const [k, saved] of savedByNorm) {
    if (used.has(k)) continue;
    used.add(k);
    exercises.push({ name: saved.name, done: true, sets: saved.sets, note: [...new Set(saved.notes)].join(' · '), ...(saved.meta ? { meta: saved.meta } : {}) });
  }

  return {
    date,
    day,
    exercises,
    sessionId: sessionId ?? (onDate[0]?.sessionId || targetSid),
    dirty: false,
  };
}

export { fmtMMSS };

/** Renderiza la barra ligera de cronómetro de descanso delegando en `<RestTimerBar />`. */
export function renderRestTimerBar(timer: { targetRestSec?: number; restUntil?: number }): string {
  return renderToString(
    h(RestTimerBar, {
      restUntil: timer.restUntil,
      targetRestSec: timer.targetRestSec,
    }),
  );
}

export interface StepperOpts {
  label: string;
  labelCls?: string;
  wrapCls?: string;
  value: number;
  step: string;
  inputMode: 'decimal' | 'numeric';
  dataAttr: string;
  inputAria: string;
  stepAct: string;
  stepArgPrefix: string;
  delta: number;
  decAria: string;
  incAria: string;
  btnCls?: string;
  inpCls?: string;
}

/** Renderiza un control numérico táctil delegando en `<StepperInput />`. */
export function renderStepper(o: StepperOpts): string {
  const match = o.dataAttr.match(/^([a-z0-9-]+)="([^"]*)"$/i);
  const inputData = match ? { [match[1]]: match[2] } : undefined;
  return renderToString(
    h(StepperInput, {
      label: o.label,
      labelClass: o.labelCls,
      wrapClass: o.wrapCls,
      value: o.value,
      step: o.step,
      inputMode: o.inputMode,
      inputData,
      inputAria: o.inputAria,
      stepAct: o.stepAct,
      stepArgPrefix: o.stepArgPrefix,
      delta: o.delta,
      decAria: o.decAria,
      incAria: o.incAria,
      btnClass: o.btnCls,
      inputClass: o.inpCls,
    }),
  );
}

/**
 * Renderiza la vista de registro manual para añadir o editar un entrenamiento ya hecho (`Registrar entreno`).
 *
 * @param S - Estado global de la aplicación.
 * @returns HTML completo de la pestaña `log`.
 */
export function viewLog(S: State): string {
  const today = todayIso();
  const routines = routineNames(S.settings);
  const draft = S.logDraft ?? (S.logDraft = initLogDraft(S, routines[0] ?? 'Libre', today));
  const { avail, quick } = quickExSuggestions(S, draft.day, draft.exercises.map((e) => e.name));
  const filteredAvail = avail.length > 12
    ? filterSelectionOptions(avail.map((n) => ({ id: n, label: n })), S.logAddQuery ?? '')
    : avail.map((n) => ({ id: n, label: n }));

  const doneExCount = draft.exercises.filter((e) => e.sets.some((s) => s.done && s.r > 0)).length;
  const doneSetsCount = draft.exercises.reduce((acc, e) => acc + e.sets.filter((s) => s.done && s.r > 0).length, 0);
  const totalSetsCount = draft.exercises.reduce((acc, e) => acc + e.sets.length, 0);
  const recentSessions = [...S.analysis.sessions].reverse().slice(0, 10);

  return `
  <div class="space-y-3 pb-4 border-b border-white/10">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 class="text-lg font-extrabold text-white">Registrar entreno ya hecho</h2>
        <p class="text-xs text-gray-400">Añade o edita una sesión completada con sus cargas, reps y tiempo de descanso exacto.</p>
        <p id="logCountSummary" class="mt-0.5 text-xs sm:text-sm text-gray-300 tabular-nums">${doneExCount}/${draft.exercises.length} ejercicios · ${doneSetsCount}/${totalSetsCount} series marcadas ✓</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn btn-accent min-h-[44px] text-xs sm:text-sm" data-act="tab" data-arg="workout">${icon('play', 'h-3.5 w-3.5')} Iniciar entreno en vivo</button>
        <a href="#log-add-section" class="btn min-h-[44px] py-1.5 text-xs sm:text-sm">+ Añadir ejercicio</a>
        <button class="btn min-h-[44px] py-1.5 text-xs sm:text-sm" data-act="logReset">${icon('reset', 'h-3.5 w-3.5')} Reiniciar</button>
        <button class="btn-primary min-h-[44px] py-1.5" data-act="logSave">${icon('save', 'h-4 w-4')} Guardar (${doneSetsCount})</button>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <label class="flex items-center gap-2 text-xs text-gray-400">
        <span>Fecha</span>
        <input class="inp w-auto min-h-[44px] tabular-nums" type="date" value="${esc(draft.date)}" data-change="logDate" aria-label="Fecha de la sesión">
      </label>
      <div class="flex flex-wrap gap-1.5" role="group" aria-label="Rutina de la sesión">
        ${[...routines, 'Libre'].map((d, idx) => {
          const on = draft.day === d;
          const col = d === 'Libre' ? '#9CA3AF' : routineColor(d, S.settings, idx);
          return `<button data-act="logDay" data-arg="${esc(d)}" aria-pressed="${on}" class="tab min-h-[44px] ${on ? 'tab-on' : ''}" style="${on && d !== 'Libre' ? `border-color:${col};color:${col}` : ''}">${esc(d)}</button>`;
        }).join('')}
      </div>
    </div>
  </div>

  ${draft.exercises.length ? `<div data-sort-list="log" class="grid grid-cols-1 gap-3 xl:grid-cols-2 items-start">
    ${draft.exercises.map((ex, ei) => {
      const { tgt, lastRef, prescription, targetW, fixedNote, doneInEx, allDoneInEx, showApplyBtn } = exerciseContext(S, draft.day, ex);
      const total = draft.exercises.length;
      return `
      <div data-sort-item data-sort-idx="${ei}" data-ex-idx="${ei}" class="border-t pt-4 sm:rounded-2xl sm:border sm:bg-cardDark sm:p-4 space-y-3 transition-colors ${allDoneInEx ? 'border-emeraldGreen/50' : doneInEx > 0 ? 'border-electricBlue/50' : 'border-white/10'}">
        <div class="flex flex-wrap sm:flex-nowrap items-start justify-between gap-2">
          <div class="flex flex-1 min-w-[190px] items-start gap-2">
            <button type="button" data-sort-handle class="flex h-11 w-11 shrink-0 touch-none cursor-grab active:cursor-grabbing select-none items-center justify-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" aria-label="Arrastrar para reordenar ${esc(ex.name)}" title="Arrastrar para reordenar">${icon('grip', 'h-4 w-4')}</button>
            <button type="button" data-act="logToggleEx" data-arg="${ei}" aria-pressed="${allDoneInEx}" class="flex flex-1 min-w-0 min-h-[44px] items-start gap-2.5 text-left rounded-lg py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue">
              <span class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${allDoneInEx ? 'border-emeraldGreen bg-emeraldGreen/20 text-emeraldGreen' : doneInEx > 0 ? 'border-electricBlue bg-electricBlue/20 text-blue-300' : 'border-gray-600 text-transparent'}">${icon('check', 'h-4 w-4')}</span>
              <div class="min-w-0">
                <div class="font-bold text-white leading-snug">${esc(ex.name)} ${tgt ? `<span class="ml-1 tabular-nums text-[13px] font-normal text-gray-400">(${tgt.sets}×${tgt.reps})</span>` : ''} <span data-ex-counter="${ei}" class="ml-1 tabular-nums text-xs font-semibold ${allDoneInEx ? 'text-emerald-300' : 'text-gray-400'}">${doneInEx}/${ex.sets.length}</span></div>
                <div class="tabular-nums text-xs sm:text-[13px] text-gray-300">${esc(lastRef)}</div>
              </div>
            </button>
          </div>
          <div class="ml-auto flex shrink-0 items-center gap-0.5">
            <button type="button" class="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-25 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" data-act="logMoveEx" data-arg="${ei}|-1" ${ei === 0 ? 'disabled' : ''} aria-label="Subir ${esc(ex.name)}" title="Subir">${icon('caretUp', 'h-3.5 w-3.5')}</button>
            <button type="button" class="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-25 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" data-act="logMoveEx" data-arg="${ei}|1" ${ei === total - 1 ? 'disabled' : ''} aria-label="Bajar ${esc(ex.name)}" title="Bajar">${icon('caretDown', 'h-3.5 w-3.5')}</button>
            <button type="button" class="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:text-coralRed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" data-act="logRemoveEx" data-arg="${ei}" aria-label="Quitar ${esc(ex.name)} de la sesión">${icon('close', 'h-4 w-4')}</button>
          </div>
        </div>

        ${prescription || fixedNote ? `
        <div class="space-y-1 border-l-2 border-emeraldGreen/70 pl-2.5 text-xs">
          ${prescription ? `<div class="flex flex-wrap items-center justify-between gap-2 text-gray-200"><span>${esc(prescription)}</span>${showApplyBtn ? `<button type="button" class="btn min-h-[44px] px-3 py-1.5 text-xs text-emerald-300 border-emeraldGreen/40 hover:border-emeraldGreen" data-act="logApplyWeight" data-arg="${ei}|${targetW}">Aplicar ${targetW} kg</button>` : ''}</div>` : ''}
          ${fixedNote ? `<p class="text-gray-300"><span class="font-semibold text-white">Fija:</span> ${esc(fixedNote)}</p>` : ''}
        </div>` : ''}

        <div class="divide-y divide-white/10">
          <div class="hidden sm:flex items-center gap-1.5 px-1.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            <span class="w-5 shrink-0"></span>
            <span class="flex-1 text-center">Peso (kg · ±2,5)</span>
            <span class="flex-1 text-center">Reps (±1)</span>
            <span class="w-20 shrink-0 text-center">Desc (s)</span>
            <span class="w-11 shrink-0 text-center">OK</span>
          </div>
          ${ex.sets.map((s, si) => `
          <div data-set-row="${ei}|${si}" class="flex flex-wrap sm:flex-nowrap items-center gap-1.5 rounded-xl p-1.5 transition-colors ${s.done ? 'bg-emeraldGreen/10' : ''}">
            <span class="w-5 shrink-0 text-center tabular-nums text-xs font-bold ${s.done ? 'text-emerald-300' : 'text-gray-400'}">S${si + 1}</span>
            ${renderStepper({
              label: 'Peso (kg)',
              labelCls: 'mb-0.5 block sm:hidden text-[11px] font-semibold uppercase tracking-wide text-gray-400',
              value: s.w,
              step: '0.5',
              inputMode: 'decimal',
              dataAttr: `data-log-w="${ei}|${si}"`,
              inputAria: `Peso en kg serie ${si + 1} de ${ex.name}`,
              stepAct: 'logStepW',
              stepArgPrefix: `${ei}|${si}`,
              delta: 2.5,
              decAria: `Restar 2,5 kg a serie ${si + 1} de ${ex.name}`,
              incAria: `Sumar 2,5 kg a serie ${si + 1} de ${ex.name}`,
              btnCls: 'flex h-11 w-11 shrink-0 items-center justify-center border border-gray-700 bg-gray-900 text-base font-bold text-gray-200 hover:border-electricBlue active:scale-95',
            })}
            ${renderStepper({
              label: 'Reps',
              labelCls: 'mb-0.5 block sm:hidden text-[11px] font-semibold uppercase tracking-wide text-gray-400',
              value: s.r,
              step: '1',
              inputMode: 'numeric',
              dataAttr: `data-log-r="${ei}|${si}"`,
              inputAria: `Repeticiones serie ${si + 1} de ${ex.name}`,
              stepAct: 'logStepR',
              stepArgPrefix: `${ei}|${si}`,
              delta: 1,
              decAria: `Restar 1 repetición a serie ${si + 1} de ${ex.name}`,
              incAria: `Sumar 1 repetición a serie ${si + 1} de ${ex.name}`,
              btnCls: 'flex h-11 w-11 shrink-0 items-center justify-center border border-gray-700 bg-gray-900 text-base font-bold text-gray-200 hover:border-electricBlue active:scale-95',
            })}
            <div class="shrink-0">
              <span class="mb-0.5 block sm:hidden text-[11px] font-semibold uppercase tracking-wide text-gray-400">Desc (s)</span>
              <input class="inp h-11 w-20 px-2 py-0 text-center text-base sm:text-xs font-semibold tabular-nums" type="number" step="5" min="0" max="1800" inputmode="numeric" value="${s.restSec ?? ''}" placeholder="Desc (s)" data-log-rest="${ei}|${si}" aria-label="Descanso en segundos serie ${si + 1} de ${esc(ex.name)}">
            </div>
            <div class="shrink-0">
              <span class="mb-0.5 block sm:hidden text-[11px] font-semibold uppercase tracking-wide text-gray-400">RIR</span>
              <input class="inp h-11 w-14 px-2 py-0 text-center text-base sm:text-xs font-semibold tabular-nums" type="number" step="1" min="0" max="10" inputmode="numeric" value="${s.rir ?? ''}" placeholder="RIR" data-log-rir="${ei}|${si}" aria-label="RIR de serie ${si + 1} de ${esc(ex.name)}">
            </div>
            <button type="button" data-act="logToggleSet" data-arg="${ei}|${si}" aria-pressed="${Boolean(s.done)}" aria-label="${s.done ? 'Desmarcar' : 'Completar'} serie ${si + 1} de ${esc(ex.name)}" class="ml-auto sm:ml-0 self-end flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors active:scale-95 ${s.done ? 'border-emeraldGreen bg-emeraldGreen text-gray-950' : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-emeraldGreen/60 hover:text-white'}" style="touch-action:manipulation">${icon('check', 'h-5 w-5')}</button>
          </div>`).join('')}
        </div>

        <div class="flex flex-wrap items-center gap-2 pt-1">
          <button type="button" class="btn min-h-[44px] px-3 text-xs sm:text-sm" data-act="logAddSet" data-arg="${ei}">+ Serie</button>
          ${ex.sets.length > 1 ? `<button type="button" class="btn min-h-[44px] px-3 text-xs sm:text-sm text-coralRed" data-act="logDelSet" data-arg="${ei}|${ex.sets.length - 1}" aria-label="Quitar última serie de ${esc(ex.name)}">− Serie</button>` : ''}
          <input class="inp min-h-[44px] min-w-[160px] flex-1 py-1.5" value="${esc(ex.note)}" data-log-note="${ei}" placeholder="Nota (RIR, sensaciones…)" aria-label="Nota de sesión para ${esc(ex.name)}">
          <button type="button" class="btn min-h-[44px] px-2.5 text-xs" data-act="editNote" data-arg="${esc(ex.name)}" aria-label="Editar nota biomecánica fija de ${esc(ex.name)}">${icon('edit', 'h-3.5 w-3.5')} Fija</button>
        </div>
      </div>`;
    }).join('')}
  </div>` : empty('No hay ejercicios en el borrador. Elige una rutina arriba o añade ejercicios abajo.')}

  <div class="flex flex-wrap items-center justify-between gap-2">
    <button class="btn min-h-[44px]" data-act="logReset">${icon('reset', 'h-4 w-4')} Reiniciar borrador</button>
    <button class="btn-primary min-h-[44px] px-5 py-2.5" data-act="logSave">${icon('save', 'h-4 w-4')} Guardar sesión (${doneSetsCount} series)</button>
  </div>

  <section id="log-add-section" class="space-y-2.5 pt-4 border-t border-white/10">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="text-sm font-bold text-white">Añadir ejercicio a la sesión</h3>
      <button class="btn btn-accent min-h-[44px] py-1.5 text-xs sm:text-sm" data-act="openExModalLog">+ Crear ejercicio nuevo</button>
    </div>
    <div class="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
      <div class="flex flex-wrap gap-2">
        ${avail.length > 12 ? `<input class="inp min-h-[44px] min-w-[180px] flex-1" type="search" value="${esc(S.logAddQuery ?? '')}" placeholder="Buscar ejercicio…" aria-label="Buscar ejercicio para añadir" data-input="logAddSearch">` : ''}
        <select id="logAddSelect" class="inp min-h-[44px] min-w-[200px] flex-1" aria-label="Seleccionar ejercicio para añadir">
          <option value="">Selecciona cualquier ejercicio (${avail.length})…</option>
          ${filteredAvail.map((option) => `<option value="${esc(option.id)}">${esc(option.label)}</option>`).join('')}
        </select>
        <button class="btn min-h-[44px]" data-act="logAddEx">+ Añadir de la lista</button>
      </div>
      ${avail.length > 12 && !filteredAvail.length ? '<p class="text-xs text-gray-400">Sin ejercicios que coincidan con la búsqueda.</p>' : ''}
      <div class="flex flex-wrap gap-2">
        <input id="logNewExName" class="inp min-h-[44px] min-w-[180px] flex-1" placeholder="Añadir rápido por nombre…" aria-label="Nombre de ejercicio nuevo">
        <button class="btn min-h-[44px]" data-act="logAddCustomEx">+ Añadir rápido</button>
      </div>
    </div>
    ${quick.length ? `
    <div class="flex flex-wrap items-center gap-1.5 pt-1">
      <span class="text-xs text-gray-400">Sugeridos:</span>
      ${quick.map((n) => `<button data-act="logAddQuick" data-arg="${esc(n)}" class="btn min-h-[44px] rounded-full px-3.5 py-1.5 text-xs font-normal text-gray-200">+ ${esc(n)}</button>`).join('')}
    </div>` : ''}
  </section>

  ${recentSessions.length ? `
  <div class="pt-5 border-t border-white/10 space-y-2">
    <h3 class="font-bold text-white">Últimas sesiones registradas</h3>
    <div class="grid grid-cols-1 gap-x-6 xl:grid-cols-2 divide-y divide-white/10 xl:divide-y-0">
      ${recentSessions.map((s) => `
        <div class="flex items-center justify-between gap-3 py-2.5 xl:border-t xl:border-white/10 text-sm">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-baseline gap-x-1.5">
              <span class="tabular-nums font-semibold text-white">${fmtDate(s.date)}</span>
              <span class="font-bold" style="color:${s.day ? routineColor(s.day, S.settings, Math.max(0, routines.indexOf(s.day))) : '#9CA3AF'}">${esc(s.day ?? 'Otro')}</span>
              <span class="text-xs text-gray-400 tabular-nums">· ${s.exercises.length} ej. · ${s.sets} series</span>
            </div>
            <div class="text-xs text-gray-400 truncate" title="${esc(s.exercises.join(', '))}">${esc(s.exercises.join(', '))}</div>
          </div>
          <div class="flex shrink-0 items-center gap-1.5">
            <button class="btn min-h-[44px] px-3 py-2 text-xs" data-act="logEditSession" data-arg="${esc(s.id)}|${esc(s.date)}|${esc(s.day ?? 'Libre')}">${icon('edit', 'h-3.5 w-3.5')} <span class="hidden sm:inline">Cargar / Editar</span><span class="sm:hidden">Editar</span></button>
            <button class="btn btn-danger min-h-[44px] min-w-[44px] px-2.5 py-2 text-xs" data-act="logDelSession" data-arg="${esc(s.id)}|${esc(s.date)}" aria-label="Borrar sesión del ${fmtDate(s.date)}" title="Borrar sesión">${icon('trash', 'h-3.5 w-3.5')}</button>
          </div>
        </div>`).join('')}
    </div>
  </div>` : ''}`;
}
