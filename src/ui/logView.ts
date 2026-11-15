import { musclesOf, resolveName } from '../lib/analysis';
import { CATALOG_EXERCISES, MUSCLE_DAY, norm } from '../lib/seed';
import type { DayName, LogDraft, LogExDraft, SetRec } from '../types';
import { icon } from './icons';
import { empty, esc, fmtDate, isAiFreshForEx, routineColor, routineNames, short, type State } from './shared';

/**
 * Devuelve la lista ordenada y deduplicada de todos los nombres de ejercicios conocidos.
 *
 * @param S - Estado global de la aplicación.
 * @returns Lista alfabética de ejercicios disponibles.
 */
export function allExerciseNames(S: State): string[] {
  const byNorm = new Map<string, string>();
  const add = (n: string) => {
    const t = n.trim();
    if (!t || t.startsWith('Samsung #')) return;
    const k = norm(t);
    if (!byNorm.has(k)) byNorm.set(k, t);
  };
  routineNames(S.settings).forEach((d) => (S.settings.routines[d] ?? []).forEach((r) => add(r.name)));
  CATALOG_EXERCISES.forEach(add);
  Object.values(S.settings.customNames).forEach(add);
  Object.values(S.settings.refNames).forEach(add);
  [...S.analysis.exercises.keys()].forEach(add);
  return [...byNorm.values()].sort((a, b) => a.localeCompare(b, 'es'));
}

/**
 * Genera el identificador estable de sesión manual por fecha y rutina,
 * permitiendo registrar varias sesiones distintas en un mismo día.
 */
export function manualSessionId(date: string, day: DayName | 'Libre'): string {
  const slug = norm(day || 'libre').replace(/\s+/g, '-') || 'libre';
  return `manual-${date}-${slug}`;
}

/**
 * Precarga las series de un ejercicio usando la última sesión registrada o valores por defecto.
 *
 * @param S - Estado global de la aplicación.
 * @param name - Nombre del ejercicio.
 * @param fallbackSets - Número de series si no hay historial.
 * @param fallbackReps - Repeticiones iniciales si no hay historial.
 * @param done - Estado inicial de completado de las series (`false` en sesiones nuevas).
 * @returns Array de series `{ w, r, done }`.
 */
export function defaultSetsForEx(
  S: State,
  name: string,
  fallbackSets = 2,
  fallbackReps = 10,
  done = false,
): SetRec[] {
  const k = norm(name);
  const ex = [...S.analysis.exercises.values()].find((e) => norm(e.name) === k);
  if (ex?.last?.sets.length) return ex.last.sets.map((s) => ({ w: s.w, r: s.r, done }));
  return Array.from({ length: fallbackSets }, () => ({ w: 0, r: fallbackReps, done }));
}

function extractTargetWeight(text: string): number | null {
  const actMatch = text.match(/(?:^|[.\s])(?:sube a|baja a|mant[eé]n|usa|objetivo:?)\s+(\d+(?:[.,]\d+)?)\s*kg/i);
  const raw = actMatch?.[1] ?? text.match(/(\d+(?:[.,]\d+)?)\s*kg/i)?.[1];
  if (!raw) return null;
  const val = parseFloat(raw.replace(',', '.'));
  return Number.isFinite(val) && val >= 0 ? val : null;
}

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

  const savedByNorm = new Map<string, { name: string; sets: SetRec[]; notes: string[] }>();
  for (const r of onDate) {
    const name = resolveName(r.ref, S.settings);
    const k = norm(name);
    const cur = savedByNorm.get(k) ?? { name, sets: [], notes: [] };
    cur.sets.push(...r.sets.map((s) => ({ w: s.w, r: s.r, done: true })));
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
        exercises.push({ name: r.name, done: true, sets: saved.sets, note: [...new Set(saved.notes)].join(' · ') });
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
    exercises.push({ name: saved.name, done: true, sets: saved.sets, note: [...new Set(saved.notes)].join(' · ') });
  }

  return {
    date,
    day,
    exercises,
    sessionId: sessionId ?? (onDate[0]?.sessionId || targetSid),
    dirty: false,
    restSec: S.logDraft?.restSec ?? 90,
  };
}

function fmtMMSS(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Renderiza la barra de cronómetro de descanso no bloqueante para la vista de registro en vivo. */
export function renderRestTimerBar(draft: LogDraft): string {
  const restSec = draft.restSec ?? 90;
  const until = draft.restUntil;
  const remSec = until != null ? Math.max(0, Math.ceil((until - Date.now()) / 1000)) : 0;
  const presets = [60, 90, 120, 180];

  if (until != null && remSec > 0) {
    return `
    <div id="rest-timer-bar" class="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] lg:bottom-4 z-20 rounded-2xl border border-electricBlue/50 bg-[#0D1320] px-3.5 py-2.5 shadow-xl">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-3">
          <span class="tabular-nums text-2xl font-extrabold text-white">${fmtMMSS(remSec)}</span>
          <span class="text-xs font-semibold uppercase tracking-wide text-blue-300">Descanso en curso</span>
        </div>
        <div class="flex items-center gap-1.5">
          <button type="button" class="btn !min-h-[44px] !px-3 tabular-nums" data-act="restAdjust" data-arg="-15" aria-label="Restar 15 segundos">−15s</button>
          <button type="button" class="btn !min-h-[44px] !px-3 tabular-nums" data-act="restAdjust" data-arg="30" aria-label="Sumar 30 segundos">+30s</button>
          <button type="button" class="btn !min-h-[44px] !border-emeraldGreen/50 !px-3 text-emerald-300" data-act="restStop">Saltar</button>
        </div>
      </div>
    </div>`;
  }

  if (until != null && remSec === 0) {
    return `
    <div id="rest-timer-bar" class="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] lg:bottom-4 z-20 rounded-2xl border border-emeraldGreen/60 bg-[#0D1320] px-3.5 py-2.5 shadow-xl">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-full bg-emeraldGreen" aria-hidden="true"></span>
          <span class="text-sm font-bold text-emerald-300">Descanso completado · listo para la siguiente serie</span>
        </div>
        <div class="flex items-center gap-1.5">
          ${presets.map((p) => `<button type="button" class="btn !min-h-[44px] !px-2.5 text-xs tabular-nums" data-act="restStart" data-arg="${p}">${p}s</button>`).join('')}
          <button type="button" class="btn !min-h-[44px] !px-3 text-xs" data-act="restStop">Cerrar</button>
        </div>
      </div>
    </div>`;
  }

  return `
  <div id="rest-timer-bar" class="flex flex-wrap items-center justify-between gap-2 border-y border-white/10 py-2.5 text-xs">
    <span class="text-gray-400">Descanso automático al marcar ✓: <b class="text-gray-200 tabular-nums">${restSec}s</b></span>
    <div class="flex flex-wrap items-center gap-1.5">
      ${presets.map((p) => `<button type="button" class="btn !min-h-[44px] !px-3 !py-1.5 text-xs tabular-nums ${p === restSec ? '!border-electricBlue text-blue-300' : ''}" data-act="restStart" data-arg="${p}">${p}s</button>`).join('')}
    </div>
  </div>`;
}

/**
 * Renderiza la vista de registro rápido de entrenamientos (`Registrar entreno`).
 *
 * @param S - Estado global de la aplicación.
 * @returns HTML completo de la pestaña `log`.
 */
export function viewLog(S: State): string {
  const today = new Date().toISOString().slice(0, 10);
  const routines = routineNames(S.settings);
  const draft = S.logDraft ?? (S.logDraft = initLogDraft(S, routines[0] ?? 'Libre', today));
  const all = allExerciseNames(S);
  const inDraft = new Set(draft.exercises.map((e) => norm(e.name)));
  const avail = all.filter((n) => !inDraft.has(norm(n)));
  const dayMuscles = new Set(
    draft.day === 'Libre'
      ? []
      : (S.settings.routines[draft.day] ?? []).map((r) => musclesOf(r.name, S.settings)?.p).filter((m): m is string => Boolean(m)),
  );
  const quick = avail
    .filter((n) => {
      if (draft.day === 'Libre') return true;
      const m = musclesOf(n, S.settings);
      if (!m) return false;
      return dayMuscles.size ? dayMuscles.has(m.p) : MUSCLE_DAY[m.p] === draft.day;
    })
    .sort((a, b) => (S.analysis.exercises.get(b)?.n ?? 0) - (S.analysis.exercises.get(a)?.n ?? 0))
    .slice(0, 6);

  const doneExCount = draft.exercises.filter((e) => e.sets.some((s) => s.done && s.r > 0)).length;
  const doneSetsCount = draft.exercises.reduce((acc, e) => acc + e.sets.filter((s) => s.done && s.r > 0).length, 0);
  const totalSetsCount = draft.exercises.reduce((acc, e) => acc + e.sets.length, 0);
  const recentSessions = [...S.analysis.sessions].reverse().slice(0, 10);

  return `
  <div class="space-y-3 pb-4 border-b border-white/10">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 class="text-lg font-extrabold text-white">Registrar entrenamiento</h2>
        <p id="logCountSummary" class="text-xs sm:text-sm text-gray-300 tabular-nums">${doneExCount}/${draft.exercises.length} ejercicios · ${doneSetsCount}/${totalSetsCount} series marcadas ✓</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <a href="#log-add-section" class="btn !min-h-[44px] !py-1.5 text-xs sm:text-sm">+ Añadir ejercicio</a>
        <button class="btn !min-h-[44px] !py-1.5 text-xs sm:text-sm" data-act="logReset">${icon('reset', 'h-3.5 w-3.5')} Reiniciar</button>
        <button class="btn-primary !min-h-[44px] !py-1.5" data-act="logSave">${icon('save', 'h-4 w-4')} Guardar (${doneSetsCount})</button>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <label class="flex items-center gap-2 text-xs text-gray-400">
        <span>Fecha</span>
        <input class="inp !w-auto !min-h-[44px] tabular-nums" type="date" value="${esc(draft.date)}" data-change="logDate" aria-label="Fecha de la sesión">
      </label>
      <div class="flex flex-wrap gap-1.5" role="group" aria-label="Rutina de la sesión">
        ${[...routines, 'Libre'].map((d, idx) => {
          const on = draft.day === d;
          const col = d === 'Libre' ? '#9CA3AF' : routineColor(d, S.settings, idx);
          return `<button data-act="logDay" data-arg="${esc(d)}" aria-pressed="${on}" class="tab !min-h-[44px] ${on ? 'tab-on' : ''}" style="${on && d !== 'Libre' ? `border-color:${col};color:${col}` : ''}">${esc(d)}</button>`;
        }).join('')}
      </div>
    </div>
  </div>

  ${draft.exercises.length ? `<div data-sort-list="log" class="grid grid-cols-1 gap-3 xl:grid-cols-2 items-start">
    ${draft.exercises.map((ex, ei) => {
      const k = norm(ex.name);
      const hist = [...S.analysis.exercises.values()].find((e) => norm(e.name) === k);
      const tgt = draft.day !== 'Libre' ? (S.settings.routines[draft.day] ?? []).find((r) => norm(r.name) === k) : hist?.target;
      const lastRef = hist?.last ? `Última (${short(hist.last.date)}): ${hist.last.sets.map((s) => `${s.w}×${s.r}`).join(' · ')}` : 'Sin historial previo';
      const freshAi = isAiFreshForEx(S, hist) ? S.settings.ai?.byExercise[ex.name] : undefined;
      const prescription = freshAi?.prescription ?? hist?.prescription ?? '';
      const targetW = prescription ? extractTargetWeight(prescription) : null;
      const fixedNote = S.settings.notes[ex.name]?.trim() ?? '';
      const doneInEx = ex.sets.filter((s) => s.done && s.r > 0).length;
      const allDoneInEx = ex.sets.length > 0 && doneInEx === ex.sets.length;
      const showApplyBtn = targetW != null && ex.sets.some((s) => !s.done && s.w !== targetW);
      const total = draft.exercises.length;
      return `
      <div data-sort-item data-sort-idx="${ei}" data-ex-idx="${ei}" class="rounded-2xl border bg-cardDark px-2.5 py-3.5 sm:p-4 space-y-3 transition-colors ${allDoneInEx ? 'border-emeraldGreen/50' : doneInEx > 0 ? 'border-electricBlue/50' : 'border-white/10'}">
        <div class="flex items-start justify-between gap-2">
          <div class="flex flex-1 min-w-0 items-start gap-2">
            <button type="button" data-sort-handle class="mt-0.5 flex h-10 w-8 shrink-0 touch-none cursor-grab active:cursor-grabbing select-none items-center justify-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" aria-label="Arrastrar para reordenar ${esc(ex.name)}" title="Arrastrar para reordenar">${icon('grip', 'h-4 w-4')}</button>
            <button type="button" data-act="logToggleEx" data-arg="${ei}" aria-pressed="${allDoneInEx}" class="flex flex-1 min-w-0 items-start gap-2.5 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue">
              <span class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${allDoneInEx ? 'border-emeraldGreen bg-emeraldGreen/20 text-emeraldGreen' : doneInEx > 0 ? 'border-electricBlue bg-electricBlue/20 text-blue-300' : 'border-gray-600 text-transparent'}">${icon('check', 'h-4 w-4')}</span>
              <div class="min-w-0">
                <div class="font-bold text-white leading-snug">${esc(ex.name)} ${tgt ? `<span class="ml-1 tabular-nums text-[13px] font-normal text-gray-400">(${tgt.sets}×${tgt.reps})</span>` : ''} <span data-ex-counter="${ei}" class="ml-1 tabular-nums text-xs font-semibold ${allDoneInEx ? 'text-emerald-300' : 'text-gray-400'}">${doneInEx}/${ex.sets.length}</span></div>
                <div class="tabular-nums text-xs sm:text-[13px] text-gray-300">${esc(lastRef)}</div>
              </div>
            </button>
          </div>
          <div class="flex shrink-0 items-center gap-0.5">
            <button type="button" class="flex h-10 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-25 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" data-act="logMoveEx" data-arg="${ei}|-1" ${ei === 0 ? 'disabled' : ''} aria-label="Subir ${esc(ex.name)}" title="Subir">${icon('caretUp', 'h-3.5 w-3.5')}</button>
            <button type="button" class="flex h-10 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-25 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" data-act="logMoveEx" data-arg="${ei}|1" ${ei === total - 1 ? 'disabled' : ''} aria-label="Bajar ${esc(ex.name)}" title="Bajar">${icon('caretDown', 'h-3.5 w-3.5')}</button>
            <button type="button" class="flex h-10 w-8 items-center justify-center rounded-lg text-gray-400 hover:text-coralRed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" data-act="logRemoveEx" data-arg="${ei}" aria-label="Quitar ${esc(ex.name)} de la sesión">${icon('close', 'h-4 w-4')}</button>
          </div>
        </div>

        ${prescription || fixedNote ? `
        <div class="space-y-1 border-l-2 border-emeraldGreen/70 pl-2.5 text-xs">
          ${prescription ? `<div class="flex flex-wrap items-center justify-between gap-2 text-gray-200"><span>${esc(prescription)}</span>${showApplyBtn ? `<button type="button" class="btn !min-h-[36px] !px-2.5 !py-1 text-xs text-emerald-300 !border-emeraldGreen/40" data-act="logApplyWeight" data-arg="${ei}|${targetW}">Aplicar ${targetW} kg</button>` : ''}</div>` : ''}
          ${fixedNote ? `<p class="text-gray-300"><span class="font-semibold text-white">Fija:</span> ${esc(fixedNote)}</p>` : ''}
        </div>` : ''}

        <div class="space-y-2">
          <div class="flex items-center gap-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            <span class="w-5 shrink-0"></span>
            <span class="flex-1 text-center">Peso (kg · ±2,5)</span>
            <span class="flex-1 text-center">Reps (±1)</span>
            <span class="w-11 shrink-0 text-center">OK</span>
          </div>
          ${ex.sets.map((s, si) => `
          <div data-set-row="${ei}|${si}" class="flex items-center gap-1.5 rounded-xl p-1 transition-colors ${s.done ? 'bg-emeraldGreen/10' : ''}">
            <span class="w-5 shrink-0 text-center tabular-nums text-xs font-bold ${s.done ? 'text-emerald-300' : 'text-gray-400'}">S${si + 1}</span>
            <div class="flex flex-1 min-w-0 items-center">
              <button type="button" class="flex h-11 w-9 sm:w-11 shrink-0 items-center justify-center rounded-l-xl border border-gray-700 bg-gray-900 text-base font-bold text-gray-200 hover:border-electricBlue active:scale-95" style="touch-action:manipulation" data-act="logStepW" data-arg="${ei}|${si}|-2.5" aria-label="Restar 2,5 kg a serie ${si + 1} de ${esc(ex.name)}">−</button>
              <input class="inp !h-11 min-w-[44px] flex-1 !rounded-none !border-x-0 !px-1 !py-0 text-center font-bold tabular-nums" type="number" step="0.5" min="0" inputmode="decimal" value="${s.w}" data-log-w="${ei}|${si}" aria-label="Peso en kg serie ${si + 1} de ${esc(ex.name)}">
              <button type="button" class="flex h-11 w-9 sm:w-11 shrink-0 items-center justify-center rounded-r-xl border border-gray-700 bg-gray-900 text-base font-bold text-gray-200 hover:border-electricBlue active:scale-95" style="touch-action:manipulation" data-act="logStepW" data-arg="${ei}|${si}|2.5" aria-label="Sumar 2,5 kg a serie ${si + 1} de ${esc(ex.name)}">+</button>
            </div>
            <div class="flex flex-1 min-w-0 items-center">
              <button type="button" class="flex h-11 w-8 sm:w-11 shrink-0 items-center justify-center rounded-l-xl border border-gray-700 bg-gray-900 text-base font-bold text-gray-200 hover:border-electricBlue active:scale-95" style="touch-action:manipulation" data-act="logStepR" data-arg="${ei}|${si}|-1" aria-label="Restar 1 repetición a serie ${si + 1} de ${esc(ex.name)}">−</button>
              <input class="inp !h-11 min-w-[38px] flex-1 !rounded-none !border-x-0 !px-1 !py-0 text-center font-bold tabular-nums" type="number" step="1" min="0" inputmode="numeric" value="${s.r}" data-log-r="${ei}|${si}" aria-label="Repeticiones serie ${si + 1} de ${esc(ex.name)}">
              <button type="button" class="flex h-11 w-8 sm:w-11 shrink-0 items-center justify-center rounded-r-xl border border-gray-700 bg-gray-900 text-base font-bold text-gray-200 hover:border-electricBlue active:scale-95" style="touch-action:manipulation" data-act="logStepR" data-arg="${ei}|${si}|1" aria-label="Sumar 1 repetición a serie ${si + 1} de ${esc(ex.name)}">+</button>
            </div>
            <button type="button" data-act="logToggleSet" data-arg="${ei}|${si}" aria-pressed="${Boolean(s.done)}" aria-label="${s.done ? 'Desmarcar' : 'Completar'} serie ${si + 1} de ${esc(ex.name)}" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors active:scale-95 ${s.done ? 'border-emeraldGreen bg-emeraldGreen text-gray-950' : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-emeraldGreen/60 hover:text-white'}" style="touch-action:manipulation">${icon('check', 'h-5 w-5')}</button>
          </div>`).join('')}
        </div>

        <div class="flex flex-wrap items-center gap-2 pt-1">
          <button type="button" class="btn !min-h-[44px] !px-3 text-xs sm:text-sm" data-act="logAddSet" data-arg="${ei}">+ Serie</button>
          ${ex.sets.length > 1 ? `<button type="button" class="btn !min-h-[44px] !px-3 text-xs sm:text-sm text-coralRed" data-act="logDelSet" data-arg="${ei}|${ex.sets.length - 1}" aria-label="Quitar última serie de ${esc(ex.name)}">− Serie</button>` : ''}
          <input class="inp !min-h-[44px] min-w-[160px] flex-1 !py-1.5" value="${esc(ex.note)}" data-log-note="${ei}" placeholder="Nota (RIR, sensaciones…)" aria-label="Nota de sesión para ${esc(ex.name)}">
          <button type="button" class="btn !min-h-[44px] !px-2.5 text-xs" data-act="editNote" data-arg="${esc(ex.name)}" aria-label="Editar nota biomecánica fija de ${esc(ex.name)}">${icon('edit', 'h-3.5 w-3.5')} Fija</button>
        </div>
      </div>`;
    }).join('')}
  </div>` : empty('No hay ejercicios en el borrador. Elige una rutina arriba o añade ejercicios abajo.')}

  ${renderRestTimerBar(draft)}

  <div class="flex flex-wrap items-center justify-between gap-2">
    <button class="btn !min-h-[44px]" data-act="logReset">${icon('reset', 'h-4 w-4')} Reiniciar borrador</button>
    <button class="btn-primary !min-h-[44px] !px-5 !py-2.5" data-act="logSave">${icon('save', 'h-4 w-4')} Guardar sesión (${doneSetsCount} series)</button>
  </div>

  <section id="log-add-section" class="space-y-2.5 pt-4 border-t border-white/10">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="text-sm font-bold text-white">Añadir ejercicio a la sesión</h3>
      <button class="btn !min-h-[44px] !border-electricBlue/40 !py-1.5 text-xs sm:text-sm text-blue-300" data-act="openExModalLog">+ Crear ejercicio nuevo</button>
    </div>
    <div class="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
      <div class="flex flex-wrap gap-2">
        <select id="logAddSelect" class="inp !min-h-[44px] min-w-[200px] flex-1" aria-label="Seleccionar ejercicio para añadir">
          <option value="">Selecciona cualquier ejercicio (${avail.length})…</option>
          ${avail.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}
        </select>
        <button class="btn !min-h-[44px]" data-act="logAddEx">+ Añadir de la lista</button>
      </div>
      <div class="flex flex-wrap gap-2">
        <input id="logNewExName" class="inp !min-h-[44px] min-w-[180px] flex-1" placeholder="Añadir rápido por nombre…" aria-label="Nombre de ejercicio nuevo">
        <button class="btn !min-h-[44px]" data-act="logAddCustomEx">+ Añadir rápido</button>
      </div>
    </div>
    ${quick.length ? `
    <div class="flex flex-wrap items-center gap-1.5 pt-1">
      <span class="text-xs text-gray-400">Sugeridos:</span>
      ${quick.map((n) => `<button data-act="logAddQuick" data-arg="${esc(n)}" class="btn !min-h-[40px] !rounded-full !px-3 !py-1 text-xs font-normal text-gray-200">+ ${esc(n)}</button>`).join('')}
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
            <button class="btn !min-h-[40px] !px-2.5 !py-1.5 text-xs" data-act="logEditSession" data-arg="${esc(s.id)}|${esc(s.date)}|${esc(s.day ?? 'Libre')}">${icon('edit', 'h-3.5 w-3.5')} <span class="hidden sm:inline">Cargar / Editar</span><span class="sm:hidden">Editar</span></button>
            <button class="btn !min-h-[40px] !border-coralRed/50 !px-2.5 !py-1.5 text-xs text-coralRed" data-act="logDelSession" data-arg="${esc(s.id)}|${esc(s.date)}" aria-label="Borrar sesión del ${fmtDate(s.date)}" title="Borrar sesión">${icon('trash', 'h-3.5 w-3.5')}</button>
          </div>
        </div>`).join('')}
    </div>
  </div>` : ''}`;
}
