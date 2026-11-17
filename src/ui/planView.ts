import { musclesOf } from '../lib/analysis';
import { MUSCLES, ROUTINE_COLORS, ROUTINE_TEMPLATES } from '../lib/seed';
import type { Settings } from '../types';
import { icon } from './icons';
import { allExerciseNames } from './logView';
import { esc, fmtDate, routineColor, routineNames, type State } from './shared';
import { renderWizardModal } from './wizardView';

/** Calcula las series efectivas semanales planificadas por músculo según `settings.routines`. */
export function plannedWeeklyVolume(s: Settings): Map<string, number> {
  const out = new Map<string, number>(MUSCLES.map((m) => [m, 0]));
  for (const r of routineNames(s)) {
    for (const item of s.routines[r] ?? []) {
      if (!item.name || !(item.sets > 0)) continue;
      const m = musclesOf(item.name, s);
      if (!m) continue;
      out.set(m.p, (out.get(m.p) ?? 0) + item.sets);
      for (const sec of m.s) {
        out.set(sec, (out.get(sec) ?? 0) + item.sets * 0.5);
      }
    }
  }
  return out;
}

const sel = (name: string, opts: string[]) =>
  `<option value="" ${name ? '' : 'selected'}>—</option>${opts.map((o) => `<option ${o === name ? 'selected' : ''}>${esc(o)}</option>`).join('')}`;

/** Renderiza los modales activos de creación de ejercicios, rutinas y confirmaciones. */
export function renderModals(S: State): string {
  if (S.confirmModal) {
    const cm = S.confirmModal;
    return `<div id="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirmModalTitle" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-black/80" data-act="confirmNo" aria-hidden="true"></div>
      <div class="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-modalDark p-5 shadow-2xl space-y-4">
        <div class="flex items-start gap-3">
          ${cm.danger ? `<div class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-coralRed/15 text-coralRed">${icon('warn', 'h-5 w-5')}</div>` : ''}
          <div class="min-w-0 flex-1">
            <h3 id="confirmModalTitle" class="text-base font-extrabold text-white">${esc(cm.title)}</h3>
            <p class="mt-1 text-sm text-gray-300 leading-relaxed">${esc(cm.message)}</p>
          </div>
        </div>
        <div class="flex justify-end gap-2 border-t border-white/10 pt-3">
          <button type="button" class="btn" data-act="confirmNo">Cancelar</button>
          <button type="button" class="${cm.danger ? 'btn btn-danger-solid' : 'btn-primary'}" data-act="confirmYes">${esc(cm.confirmLabel ?? 'Confirmar')}</button>
        </div>
      </div>
    </div>`;
  }
  if (S.wizard) return renderWizardModal(S);
  if (S.workoutSummary) {
    const ws = S.workoutSummary;
    const tonnageLabel = ws.tonnageKg >= 1000 ? `${(ws.tonnageKg / 1000).toFixed(1).replace('.', ',')} t` : `${Math.round(ws.tonnageKg)} kg`;
    return `<div id="workout-summary-modal" role="dialog" aria-modal="true" aria-labelledby="workoutSummaryTitle" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-black/80" data-act="closeWorkoutSummary" aria-hidden="true"></div>
      <div class="relative z-10 w-full max-w-md rounded-2xl border border-emeraldGreen/35 bg-modalDark p-5 shadow-2xl space-y-4">
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emeraldGreen/15 text-emeraldGreen">${icon('check', 'h-6 w-6')}</div>
            <div>
              <h3 id="workoutSummaryTitle" class="text-lg font-extrabold text-white">¡Entreno completado!</h3>
              <p class="text-xs text-gray-400">${esc(ws.day === 'Libre' ? 'Entreno libre' : ws.day)} · ${ws.durationMin} min</p>
            </div>
          </div>
          <button type="button" data-act="closeWorkoutSummary" aria-label="Cerrar resumen" class="icon-btn">${icon('close', 'h-4 w-4')}</button>
        </div>

        <div class="grid grid-cols-3 divide-x divide-white/10 rounded-xl border border-white/10 bg-white/[0.02] py-3 text-center">
          <div class="px-2"><span class="block text-[11px] text-gray-400">Ejercicios</span><span class="tabular-nums text-lg font-extrabold text-white">${ws.exercises}</span></div>
          <div class="px-2"><span class="block text-[11px] text-gray-400">Series</span><span class="tabular-nums text-lg font-extrabold text-emeraldGreen">${ws.sets}</span></div>
          <div class="px-2"><span class="block text-[11px] text-gray-400">Volumen</span><span class="tabular-nums text-lg font-extrabold text-electricBlue">${esc(tonnageLabel)}</span></div>
        </div>

        ${ws.prNames.length ? `<div class="rounded-xl border border-emeraldGreen/30 bg-emeraldGreen/10 p-3 space-y-1">
          <p class="text-xs font-bold text-emerald-300">Nuevas marcas personales (${ws.prNames.length})</p>
          <p class="text-xs text-gray-200">${esc(ws.prNames.slice(0, 4).join(' · '))}${ws.prNames.length > 4 ? ` y ${ws.prNames.length - 4} más` : ''}</p>
        </div>` : `<p class="text-xs text-gray-400">Buen trabajo: sesión guardada en tu historial y lista para analizar tu progreso.</p>`}

        <div class="flex justify-end pt-1">
          <button type="button" class="btn-primary w-full sm:w-auto" data-act="closeWorkoutSummary">Continuar</button>
        </div>
      </div>
    </div>`;
  }
  if (S.exModal) {
    const routines = routineNames(S.settings);
    const target = S.exModal.routine ?? '';
    return `<div id="ex-modal" role="dialog" aria-modal="true" aria-labelledby="exModalTitle" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-black/80" data-act="closeModal" aria-hidden="true"></div>
      <form id="f-new-ex" class="relative z-10 w-full max-w-lg rounded-2xl border border-white/10 bg-modalDark p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between gap-2">
          <div>
            <h3 id="exModalTitle" class="text-base font-extrabold text-white">Crear nuevo ejercicio</h3>
            <p class="text-xs text-gray-400">Se añadirá a tu biblioteca muscular y podrás asignarlo a una rutina.</p>
          </div>
          <button type="button" data-act="closeModal" aria-label="Cerrar modal" class="icon-btn">${icon('close', 'h-4 w-4')}</button>
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
      <div class="fixed inset-0 bg-black/80" data-act="closeModal" aria-hidden="true"></div>
      <form id="f-routine-meta" class="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-modalDark p-5 shadow-2xl space-y-4">
        <div class="flex items-center justify-between gap-2">
          <div>
            <h3 id="rtModalTitle" class="text-base font-extrabold text-white">${isEdit ? 'Editar rutina' : 'Nueva rutina personalizada'}</h3>
            <p class="text-xs text-gray-400">${isEdit ? 'Cambia el nombre, subtítulo o color identificativo.' : 'Crea un día o bloque propio (ej. Torso A, Full Body, Brazo…).'}</p>
          </div>
          <button type="button" data-act="closeModal" aria-label="Cerrar modal" class="icon-btn">${icon('close', 'h-4 w-4')}</button>
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
          <div class="flex flex-wrap gap-1.5 sm:gap-2.5">
            ${ROUTINE_COLORS.map((c) => `
              <label class="inline-flex h-11 w-11 sm:h-8 sm:w-8 cursor-pointer items-center justify-center rounded-full">
                <input type="radio" name="color" value="${c}" ${c === rm.color ? 'checked' : ''} class="sr-only peer">
                <span class="block h-7 w-7 rounded-full border border-white/20 transition-transform peer-checked:scale-110 peer-checked:ring-2 peer-checked:ring-white peer-checked:ring-offset-2 peer-checked:ring-offset-modalDark" style="background:${c}"></span>
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

  if (S.noteModal) {
    const nm = S.noteModal;
    return `<div id="note-modal" role="dialog" aria-modal="true" aria-labelledby="noteModalTitle" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-black/80" data-act="closeModal" aria-hidden="true"></div>
      <form id="f-note-modal" class="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-modalDark p-5 shadow-2xl space-y-4">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0">
            <h3 id="noteModalTitle" class="text-base font-extrabold text-white">Nota fija del ejercicio</h3>
            <p class="text-xs text-gray-400 truncate" title="${esc(nm.exName)}">${esc(nm.exName)}</p>
          </div>
          <button type="button" data-act="closeModal" aria-label="Cerrar modal" class="icon-btn">${icon('close', 'h-4 w-4')}</button>
        </div>
        <label class="block">
          <span class="lbl">Ajustes de máquina, asiento, agarre o consejos de técnica</span>
          <textarea id="noteModalInput" class="inp min-h-[96px] resize-y" name="note" maxlength="400" placeholder="Ej. Asiento en 4, agarre neutro, pausa 1s abajo…">${esc(nm.value)}</textarea>
        </label>
        <div class="flex items-center justify-end gap-2 border-t border-white/10 pt-3">
          <button type="button" class="btn" data-act="closeModal">Cancelar</button>
          <button type="submit" class="btn-primary">${icon('save', 'h-4 w-4')} Guardar nota</button>
        </div>
      </form>
    </div>`;
  }

  return '';
}

/** Renderiza el contador y la lista filtrada del catálogo rápido de ejercicios para parcheo selectivo. */
export function renderPlanCatalogResults(S: State): { countText: string; listHtml: string } {
  const s = S.settings;
  const routines = routineNames(s);
  const targetRoutine = S.planTargetRoutine && routines.includes(S.planTargetRoutine) ? S.planTargetRoutine : (routines[0] ?? '');
  const names = allExerciseNames(S);
  const q = (S.planSearch ?? '').trim().toLowerCase();
  const catalogMatches = names.filter((n) => {
    if (!q) return true;
    if (n.toLowerCase().includes(q)) return true;
    const m = musclesOf(n, s);
    return m ? m.p.toLowerCase().includes(q) || m.s.some((sec) => sec.toLowerCase().includes(q)) : false;
  });
  const listHtml = catalogMatches.length
    ? catalogMatches.slice(0, 12).map((n) => {
        const m = musclesOf(n, s);
        return `<div class="flex items-center justify-between gap-2 py-2">
          <div class="min-w-0">
            <div class="truncate text-sm font-medium text-gray-100" title="${esc(n)}">${esc(n)}</div>
            ${m ? `<div class="truncate text-[11px] text-gray-400">${esc(m.p)}${m.s.length ? ` · ${esc(m.s.join(', '))}` : ''}</div>` : ''}
          </div>
          <button type="button" class="btn-sm shrink-0" data-act="rtQuickAdd" data-arg="${esc(targetRoutine)}|${esc(n)}" ${targetRoutine ? '' : 'disabled'}>+ Añadir</button>
        </div>`;
      }).join('')
    : `<p class="py-3 text-center text-xs text-gray-400">Sin resultados para «${esc(S.planSearch ?? '')}».</p>`;
  return { countText: `${catalogMatches.length}/${names.length}`, listHtml };
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
      <button role="tab" aria-selected="${tab === 'routines'}" data-act="planTab" data-arg="routines" class="inline-flex min-h-[44px] sm:min-h-[34px] items-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${tab === 'routines' ? 'bg-electricBlue text-white' : 'text-gray-400 hover:text-white'}">Rutinas y fases</button>
      <button role="tab" aria-selected="${tab === 'exercises'}" data-act="planTab" data-arg="exercises" class="inline-flex min-h-[44px] sm:min-h-[34px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${tab === 'exercises' ? 'bg-electricBlue text-white' : 'text-gray-400 hover:text-white'}">
        <span>Ejercicios y músculos</span>
        ${unmappedCount > 0 ? `<span class="rounded-full bg-amberGold/20 px-1.5 py-0.5 tabular-nums text-[11px] font-bold text-amberGold">${unmappedCount}</span>` : ''}
      </button>
    </div>
  </div>`;

  if (tab === 'exercises') {
    return `${header}
    ${unmappedCount ? `<div class="rounded-2xl border border-amberGold/40 bg-amberGold/5 p-4 space-y-2"><h3 class="font-bold text-white">Ejercicios importados sin nombre (${unmappedCount})</h3>
      <p class="text-xs text-gray-300">Algunos ejercicios importados solo tienen código numérico. Asígnales nombre (si coincide con uno existente, se unifican).</p>
      <div class="grid grid-cols-1 gap-2 xl:grid-cols-2 xl:gap-x-6">
        ${S.analysis.unmapped.sort((a, b) => b.last.localeCompare(a.last)).map((u) => `<div class="flex items-center gap-2 text-sm"><span class="w-40 shrink-0 tabular-nums text-gray-400">${esc(u.ref)} · ${u.n}× · ${fmtDate(u.last)}</span><input class="inp" list="exnames" placeholder="Nombre del ejercicio…" data-change="refName" data-arg="${esc(u.ref)}" aria-label="Nombre para ${esc(u.ref)}"></div>`).join('')}
      </div>
      <datalist id="exnames">${names.map((n) => `<option value="${esc(n)}">`).join('')}</datalist></div>` : ''}

    <div class="pb-5 border-b border-white/10 space-y-3"><h3 class="font-bold text-white">Unificar ejercicios duplicados</h3>
      <p class="text-xs text-gray-400">Une el histórico de un ejercicio con otro si cambiaste de máquina o nombre.</p>
      <div class="flex flex-wrap items-center gap-2">
        <select id="mergeFrom" class="inp w-auto" aria-label="Ejercicio origen a fusionar">${sel('', known)}</select>
        <span aria-hidden="true">→</span>
        <select id="mergeTo" class="inp w-auto" aria-label="Ejercicio destino">${sel('', known)}</select>
        <button class="btn" data-act="merge">Fusionar</button>
      </div>
      ${Object.entries(s.aliases).map(([a, b]) => `<div class="flex items-center gap-2 text-xs text-gray-400"><span>${esc(a)} → ${esc(b)}</span><button class="icon-btn text-coralRed hover:bg-coralRed/10" data-act="unmerge" data-arg="${esc(a)}" aria-label="Deshacer fusión ${esc(a)}">${icon('close', 'h-3.5 w-3.5')}</button></div>`).join('')}
    </div>

    <div class="space-y-3 overflow-x-auto">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 class="font-bold text-white">Músculos por ejercicio (${names.length})</h3>
          <p class="text-xs text-gray-400">Músculo principal = 1 serie efectiva; secundarios (separados por coma) = 0,5 series.</p>
        </div>
        <button class="btn-sm btn-accent" data-act="openExModal" data-arg="">+ Nuevo ejercicio</button>
      </div>
      <div class="grid grid-cols-1 gap-2.5 xl:grid-cols-2 xl:gap-x-6">
        ${names.map((n) => { const m = musclesOf(n, s); return `<div class="flex items-center gap-2 text-sm"><span class="w-44 shrink-0 truncate" title="${esc(n)}">${esc(n)}</span>
          <select class="inp w-32" data-change="musP" data-arg="${esc(n)}" aria-label="Músculo principal de ${esc(n)}">${sel(m?.p ?? '', MUSCLES)}</select>
          <input class="inp min-w-0 flex-1" placeholder="Ej. Tríceps, Hombros…" value="${esc(m?.s.join(', ') ?? '')}" data-change="musS" data-arg="${esc(n)}" aria-label="Músculos secundarios de ${esc(n)}"></div>`; }).join('')}
      </div>
    </div>`;
  }

  const volMap = plannedWeeklyVolume(s);
  const totalPlannedSets = routines.reduce(
    (acc, d) => acc + (s.routines[d] ?? []).reduce((sum, item) => sum + (item.name ? item.sets : 0), 0),
    0,
  );
  const targetRoutine = S.planTargetRoutine && routines.includes(S.planTargetRoutine) ? S.planTargetRoutine : (routines[0] ?? '');
  const catalogRes = renderPlanCatalogResults(S);
  const volRows = MUSCLES.map((m) => {
    const v = volMap.get(m) ?? 0;
    const labelV = v % 1 === 0 ? String(v) : v.toFixed(1).replace('.', ',');
    const textCol = v === 0 ? 'text-gray-400' : v < 8 ? 'text-coralRed' : v <= 20 ? 'text-emeraldGreen' : 'text-amberGold';
    const barCol = v === 0 ? 'bg-white/10' : v < 8 ? 'bg-coralRed' : v <= 20 ? 'bg-emeraldGreen' : 'bg-amberGold';
    const pct = Math.min(100, Math.round((v / 22) * 100));
    return `<div class="grid grid-cols-[96px_1fr_40px] items-center gap-2 text-xs">
      <span class="truncate text-gray-200">${esc(m)}</span>
      <div class="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]"><div class="h-full rounded-full ${barCol}" style="width:${pct}%"></div></div>
      <span class="text-right tabular-nums font-bold ${textCol}">${labelV}</span>
    </div>`;
  }).join('');

  return `${header}
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
    <div class="lg:col-span-8 space-y-6">
      <div class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="font-bold text-white">Rutinas y objetivos (series × reps)</h3>
            <p class="text-xs text-gray-400">Define tus días de entrenamiento y objetivos, o aplica una plantilla rápida.</p>
          </div>
          <button class="btn-primary-sm" data-act="rtModalNew">+ Nueva rutina</button>
        </div>

        <div class="flex flex-wrap items-center gap-1.5 text-xs">
          <span class="font-semibold text-gray-400">Plantillas rápidas:</span>
          ${Object.entries(ROUTINE_TEMPLATES).map(([k, tpl]) => `<button type="button" data-act="rtApplyTpl" data-arg="${k}" title="${esc(tpl.desc)}" class="inline-flex min-h-[44px] sm:min-h-[34px] items-center rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1 font-medium text-gray-300 hover:border-electricBlue/50 hover:text-white transition-colors">${esc(tpl.label)}</button>`).join('')}
        </div>

        <div class="grid grid-cols-1 gap-4">
          ${routines.map((d, idx) => {
            const col = routineColor(d, s, idx);
            const sub = s.routineMeta?.[d]?.sub;
            const list = s.routines[d] ?? [];
            return `
            <div class="border-b border-white/10 pb-4">
              <div class="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                <h4 class="flex items-center gap-2 text-sm font-bold min-w-0" style="color:${col}">
                  <span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:${col}" aria-hidden="true"></span>
                  <span class="truncate">${esc(d)}</span>
                  ${sub ? `<span class="text-xs font-normal text-gray-400 truncate">· ${esc(sub)}</span>` : ''}
                </h4>
                <div class="flex items-center gap-1">
                  <button class="inline-flex min-h-[44px] sm:min-h-[34px] items-center rounded-lg px-2.5 text-xs font-semibold text-gray-300 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" data-act="tab" data-arg="${esc(d)}">Detalle →</button>
                  <button class="icon-btn" data-act="rtModalEdit" data-arg="${esc(d)}" aria-label="Editar rutina ${esc(d)}">${icon('edit', 'h-3.5 w-3.5')}</button>
                  <button class="icon-btn text-coralRed hover:bg-coralRed/10" data-act="rtRemoveDay" data-arg="${esc(d)}" ${routines.length <= 1 ? 'disabled' : ''} aria-label="Eliminar rutina ${esc(d)}">${icon('trash', 'h-3.5 w-3.5')}</button>
                </div>
              </div>
              <div data-sort-list="rt:${esc(d)}" class="space-y-1.5">
                ${list.map((r, i) => `<div data-sort-item data-sort-idx="${i}" class="flex flex-col sm:flex-row sm:items-center gap-1.5 rounded-xl bg-white/[0.02] p-1.5 sm:px-1.5 sm:py-1 transition-shadow">
                  <div class="flex min-w-0 flex-1 items-center gap-1.5">
                    <button type="button" data-sort-handle class="icon-btn touch-none cursor-grab active:cursor-grabbing select-none" aria-label="Arrastrar ${esc(r.name || `ejercicio ${i + 1}`)} en ${esc(d)}" title="Arrastrar para reordenar">${icon('grip', 'h-3.5 w-3.5')}</button>
                    <select class="inp min-w-0 flex-1" data-change="rtName" data-arg="${esc(d)}|${i}" aria-label="Ejercicio ${i + 1} de ${esc(d)}">${sel(r.name, [...new Set([...names, r.name].filter(Boolean))])}<option value="__new__">+ Crear nuevo ejercicio…</option></select>
                  </div>
                  <div class="flex shrink-0 items-center justify-end gap-1 pl-6 sm:pl-0">
                    <input class="inp w-12 px-1.5 text-center font-semibold tabular-nums" type="number" min="1" value="${esc(r.sets)}" data-change="rtSets" data-arg="${esc(d)}|${i}" aria-label="Series objetivo de ${esc(r.name || `ejercicio ${i + 1}`)}"><span class="text-gray-400" aria-hidden="true">×</span>
                    <input class="inp w-12 px-1.5 text-center font-semibold tabular-nums" type="number" min="1" value="${esc(r.reps)}" data-change="rtReps" data-arg="${esc(d)}|${i}" aria-label="Repeticiones objetivo de ${esc(r.name || `ejercicio ${i + 1}`)}">
                    <div class="flex shrink-0 items-center">
                      <button type="button" class="icon-btn" data-act="rtMove" data-arg="${esc(d)}|${i}|-1" ${i === 0 ? 'disabled' : ''} aria-label="Subir ${esc(r.name || `ejercicio ${i + 1}`)} en ${esc(d)}" title="Subir">${icon('caretUp', 'h-3.5 w-3.5')}</button>
                      <button type="button" class="icon-btn" data-act="rtMove" data-arg="${esc(d)}|${i}|1" ${i === list.length - 1 ? 'disabled' : ''} aria-label="Bajar ${esc(r.name || `ejercicio ${i + 1}`)} en ${esc(d)}" title="Bajar">${icon('caretDown', 'h-3.5 w-3.5')}</button>
                      <button type="button" class="icon-btn text-coralRed hover:bg-coralRed/10" data-act="rtDel" data-arg="${esc(d)}|${i}" aria-label="Eliminar ${esc(r.name || `ejercicio ${i + 1}`)} de ${esc(d)}">${icon('close', 'h-4 w-4')}</button>
                    </div>
                  </div>
                </div>`).join('')}
              </div>
              <div class="mt-2.5 flex flex-wrap gap-2">
                <button class="btn-sm" data-act="rtAdd" data-arg="${esc(d)}">+ Añadir fila</button>
                <button class="btn-sm btn-accent" data-act="openExModal" data-arg="${esc(d)}">+ Crear ejercicio</button>
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
        ${s.phases.length ? `<div class="space-y-1.5">${[...s.phases].sort((a, b) => a.start.localeCompare(b.start)).map((p, i) => `<div class="flex items-center gap-2 text-sm"><b>${esc(p.name)}</b> <span class="tabular-nums text-gray-400">desde ${fmtDate(p.start)}</span> <button class="icon-btn text-coralRed hover:bg-coralRed/10" data-act="phaseDel" data-arg="${i}" aria-label="Borrar fase ${esc(p.name)}">${icon('close', 'h-3.5 w-3.5')}</button></div>`).join('')}</div>` : ''}
        <form id="f-phase" class="flex flex-wrap gap-2"><input class="inp w-44" name="name" placeholder="Ej. Volumen, Definición, Mantenimiento…" aria-label="Nombre de la fase" required><input class="inp w-40" type="date" name="start" aria-label="Fecha de inicio de la fase" required><button class="btn" type="submit">Añadir fase</button></form>
      </div>
    </div>

    <aside class="lg:col-span-4 lg:sticky lg:top-6 space-y-5">
      <div class="rounded-2xl border border-white/10 bg-cardDark p-4 space-y-3">
        <div class="flex items-baseline justify-between gap-2">
          <h3 class="text-sm font-bold text-white">Simulador de volumen semanal</h3>
          <span class="tabular-nums text-xs font-semibold text-gray-400">${totalPlannedSets} series</span>
        </div>
        <p class="text-[11px] text-gray-400">Principal = 1, secundario = 0,5 · <span class="text-coralRed">&lt;8</span> · <span class="text-emeraldGreen">8–20</span> · <span class="text-amberGold">&gt;20</span></p>
        <div class="space-y-1.5">${volRows}</div>
      </div>

      <div class="rounded-2xl border border-white/10 bg-cardDark p-4 space-y-3">
        <div class="flex items-baseline justify-between gap-2">
          <h3 class="text-sm font-bold text-white">Catálogo rápido</h3>
          <span id="planCatalogCount" class="tabular-nums text-xs text-gray-400">${catalogRes.countText}</span>
        </div>
        <label class="block">
          <span class="lbl">Rutina destino</span>
          <select class="inp" data-change="planTargetRoutine" aria-label="Rutina destino">${routines.map((d) => `<option value="${esc(d)}" ${d === targetRoutine ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select>
        </label>
        <label class="block">
          <span class="lbl">Buscar ejercicio o músculo</span>
          <input id="planExSearch" type="search" class="inp" data-input="planSearch" value="${esc(S.planSearch ?? '')}" placeholder="Ej. Press, Espalda, Bíceps…" aria-label="Buscar ejercicio o músculo">
        </label>
        <div id="planCatalogList" class="max-h-72 overflow-y-auto divide-y divide-white/[0.06]">
          ${catalogRes.listHtml}
        </div>
        <button type="button" class="btn-sm btn-accent w-full justify-center" data-act="openExModal" data-arg="${esc(targetRoutine)}">+ Crear nuevo ejercicio</button>
      </div>
    </aside>
  </div>`;
}
