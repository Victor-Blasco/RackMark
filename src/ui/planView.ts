import { musclesOf } from '../lib/analysis';
import { MUSCLES, ROUTINE_COLORS, ROUTINE_TEMPLATES } from '../lib/seed';
import { icon } from './icons';
import { allExerciseNames } from './logView';
import { esc, fmtDate, routineColor, routineNames, type State } from './shared';

const sel = (name: string, opts: string[]) =>
  `<option value="" ${name ? '' : 'selected'}>—</option>${opts.map((o) => `<option ${o === name ? 'selected' : ''}>${esc(o)}</option>`).join('')}`;

/** Renderiza los modales activos de creación de ejercicios, rutinas y confirmaciones. */
export function renderModals(S: State): string {
  if (S.confirmModal) {
    const cm = S.confirmModal;
    return `<div id="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirmModalTitle" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-black/75 backdrop-blur-sm" data-act="confirmNo" aria-hidden="true"></div>
      <div class="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#0F1624] p-5 shadow-2xl space-y-4">
        <div class="flex items-start gap-3">
          ${cm.danger ? `<div class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-coralRed/15 text-coralRed">${icon('warn', 'h-5 w-5')}</div>` : ''}
          <div class="min-w-0 flex-1">
            <h3 id="confirmModalTitle" class="text-base font-extrabold text-white">${esc(cm.title)}</h3>
            <p class="mt-1 text-sm text-gray-300 leading-relaxed">${esc(cm.message)}</p>
          </div>
        </div>
        <div class="flex justify-end gap-2 border-t border-white/10 pt-3">
          <button type="button" class="btn" data-act="confirmNo">Cancelar</button>
          <button type="button" class="${cm.danger ? 'btn !border-coralRed/60 !bg-coralRed !text-white hover:!bg-coralRed/90' : 'btn-primary'}" data-act="confirmYes">${esc(cm.confirmLabel ?? 'Confirmar')}</button>
        </div>
      </div>
    </div>`;
  }
  if (S.exModal) {
    const routines = routineNames(S.settings);
    const target = S.exModal.routine ?? '';
    return `<div id="ex-modal" role="dialog" aria-modal="true" aria-labelledby="exModalTitle" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-black/75 backdrop-blur-sm" data-act="closeModal" aria-hidden="true"></div>
      <form id="f-new-ex" class="relative z-10 w-full max-w-lg rounded-2xl border border-white/10 bg-[#0F1624] p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between gap-2">
          <div>
            <h3 id="exModalTitle" class="text-base font-extrabold text-white">Crear nuevo ejercicio</h3>
            <p class="text-xs text-gray-400">Se añadirá a tu biblioteca muscular y podrás asignarlo a una rutina.</p>
          </div>
          <button type="button" data-act="closeModal" aria-label="Cerrar modal" class="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white">${icon('close', 'h-4 w-4')}</button>
        </div>

        <label class="block">
          <span class="lbl">Nombre del ejercicio</span>
          <input id="newExName" class="inp" name="name" maxlength="80" placeholder="Ej. Remo en polea gironda" required>
        </label>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label class="block sm:col-span-1">
            <span class="lbl">Músculo principal</span>
            <select class="inp" name="primary" required>
              ${MUSCLES.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join('')}
            </select>
          </label>
          <label class="block">
            <span class="lbl">Series objetivo</span>
            <input class="inp tabular-nums font-medium" type="number" name="sets" min="1" max="20" value="3" required>
          </label>
          <label class="block">
            <span class="lbl">Reps objetivo</span>
            <input class="inp tabular-nums font-medium" type="number" name="reps" min="1" max="100" value="10" required>
          </label>
        </div>

        <fieldset class="space-y-1.5">
          <legend class="lbl">Músculos secundarios (opcional)</legend>
          <div class="flex flex-wrap gap-1.5">
            ${MUSCLES.map((m) => `
              <label class="cursor-pointer select-none">
                <input type="checkbox" name="secondary" value="${esc(m)}" class="sr-only peer">
                <span class="inline-block rounded-lg border border-white/10 bg-gray-900/70 px-2.5 py-1 text-xs font-semibold text-gray-300 transition-colors peer-checked:border-electricBlue peer-checked:bg-electricBlue/20 peer-checked:text-blue-200 hover:border-white/25">${esc(m)}</span>
              </label>`).join('')}
          </div>
        </fieldset>

        ${S.exModal.fromLog ? '' : `
        <label class="block">
          <span class="lbl">Asignar a rutina</span>
          <select class="inp" name="routine">
            <option value="">Solo guardar en catálogo</option>
            ${routines.map((r) => `<option value="${esc(r)}" ${r === target ? 'selected' : ''}>${esc(r)}</option>`).join('')}
          </select>
        </label>`}

        <div class="flex items-center justify-end gap-2 border-t border-white/10 pt-3">
          <button type="button" class="btn" data-act="closeModal">Cancelar</button>
          <button type="submit" class="btn-primary">${icon('save', 'h-4 w-4')} Guardar ejercicio</button>
        </div>
      </form>
    </div>`;
  }

  if (S.routineModal) {
    const rm = S.routineModal;
    const isEdit = rm.mode === 'edit';
    return `<div id="rt-modal" role="dialog" aria-modal="true" aria-labelledby="rtModalTitle" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-black/75 backdrop-blur-sm" data-act="closeModal" aria-hidden="true"></div>
      <form id="f-routine-meta" class="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#0F1624] p-5 shadow-2xl space-y-4">
        <div class="flex items-center justify-between gap-2">
          <div>
            <h3 id="rtModalTitle" class="text-base font-extrabold text-white">${isEdit ? 'Editar rutina' : 'Nueva rutina personalizada'}</h3>
            <p class="text-xs text-gray-400">${isEdit ? 'Cambia el nombre, subtítulo o color identificativo.' : 'Crea un día o bloque propio (ej. Torso A, Full Body, Brazo…).'}</p>
          </div>
          <button type="button" data-act="closeModal" aria-label="Cerrar modal" class="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white">${icon('close', 'h-4 w-4')}</button>
        </div>

        <label class="block">
          <span class="lbl">Nombre de la rutina</span>
          <input id="rtModalName" class="inp" name="name" maxlength="40" value="${esc(rm.name)}" placeholder="Ej. Torso A" required>
        </label>

        <label class="block">
          <span class="lbl">Subtítulo corto (opcional)</span>
          <input class="inp" name="sub" maxlength="40" value="${esc(rm.sub)}" placeholder="Ej. Empuje, Fuerza, Cadena post.">
        </label>

        <fieldset class="space-y-2">
          <legend class="lbl">Color</legend>
          <div class="flex flex-wrap gap-2.5">
            ${ROUTINE_COLORS.map((c) => `
              <label class="cursor-pointer">
                <input type="radio" name="color" value="${c}" ${c === rm.color ? 'checked' : ''} class="sr-only peer">
                <span class="block h-7 w-7 rounded-full border border-white/20 transition-transform peer-checked:scale-110 peer-checked:ring-2 peer-checked:ring-white peer-checked:ring-offset-2 peer-checked:ring-offset-[#0F1624]" style="background:${c}"></span>
              </label>`).join('')}
          </div>
        </fieldset>

        <div class="flex items-center justify-end gap-2 border-t border-white/10 pt-3">
          <button type="button" class="btn" data-act="closeModal">Cancelar</button>
          <button type="submit" class="btn-primary">${icon('save', 'h-4 w-4')} ${isEdit ? 'Guardar cambios' : 'Crear rutina'}</button>
        </div>
      </form>
    </div>`;
  }

  return '';
}

/**
 * Renderiza la vista de planificación de rutinas, fases y biblioteca muscular de ejercicios.
 *
 * @param S - Estado global de la aplicación.
 * @returns HTML completo de la pestaña `Plan y rutinas`.
 */
export function viewPlan(S: State): string {
  const s = S.settings;
  const tab = S.planTab ?? 'routines';
  const routines = routineNames(s);
  const known = [...new Set([...allExerciseNames(S), ...S.analysis.exercises.keys()])].sort((a, b) => a.localeCompare(b, 'es'));
  const names = allExerciseNames(S);
  const unmappedCount = S.analysis.unmapped.length;

  const header = `
  <div class="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
    <div>
      <h2 class="text-lg font-extrabold text-white">Planificación y catálogo</h2>
      <p class="text-xs text-gray-400">Crea tus propias rutinas o usa una plantilla, define fases del bloque y gestiona los ejercicios.</p>
    </div>
    <div role="tablist" aria-label="Secciones de planificación" class="inline-flex rounded-xl border border-white/10 bg-gray-900/70 p-1 gap-1">
      <button role="tab" aria-selected="${tab === 'routines'}" data-act="planTab" data-arg="routines" class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${tab === 'routines' ? 'bg-electricBlue text-white' : 'text-gray-400 hover:text-white'}">Rutinas y fases</button>
      <button role="tab" aria-selected="${tab === 'exercises'}" data-act="planTab" data-arg="exercises" class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${tab === 'exercises' ? 'bg-electricBlue text-white' : 'text-gray-400 hover:text-white'}">
        <span>Ejercicios y músculos</span>
        ${unmappedCount > 0 ? `<span class="rounded-full bg-amberGold/20 px-1.5 py-0.5 tabular-nums text-[11px] font-bold text-amberGold">${unmappedCount}</span>` : ''}
      </button>
    </div>
  </div>`;

  if (tab === 'exercises') {
    return `${header}
    ${unmappedCount ? `<div class="rounded-2xl border border-amberGold/40 bg-amberGold/5 p-4 space-y-2"><h3 class="font-bold text-white">Ejercicios de Samsung sin nombre (${unmappedCount})</h3>
      <p class="text-xs text-gray-300">Samsung Health no exporta el nombre de algunos ejercicios integrados. Asígnales nombre (si coincide con uno existente, se fusionan).</p>
      <div class="grid grid-cols-1 gap-2 xl:grid-cols-2 xl:gap-x-6">
        ${S.analysis.unmapped.sort((a, b) => b.last.localeCompare(a.last)).map((u) => `<div class="flex items-center gap-2 text-sm"><span class="w-40 shrink-0 tabular-nums text-gray-400">${esc(u.ref)} · ${u.n}× · ${fmtDate(u.last)}</span><input class="inp" list="exnames" placeholder="Nombre del ejercicio…" data-change="refName" data-arg="${esc(u.ref)}" aria-label="Nombre para ${esc(u.ref)}"></div>`).join('')}
      </div>
      <datalist id="exnames">${names.map((n) => `<option value="${esc(n)}">`).join('')}</datalist></div>` : ''}

    <div class="pb-5 border-b border-white/10 space-y-3"><h3 class="font-bold text-white">Fusionar ejercicios (alias)</h3>
      <p class="text-xs text-gray-400">Une el histórico de un ejercicio con otro si cambiaste de máquina o nombre.</p>
      <div class="flex flex-wrap items-center gap-2">
        <select id="mergeFrom" class="inp !w-auto" aria-label="Ejercicio origen a fusionar">${sel('', known)}</select>
        <span aria-hidden="true">→</span>
        <select id="mergeTo" class="inp !w-auto" aria-label="Ejercicio destino">${sel('', known)}</select>
        <button class="btn" data-act="merge">Fusionar</button>
      </div>
      ${Object.entries(s.aliases).map(([a, b]) => `<div class="flex items-center gap-2 text-xs text-gray-400"><span>${esc(a)} → ${esc(b)}</span><button class="rounded p-0.5 text-coralRed hover:bg-coralRed/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" data-act="unmerge" data-arg="${esc(a)}" aria-label="Deshacer fusión ${esc(a)}">${icon('close', 'h-3.5 w-3.5')}</button></div>`).join('')}
    </div>

    <div class="space-y-3 overflow-x-auto">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 class="font-bold text-white">Músculos por ejercicio (${names.length})</h3>
          <p class="text-xs text-gray-400">Músculo principal = 1 serie efectiva; secundarios (separados por coma) = 0,5 series.</p>
        </div>
        <button class="btn !border-electricBlue/40 !py-1.5 !text-xs text-blue-300" data-act="openExModal" data-arg="">+ Nuevo ejercicio</button>
      </div>
      <div class="grid grid-cols-1 gap-2.5 xl:grid-cols-2 xl:gap-x-6">
        ${names.map((n) => { const m = musclesOf(n, s); return `<div class="flex items-center gap-2 text-sm"><span class="w-44 shrink-0 truncate" title="${esc(n)}">${esc(n)}</span>
          <select class="inp !w-32" data-change="musP" data-arg="${esc(n)}" aria-label="Músculo principal de ${esc(n)}">${sel(m?.p ?? '', MUSCLES)}</select>
          <input class="inp min-w-0 flex-1" placeholder="Ej. Tríceps, Hombro…" value="${esc(m?.s.join(', ') ?? '')}" data-change="musS" data-arg="${esc(n)}" aria-label="Músculos secundarios de ${esc(n)}"></div>`; }).join('')}
      </div>
    </div>`;
  }

  return `${header}
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 class="font-bold text-white">Rutinas y objetivos (series × reps)</h3>
        <p class="text-xs text-gray-400">Define tus días de entrenamiento y objetivos, o aplica una plantilla rápida.</p>
      </div>
      <button class="btn-primary !py-1.5 !text-xs" data-act="rtModalNew">+ Nueva rutina</button>
    </div>

    <div class="flex flex-wrap items-center gap-1.5 text-xs">
      <span class="font-semibold text-gray-400">Plantillas rápidas:</span>
      ${Object.entries(ROUTINE_TEMPLATES).map(([k, tpl]) => `<button type="button" data-act="rtApplyTpl" data-arg="${k}" title="${esc(tpl.desc)}" class="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 font-medium text-gray-300 hover:border-electricBlue/50 hover:text-white transition-colors">${esc(tpl.label)}</button>`).join('')}
    </div>

    <div class="grid grid-cols-1 gap-5 xl:grid-cols-2">
      ${routines.map((d, idx) => {
        const col = routineColor(d, s, idx);
        const sub = s.routineMeta?.[d]?.sub;
        const list = s.routines[d] ?? [];
        return `
        <div class="rounded-2xl border border-white/10 bg-cardDark/60 p-4">
          <div class="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <h4 class="flex items-center gap-2 text-sm font-bold min-w-0" style="color:${col}">
              <span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:${col}" aria-hidden="true"></span>
              <span class="truncate">${esc(d)}</span>
              ${sub ? `<span class="text-xs font-normal text-gray-400 truncate">· ${esc(sub)}</span>` : ''}
            </h4>
            <div class="flex items-center gap-1">
              <button class="text-xs font-semibold text-gray-400 hover:text-white px-1.5 py-0.5 rounded" data-act="tab" data-arg="${esc(d)}">Detalle →</button>
              <button class="rounded p-1 text-gray-400 hover:bg-white/5 hover:text-white" data-act="rtModalEdit" data-arg="${esc(d)}" aria-label="Editar rutina ${esc(d)}">${icon('edit', 'h-3.5 w-3.5')}</button>
              <button class="rounded p-1 text-coralRed hover:bg-coralRed/10 disabled:opacity-30 disabled:pointer-events-none" data-act="rtRemoveDay" data-arg="${esc(d)}" ${routines.length <= 1 ? 'disabled' : ''} aria-label="Eliminar rutina ${esc(d)}">${icon('trash', 'h-3.5 w-3.5')}</button>
            </div>
          </div>
          <div data-sort-list="rt:${esc(d)}" class="space-y-1.5">
            ${list.map((r, i) => `<div data-sort-item data-sort-idx="${i}" class="flex items-center gap-1 rounded-xl bg-white/[0.02] px-1 py-0.5 transition-shadow">
              <button type="button" data-sort-handle class="shrink-0 touch-none cursor-grab active:cursor-grabbing select-none rounded p-1 text-gray-500 hover:bg-white/5 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" aria-label="Arrastrar ${esc(r.name || `ejercicio ${i + 1}`)} en ${esc(d)}" title="Arrastrar para reordenar">${icon('grip', 'h-3.5 w-3.5')}</button>
              <select class="inp min-w-0 flex-1" data-change="rtName" data-arg="${esc(d)}|${i}" aria-label="Ejercicio ${i + 1} de ${esc(d)}">${sel(r.name, [...new Set([...names, r.name].filter(Boolean))])}<option value="__new__">+ Crear nuevo ejercicio…</option></select>
              <input class="inp !w-12 !px-1.5 text-center font-semibold tabular-nums" type="number" min="1" value="${esc(r.sets)}" data-change="rtSets" data-arg="${esc(d)}|${i}" aria-label="Series objetivo de ${esc(r.name || `ejercicio ${i + 1}`)}"><span class="text-gray-500" aria-hidden="true">×</span>
              <input class="inp !w-12 !px-1.5 text-center font-semibold tabular-nums" type="number" min="1" value="${esc(r.reps)}" data-change="rtReps" data-arg="${esc(d)}|${i}" aria-label="Repeticiones objetivo de ${esc(r.name || `ejercicio ${i + 1}`)}">
              <div class="flex shrink-0 items-center">
                <button type="button" class="rounded p-1 text-gray-500 hover:bg-white/5 hover:text-white disabled:opacity-25 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" data-act="rtMove" data-arg="${esc(d)}|${i}|-1" ${i === 0 ? 'disabled' : ''} aria-label="Subir ${esc(r.name || `ejercicio ${i + 1}`)} en ${esc(d)}" title="Subir">${icon('caretUp', 'h-3.5 w-3.5')}</button>
                <button type="button" class="rounded p-1 text-gray-500 hover:bg-white/5 hover:text-white disabled:opacity-25 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" data-act="rtMove" data-arg="${esc(d)}|${i}|1" ${i === list.length - 1 ? 'disabled' : ''} aria-label="Bajar ${esc(r.name || `ejercicio ${i + 1}`)} en ${esc(d)}" title="Bajar">${icon('caretDown', 'h-3.5 w-3.5')}</button>
                <button class="rounded-lg p-1 text-coralRed hover:bg-coralRed/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" data-act="rtDel" data-arg="${esc(d)}|${i}" aria-label="Eliminar ${esc(r.name || `ejercicio ${i + 1}`)} de ${esc(d)}">${icon('close', 'h-4 w-4')}</button>
              </div>
            </div>`).join('')}
          </div>
          <div class="mt-2.5 flex flex-wrap gap-2">
            <button class="btn !py-1.5 !text-xs" data-act="rtAdd" data-arg="${esc(d)}">+ Añadir fila</button>
            <button class="btn !border-electricBlue/40 !py-1.5 !text-xs text-blue-300" data-act="openExModal" data-arg="${esc(d)}">+ Crear ejercicio</button>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>

  <div class="pt-5 border-t border-white/10 space-y-3">
    <div>
      <h3 class="font-bold text-white">Fases nutricionales y de entrenamiento</h3>
      <p class="text-xs text-gray-400">Permite contextualizar la evolución del peso y el informe de IA según la etapa (definición, mantenimiento, volumen…).</p>
    </div>
    ${s.phases.length ? `<div class="space-y-1.5">${[...s.phases].sort((a, b) => a.start.localeCompare(b.start)).map((p, i) => `<div class="flex items-center gap-2 text-sm"><b>${esc(p.name)}</b> <span class="tabular-nums text-gray-400">desde ${fmtDate(p.start)}</span> <button class="rounded p-0.5 text-coralRed hover:bg-coralRed/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" data-act="phaseDel" data-arg="${i}" aria-label="Borrar fase ${esc(p.name)}">${icon('close', 'h-3.5 w-3.5')}</button></div>`).join('')}</div>` : ''}
    <form id="f-phase" class="flex flex-wrap gap-2"><input class="inp !w-44" name="name" placeholder="Nombre (p. ej. Lean bulk)…" aria-label="Nombre de la fase" required><input class="inp !w-40" type="date" name="start" aria-label="Fecha de inicio de la fase" required><button class="btn" type="submit">Añadir fase</button></form>
  </div>`;
}
