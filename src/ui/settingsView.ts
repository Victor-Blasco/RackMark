import { musclesOf } from '../lib/analysis';
import { MUSCLES } from '../lib/seed';
import { DAYS } from '../types';
import { icon } from './icons';
import { DAY_COLOR, esc, fmtDate, type State } from './shared';

/**
 * Renderiza la vista de configuración, importación/exportación de datos y edición de rutinas.
 *
 * @param S - Estado global de la aplicación.
 * @returns HTML completo de la pestaña `Ajustes`.
 */
export function viewSettings(S: State): string {
  const s = S.settings;
  const known = [...S.analysis.exercises.keys()].sort();
  const sel = (name: string, opts: string[]) =>
    `<option value="" ${name ? '' : 'selected'}>—</option>${opts.map((o) => `<option ${o === name ? 'selected' : ''}>${esc(o)}</option>`).join('')}`;
  const names = known.filter((n) => !n.startsWith('Samsung #'));
  const syncWhen = S.lastSync
    ? new Date(S.lastSync).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : null;
  const cloudCard = S.user
    ? `<div class="card space-y-3"><div class="flex flex-wrap items-center justify-between gap-2">
        <div><h3 class="font-bold text-white">Cuenta y nube (Firebase)</h3>
          <p class="text-xs text-gray-300 mt-0.5">${esc(S.user.displayName ?? 'Usuario')} · <span class="text-gray-400">${esc(S.user.email ?? '')}</span></p>
          <p class="text-xs text-emerald-400 mt-0.5">${S.syncing ? 'Sincronizando…' : syncWhen ? `Última sincronización: ${esc(syncWhen)}` : 'Conectado'}</p></div>
        <div class="flex flex-wrap gap-2">
          <button class="btn" data-act="cloudSync" ${S.syncing ? 'disabled' : ''}>${icon('refresh', 'h-4 w-4')} Sincronizar ahora</button>
          <button class="btn !border-coralRed/50 text-coralRed" data-act="cloudLogout" ${S.syncing ? 'disabled' : ''}>Cerrar sesión</button></div></div></div>`
    : `<div class="card space-y-3"><div class="flex flex-wrap items-center justify-between gap-3">
        <div><h3 class="font-bold text-white">Cuenta y nube (Firebase)</h3>
          <p class="text-xs text-gray-400 mt-0.5">Inicia sesión con Google para sincronizar entrenamientos, medidas, sueño/FC y ajustes entre dispositivos.</p></div>
        <button class="btn btn-p" data-act="cloudLogin" ${S.syncing ? 'disabled' : ''}>${icon('login', 'h-4 w-4')} Iniciar sesión con Google</button></div></div>`;

  return `
  ${cloudCard}
  <div class="card space-y-3"><h3 class="font-bold text-white">Importar datos</h3>
    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
      <label class="block"><span class="lbl">Samsung Health: ZIP completo o CSV (exercise, custom_exercise, sleep, pedometer/step_daily_trend, vitality_score)</span>
        <input class="inp" type="file" accept=".zip,.csv" multiple data-file="samsung"></label>
      <label class="block"><span class="lbl">Medidas: CSV (formato de tu hoja)</span>
        <input class="inp" type="file" accept=".csv" data-file="measures"></label></div>
    <p class="text-xs text-gray-400 tabular-nums">Reimportar es seguro: se deduplica por identificador. Datos guardados: ${S.strength.length} ejercicios, ${S.cardio.length} cardio, ${S.wellbeing.length} días de sueño/pasos, ${S.measures.length} medidas.</p></div>

  <div class="card space-y-3"><h3 class="font-bold text-white">Copia de seguridad</h3><div class="flex flex-wrap gap-2">
    <button class="btn" data-act="export">${icon('download', 'h-4 w-4')} Exportar JSON</button>
    <label class="btn cursor-pointer">${icon('upload', 'h-4 w-4')} Importar JSON<input class="sr-only" type="file" accept=".json" data-file="backup"></label>
    <button class="btn !border-coralRed/50 text-coralRed" data-act="wipe">${icon('trash', 'h-4 w-4')} Borrar todo</button></div></div>

  <div class="card space-y-3"><h3 class="font-bold text-white">IA (Gemini)</h3>
    <label class="block"><span class="lbl">Clave de API de Google AI Studio</span>
      <input class="inp" type="password" placeholder="AIza…" value="${esc(s.geminiKey ?? '')}" data-change="geminiKey" autocomplete="off" spellcheck="false"></label>
    <p class="text-xs text-gray-400">Se guarda en este dispositivo (y en tu cuenta privada si inicias sesión) y se envía únicamente a Google al pulsar «Generar análisis».</p></div>

  <div class="card space-y-3"><h3 class="font-bold text-white">Rutinas y objetivos</h3>
    ${DAYS.map((d) => `<div><h4 class="mb-1 text-sm font-bold" style="color:${DAY_COLOR[d]}">${d}</h4>
      ${s.routines[d].map((r, i) => `<div class="mb-1 flex items-center gap-2"><select class="inp" data-change="rtName" data-arg="${d}|${i}" aria-label="Ejercicio ${i + 1} de ${d}">${sel(r.name, [...new Set([...names, r.name])])}</select>
        <input class="inp !w-14 font-mono tabular-nums" type="number" value="${r.sets}" data-change="rtSets" data-arg="${d}|${i}" aria-label="Series objetivo de ${esc(r.name || `ejercicio ${i + 1}`)}"><span class="text-gray-500" aria-hidden="true">×</span>
        <input class="inp !w-14 font-mono tabular-nums" type="number" value="${r.reps}" data-change="rtReps" data-arg="${d}|${i}" aria-label="Repeticiones objetivo de ${esc(r.name || `ejercicio ${i + 1}`)}">
        <button class="rounded-lg p-1 text-coralRed hover:bg-coralRed/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" data-act="rtDel" data-arg="${d}|${i}" aria-label="Eliminar ${esc(r.name || `ejercicio ${i + 1}`)} de ${d}">${icon('close', 'h-4 w-4')}</button></div>`).join('')}
      <button class="btn mt-1" data-act="rtAdd" data-arg="${d}">+ Ejercicio</button></div>`).join('')}</div>

  ${S.analysis.unmapped.length ? `<div class="card space-y-2"><h3 class="font-bold text-white">Ejercicios sin nombre</h3>
    <p class="text-xs text-gray-400">Samsung no exporta el nombre de sus ejercicios integrados. Ponles nombre (si coincide con uno existente, se fusionan).</p>
    ${S.analysis.unmapped.sort((a, b) => b.last.localeCompare(a.last)).map((u) => `<div class="flex items-center gap-2 text-sm"><span class="w-40 shrink-0 font-mono tabular-nums text-gray-400">${u.ref} · ${u.n}× · ${fmtDate(u.last)}</span><input class="inp" list="exnames" placeholder="Nombre del ejercicio…" data-change="refName" data-arg="${u.ref}" aria-label="Nombre para ${esc(u.ref)}"></div>`).join('')}
    <datalist id="exnames">${names.map((n) => `<option value="${esc(n)}">`).join('')}</datalist></div>` : ''}

  <div class="card space-y-2"><h3 class="font-bold text-white">Fusionar ejercicios</h3>
    <p class="text-xs text-gray-400">Une el histórico de un ejercicio con otro (p. ej. si renombraste una máquina).</p>
    <div class="flex flex-wrap items-center gap-2"><select id="mergeFrom" class="inp !w-auto" aria-label="Ejercicio origen a fusionar">${sel('', known)}</select><span aria-hidden="true">→</span><select id="mergeTo" class="inp !w-auto" aria-label="Ejercicio destino">${sel('', known)}</select><button class="btn" data-act="merge">Fusionar</button></div>
    ${Object.entries(s.aliases).map(([a, b]) => `<div class="flex items-center gap-2 text-xs text-gray-400"><span>${esc(a)} → ${esc(b)}</span><button class="rounded p-0.5 text-coralRed hover:bg-coralRed/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" data-act="unmerge" data-arg="${esc(a)}" aria-label="Deshacer fusión ${esc(a)}">${icon('close', 'h-3.5 w-3.5')}</button></div>`).join('')}</div>

  <div class="card space-y-2 overflow-x-auto"><h3 class="font-bold text-white">Músculos por ejercicio</h3>
    <p class="text-xs text-gray-400">Principal = 1 serie; secundarios (separados por coma) = 0,5.</p>
    ${names.map((n) => { const m = musclesOf(n, s); return `<div class="flex items-center gap-2 text-sm"><span class="w-48 shrink-0 truncate" title="${esc(n)}">${esc(n)}</span>
      <select class="inp !w-32" data-change="musP" data-arg="${esc(n)}" aria-label="Músculo principal de ${esc(n)}">${sel(m?.p ?? '', MUSCLES)}</select>
      <input class="inp" placeholder="Ej. Tríceps, Hombro…" value="${esc(m?.s.join(', ') ?? '')}" data-change="musS" data-arg="${esc(n)}" aria-label="Músculos secundarios de ${esc(n)}"></div>`; }).join('')}</div>

  <div class="card space-y-2"><h3 class="font-bold text-white">Fases</h3>
    ${[...s.phases].sort((a, b) => a.start.localeCompare(b.start)).map((p, i) => `<div class="flex items-center gap-2 text-sm"><b>${esc(p.name)}</b> <span class="tabular-nums text-gray-400">desde ${fmtDate(p.start)}</span> <button class="rounded p-0.5 text-coralRed hover:bg-coralRed/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" data-act="phaseDel" data-arg="${i}" aria-label="Borrar fase ${esc(p.name)}">${icon('close', 'h-3.5 w-3.5')}</button></div>`).join('')}
    <form id="f-phase" class="flex flex-wrap gap-2"><input class="inp !w-40" name="name" placeholder="Nombre (p. ej. Lean bulk)…" aria-label="Nombre de la fase" required><input class="inp !w-40" type="date" name="start" aria-label="Fecha de inicio de la fase" required><button class="btn" type="submit">Añadir fase</button></form></div>

  <div class="card space-y-2"><h3 class="font-bold text-white">Perfil</h3><div class="grid grid-cols-3 gap-3">
    <label class="block"><span class="lbl">Sexo</span><input class="inp" value="${esc(s.profile.sex)}" data-change="pfSex"></label>
    <label class="block"><span class="lbl">Edad</span><input class="inp font-mono tabular-nums" type="number" value="${s.profile.age}" data-change="pfAge"></label>
    <label class="block"><span class="lbl">Altura (cm)</span><input class="inp font-mono tabular-nums" type="number" value="${s.profile.height}" data-change="pfHeight"></label></div></div>`;
}
