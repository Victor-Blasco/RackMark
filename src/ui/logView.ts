import { musclesOf, resolveName } from '../lib/analysis';
import { CATALOG_EXERCISES, MUSCLE_DAY, norm } from '../lib/seed';
import { DAYS, type DayName, type LogDraft, type LogExDraft } from '../types';
import { icon } from './icons';
import { DAY_COLOR, empty, esc, fmtDate, short, type State } from './shared';

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
  DAYS.forEach((d) => S.settings.routines[d].forEach((r) => add(r.name)));
  CATALOG_EXERCISES.forEach(add);
  Object.values(S.settings.customNames).forEach(add);
  Object.values(S.settings.refNames).forEach(add);
  [...S.analysis.exercises.keys()].forEach(add);
  return [...byNorm.values()].sort((a, b) => a.localeCompare(b, 'es'));
}

/**
 * Precarga las series de un ejercicio usando la última sesión registrada o valores por defecto.
 *
 * @param S - Estado global de la aplicación.
 * @param name - Nombre del ejercicio.
 * @param fallbackSets - Número de series si no hay historial.
 * @param fallbackReps - Repeticiones iniciales si no hay historial.
 * @returns Array de series `{ w, r }`.
 */
export function defaultSetsForEx(S: State, name: string, fallbackSets = 2, fallbackReps = 10) {
  const k = norm(name);
  const ex = [...S.analysis.exercises.values()].find((e) => norm(e.name) === k);
  if (ex?.last?.sets.length) return ex.last.sets.map((s) => ({ ...s }));
  return Array.from({ length: fallbackSets }, () => ({ w: 0, r: fallbackReps }));
}

/**
 * Construye un borrador de sesión para una rutina y fecha dadas, combinando datos guardados en esa fecha.
 *
 * @param S - Estado global de la aplicación.
 * @param day - Rutina seleccionada (`Push`, `Pull`, `Leg` o `Libre`).
 * @param date - Fecha en formato ISO (`YYYY-MM-DD`).
 * @returns Borrador listo para editar en la vista `+ Entrenar`.
 */
export function initLogDraft(S: State, day: DayName | 'Libre', date: string): LogDraft {
  const onDate = S.strength.filter((r) => r.date === date);
  const savedByNorm = new Map<string, { name: string; sets: { w: number; r: number }[]; notes: string[] }>();
  for (const r of onDate) {
    const name = resolveName(r.ref, S.settings);
    const k = norm(name);
    const cur = savedByNorm.get(k) ?? { name, sets: [], notes: [] };
    cur.sets.push(...r.sets.map((s) => ({ ...s })));
    if (r.note?.trim()) cur.notes.push(r.note.trim());
    savedByNorm.set(k, cur);
  }
  const hasSavedOnDate = savedByNorm.size > 0;
  const exercises: LogExDraft[] = [];
  const used = new Set<string>();

  if (day !== 'Libre') {
    for (const r of S.settings.routines[day]) {
      const k = norm(r.name);
      used.add(k);
      const saved = savedByNorm.get(k);
      if (saved) {
        exercises.push({ name: r.name, done: true, sets: saved.sets, note: [...new Set(saved.notes)].join(' · ') });
      } else {
        exercises.push({
          name: r.name,
          done: !hasSavedOnDate,
          sets: defaultSetsForEx(S, r.name, r.sets, r.reps),
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
  return { date, day, exercises };
}

/**
 * Renderiza la vista de registro rápido de entrenamientos (`+ Entrenar`).
 *
 * @param S - Estado global de la aplicación.
 * @returns HTML completo de la pestaña `+ Entrenar`.
 */
export function viewLog(S: State): string {
  const today = new Date().toISOString().slice(0, 10);
  const draft = S.logDraft ?? (S.logDraft = initLogDraft(S, 'Push', today));
  const all = allExerciseNames(S);
  const inDraft = new Set(draft.exercises.map((e) => norm(e.name)));
  const avail = all.filter((n) => !inDraft.has(norm(n)));
  const quick = avail
    .filter((n) => {
      if (draft.day === 'Libre') return true;
      const m = musclesOf(n, S.settings);
      return m ? MUSCLE_DAY[m.p] === draft.day : false;
    })
    .sort((a, b) => (S.analysis.exercises.get(b)?.n ?? 0) - (S.analysis.exercises.get(a)?.n ?? 0))
    .slice(0, 6);

  const activeCount = draft.exercises.filter((e) => e.done).length;
  const totalSets = draft.exercises.filter((e) => e.done).reduce((a, e) => a + e.sets.length, 0);
  const manualSessionIds = new Set(S.strength.filter((r) => r.id.startsWith('manual-')).map((r) => r.sessionId));
  const recentSessions = [...S.analysis.sessions].reverse().slice(0, 10);

  return `
  <div class="card space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 class="text-lg font-extrabold text-white">Registrar entrenamiento</h2>
        <p id="logCountSummary" class="text-xs text-gray-400 tabular-nums">${activeCount} ejercicios activos · ${totalSets} series</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button class="btn !py-1.5 !text-xs" data-act="logReset">${icon('reset', 'h-3.5 w-3.5')} Reiniciar</button>
        <button class="btn-primary !py-1.5" data-act="logSave">${icon('save', 'h-4 w-4')} Guardar sesión</button>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <label class="flex items-center gap-2 text-xs text-gray-400">
        <span>Fecha</span>
        <input class="inp !w-auto font-mono" type="date" value="${esc(draft.date)}" data-change="logDate" aria-label="Fecha de la sesión">
      </label>
      <div class="flex flex-wrap gap-1.5" role="group" aria-label="Rutina de la sesión">
        ${(['Push', 'Pull', 'Leg', 'Libre'] as const).map((d) => {
          const on = draft.day === d;
          const col = d === 'Libre' ? '#9CA3AF' : DAY_COLOR[d];
          return `<button data-act="logDay" data-arg="${d}" aria-pressed="${on}" class="tab ${on ? 'tab-on' : ''}" style="${on && d !== 'Libre' ? `border-color:${col};color:${col}` : ''}">${d}</button>`;
        }).join('')}
      </div>
    </div>
  </div>

  <div class="card space-y-2.5">
    <h3 class="text-sm font-bold text-white">Añadir ejercicio de la lista</h3>
    <div class="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
      <div class="flex flex-wrap gap-2">
        <select id="logAddSelect" class="inp min-w-[200px] flex-1" aria-label="Seleccionar ejercicio para añadir">
          <option value="">Selecciona cualquier ejercicio (${avail.length})…</option>
          ${avail.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}
        </select>
        <button class="btn" data-act="logAddEx">+ Añadir de la lista</button>
      </div>
      <div class="flex flex-wrap gap-2">
        <input id="logNewExName" class="inp min-w-[180px] flex-1" placeholder="Ej. Press inclinado con mancuernas…" aria-label="Nombre de ejercicio nuevo">
        <button class="btn" data-act="logAddCustomEx">+ Crear y añadir</button>
      </div>
    </div>
    ${quick.length ? `
    <div class="flex flex-wrap items-center gap-1.5 pt-1">
      <span class="text-[11px] text-gray-500">Sugeridos:</span>
      ${quick.map((n) => `<button data-act="logAddQuick" data-arg="${esc(n)}" class="btn !rounded-full !px-2.5 !py-1 !text-xs font-normal text-gray-300">+ ${esc(n)}</button>`).join('')}
    </div>` : ''}
  </div>

  ${draft.exercises.length ? `<div class="grid grid-cols-1 gap-3 xl:grid-cols-2 items-start">
    ${draft.exercises.map((ex, ei) => {
      const k = norm(ex.name);
      const hist = [...S.analysis.exercises.values()].find((e) => norm(e.name) === k);
      const tgt = draft.day !== 'Libre' ? S.settings.routines[draft.day].find((r) => norm(r.name) === k) : hist?.target;
      const lastRef = hist?.last ? `Última (${short(hist.last.date)}): ${hist.last.sets.map((s) => `${s.w}×${s.r}`).join(' · ')}` : 'Sin historial previo';
      return `
      <div class="card space-y-2.5 ${ex.done ? 'border-white/15' : 'opacity-60'}">
        <div class="flex items-start justify-between gap-2">
          <button data-act="logToggleEx" data-arg="${ei}" aria-pressed="${ex.done}" class="flex flex-1 items-start gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue rounded-lg">
            <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${ex.done ? 'border-emeraldGreen bg-emeraldGreen/20 text-emeraldGreen' : 'border-gray-600 text-transparent'}">${icon('check', 'h-3.5 w-3.5')}</span>
            <div>
              <div class="font-bold text-white">${esc(ex.name)} ${tgt ? `<span class="ml-1 font-mono tabular-nums text-xs font-normal text-gray-400">(${tgt.sets}×${tgt.reps})</span>` : ''}</div>
              <div class="font-mono tabular-nums text-[11px] text-gray-400">${esc(lastRef)}</div>
            </div>
          </button>
          <button class="rounded-lg p-1.5 text-gray-500 hover:text-coralRed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" data-act="logRemoveEx" data-arg="${ei}" aria-label="Quitar ${esc(ex.name)} de la sesión">${icon('close', 'h-4 w-4')}</button>
        </div>
        ${ex.done ? `
        <div class="space-y-1.5">
          ${ex.sets.map((s, si) => `
          <div class="flex flex-wrap items-center gap-1.5 text-xs">
            <span class="w-6 font-mono tabular-nums font-bold text-gray-500">S${si + 1}</span>
            <div class="flex items-center gap-1">
              <button class="btn !px-2 !py-1 font-mono text-xs" data-act="logStepW" data-arg="${ei}|${si}|-2.5" aria-label="Restar 2,5 kg a serie ${si + 1} de ${esc(ex.name)}">−2,5</button>
              <input class="inp !w-16 !px-2 !py-1 text-center font-mono tabular-nums" type="number" step="0.5" min="0" inputmode="decimal" value="${s.w}" data-log-w="${ei}|${si}" aria-label="Peso en kg serie ${si + 1} de ${esc(ex.name)}">
              <span class="text-gray-500">kg</span>
              <button class="btn !px-2 !py-1 font-mono text-xs" data-act="logStepW" data-arg="${ei}|${si}|2.5" aria-label="Sumar 2,5 kg a serie ${si + 1} de ${esc(ex.name)}">+2,5</button>
            </div>
            <span class="text-gray-600" aria-hidden="true">×</span>
            <div class="flex items-center gap-1">
              <button class="btn !px-2 !py-1 font-mono text-xs" data-act="logStepR" data-arg="${ei}|${si}|-1" aria-label="Restar 1 repetición a serie ${si + 1} de ${esc(ex.name)}">−1</button>
              <input class="inp !w-14 !px-2 !py-1 text-center font-mono tabular-nums" type="number" step="1" min="0" inputmode="numeric" value="${s.r}" data-log-r="${ei}|${si}" aria-label="Repeticiones serie ${si + 1} de ${esc(ex.name)}">
              <span class="text-gray-500">rep</span>
              <button class="btn !px-2 !py-1 font-mono text-xs" data-act="logStepR" data-arg="${ei}|${si}|1" aria-label="Sumar 1 repetición a serie ${si + 1} de ${esc(ex.name)}">+1</button>
            </div>
            <button class="ml-auto rounded-lg p-1 text-coralRed hover:bg-coralRed/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" data-act="logDelSet" data-arg="${ei}|${si}" aria-label="Borrar serie ${si + 1} de ${esc(ex.name)}">${icon('close', 'h-3.5 w-3.5')}</button>
          </div>`).join('')}
        </div>
        <div class="flex flex-wrap items-center gap-2 pt-1">
          <button class="btn !px-2.5 !py-1 !text-xs" data-act="logAddSet" data-arg="${ei}">+ Serie</button>
          <input class="inp min-w-[180px] flex-1 !py-1.5 !text-xs" value="${esc(ex.note)}" data-log-note="${ei}" placeholder="Nota del ejercicio (RIR, sensaciones, ajuste…)" aria-label="Nota de sesión para ${esc(ex.name)}">
          <button class="btn !px-2 !py-1 !text-xs" data-act="editNote" data-arg="${esc(ex.name)}" aria-label="Editar nota biomecánica fija de ${esc(ex.name)}">${icon('edit', 'h-3.5 w-3.5')} Fija</button>
        </div>` : ''}
      </div>`;
    }).join('')}
  </div>` : empty('No hay ejercicios en el borrador. Elige una rutina arriba o añade ejercicios de la lista.')}

  <div class="flex flex-wrap items-center justify-between gap-2">
    <button class="btn" data-act="logReset">${icon('reset', 'h-4 w-4')} Reiniciar borrador</button>
    <button class="btn-primary !px-5 !py-2.5" data-act="logSave">${icon('save', 'h-4 w-4')} Guardar sesión de entrenamiento</button>
  </div>

  ${recentSessions.length ? `
  <div class="card space-y-2">
    <h3 class="font-bold text-white">Últimas sesiones registradas</h3>
    <div class="grid grid-cols-1 gap-x-6 gap-y-2 xl:grid-cols-2">
      ${recentSessions.map((s) => {
        const isManual = manualSessionIds.has(s.id);
        return `
        <div class="flex flex-wrap items-center justify-between gap-2 border-t border-gray-800 pt-2 text-xs">
          <div>
            <span class="font-mono tabular-nums font-semibold text-white">${fmtDate(s.date)}</span>
            <span class="ml-1.5 font-bold" style="color:${s.day ? DAY_COLOR[s.day] : '#9CA3AF'}">${s.day ?? 'Otro'}</span>
            <span class="ml-1.5 text-gray-400 tabular-nums">· ${s.exercises.length} ej. · ${s.sets} series</span>
            <div class="text-[11px] text-gray-500">${esc(s.exercises.join(', '))}</div>
          </div>
          <div class="flex gap-1.5">
            <button class="btn !px-2.5 !py-1 !text-xs" data-act="logEditSession" data-arg="${s.date}|${s.day ?? 'Libre'}">${icon('edit', 'h-3.5 w-3.5')} Cargar / Editar</button>
            ${isManual ? `<button class="btn !border-coralRed/50 !px-2 !py-1 !text-xs text-coralRed" data-act="logDelSession" data-arg="${esc(s.id)}|${s.date}" aria-label="Borrar sesión manual del ${fmtDate(s.date)}">${icon('trash', 'h-3.5 w-3.5')}</button>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>` : ''}`;
}
