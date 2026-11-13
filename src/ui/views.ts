import { currentPhase, resolveName } from '../lib/analysis';
import { norm } from '../lib/seed';
import { DAYS, type DayName } from '../types';
import { icon } from './icons';
import { DAY_COLOR, chart, empty, esc, fmtDate, kpi, noData, r1, short, statusBadge, type State } from './shared';

export { resetCharts, runChartJobs, type State } from './shared';
export { defaultSetsForEx, initLogDraft, viewLog } from './logView';
export { viewSettings } from './settingsView';
export { runCalc, viewAdherence, viewBody, viewCalc, viewVolume } from './analyticsViews';
export { resolveName, norm };

const delta = (a?: number, b?: number, u = '') => (a != null && b != null ? `${a - b >= 0 ? '+' : ''}${r1(a - b)}${u} vs anterior` : '');

/** Renderiza la vista principal de resumen con KPIs, informe IA, gráficas y tabla de bloque. */
export function viewHome(S: State): string {
  const ms = S.measures;
  const last = ms[ms.length - 1];
  const prev = ms[ms.length - 2];
  const sess = S.analysis.sessions;
  const lastS = sess[sess.length - 1];
  const since = new Date(Date.now() - 28 * 864e5).toISOString().slice(0, 10);
  const days28 = new Set(S.analysis.sessions.filter((x) => x.date >= since).map((x) => x.date)).size;
  const phase = currentPhase(S.settings);
  const ex = [...S.analysis.exercises.values()].filter((e) => e.day).sort((a, b) => b.n - a.n);
  const cur = S.sel.home && S.analysis.exercises.has(S.sel.home) ? S.sel.home : ex[0]?.name;

  if (cur) {
    const e = S.analysis.exercises.get(cur)!;
    chart('c-home-ex', {
      type: 'line',
      data: {
        labels: e.sessions.map((x) => short(x.date)),
        datasets: [
          { label: 'Peso máx (kg)', data: e.sessions.map((x) => x.top), borderColor: '#3B82F6', backgroundColor: '#3B82F6', tension: 0.25, yAxisID: 'y' },
          { label: 'e1RM (kg)', data: e.sessions.map((x) => x.e1rm), borderColor: '#10B981', backgroundColor: '#10B981', borderDash: [5, 4], tension: 0.25, yAxisID: 'y' },
        ],
      },
      options: { interaction: { mode: 'index', intersect: false } },
    });
  }
  const mm = ms.filter((m) => m.weight != null);
  if (mm.length) {
    chart('c-home-body', {
      type: 'line',
      data: {
        labels: mm.map((m) => short(m.date)),
        datasets: [
          { label: 'Peso (kg)', data: mm.map((m) => m.weight!), borderColor: '#3B82F6', yAxisID: 'y', tension: 0.25 },
          { label: '% Grasa', data: mm.map((m) => m.bf ?? null), borderColor: '#F43F5E', yAxisID: 'y1', tension: 0.25, spanGaps: true },
        ],
      },
      options: { scales: { y: { position: 'left' }, y1: { position: 'right', grid: { drawOnChartArea: false } } } },
    });
  }

  const rows = DAYS.flatMap((d) => S.analysis.byDay[d].map((e) => ({ d, e })));
  const ai = S.settings.ai;
  return `
  ${noData(S)}
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    ${kpi('Peso', last?.weight != null ? `${r1(last.weight)} kg` : '—', delta(last?.weight, prev?.weight, ' kg'))}
    ${kpi('% Grasa', last?.bf != null ? `${r1(last.bf)}%` : '—', delta(last?.bf, prev?.bf, '%'), 'text-coralRed')}
    ${kpi('Masa muscular', last?.muscle != null ? `${r1(last.muscle)} kg` : '—', delta(last?.muscle, prev?.muscle, ' kg'), 'text-emeraldGreen')}
    ${kpi('Cintura', last?.waist != null ? `${r1(last.waist)} cm` : '—', delta(last?.waist, prev?.waist, ' cm'), 'text-amberGold')}
    ${kpi('Última sesión', lastS ? `${lastS.day ?? '—'}` : '—', lastS ? fmtDate(lastS.date) : '')}
    ${kpi('Días entrenados (28d)', String(days28), `${r1(days28 / 4)} / semana`)}
    ${kpi('Fase', esc(phase?.name ?? '—'), phase ? `desde ${fmtDate(phase.start)}` : '')}
    ${kpi('Medidas', last ? fmtDate(last.date) : '—', `${ms.length} registros`)}
  </div>
  ${ai ? `
  <div class="card border border-electricBlue/40 bg-gradient-to-br from-cardDark via-cardDark to-blue-950/20 space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 pb-3">
      <div>
        <div class="flex items-center gap-2">
          <span class="flex h-2 w-2 rounded-full bg-emeraldGreen animate-pulse motion-reduce:animate-none" aria-hidden="true"></span>
          <h3 class="font-extrabold text-base text-white">Informe General del Rendimiento</h3>
          <span class="rounded-full bg-electricBlue/15 px-2 py-0.5 text-[11px] font-semibold text-blue-300 tabular-nums">${fmtDate(ai.date)}</span>
        </div>
        ${ai.overview?.overallStatus ? `<p class="text-xs font-semibold text-emerald-400 mt-1">Estado global: ${esc(ai.overview.overallStatus)}</p>` : ''}
      </div>
      <button class="btn !py-1 !text-xs" data-act="ai">${icon('refresh', 'h-3.5 w-3.5')} ${S.busy === 'ai' ? 'Regenerando…' : 'Actualizar Informe'}</button>
    </div>
    ${ai.summary ? `<p class="text-sm text-gray-200 leading-relaxed">${esc(ai.summary)}</p>` : ''}
    ${ai.overview?.highlights?.length ? `
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
      ${ai.overview.highlights.map((h, idx) => `
        <div class="rounded-xl border border-gray-800 bg-gray-900/80 p-3 text-xs text-gray-300 flex items-start gap-2">
          <span class="font-mono tabular-nums font-bold text-electricBlue">#${idx + 1}</span>
          <span>${esc(h)}</span>
        </div>`).join('')}
    </div>` : ''}
    ${ai.overview?.sections?.length ? `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
      ${ai.overview.sections.map((s) => {
        const borderC = s.verdict === 'good' ? 'border-emeraldGreen/30' : s.verdict === 'warning' ? 'border-coralRed/30' : 'border-gray-800';
        const titleC = s.verdict === 'good' ? 'text-emeraldGreen' : s.verdict === 'warning' ? 'text-coralRed' : 'text-blue-400';
        const verdictIcon = s.verdict === 'good' ? icon('check', 'h-4 w-4') : s.verdict === 'warning' ? icon('warn', 'h-4 w-4') : icon('info', 'h-4 w-4');
        return `
        <div class="rounded-xl border ${borderC} bg-gray-900/60 p-3.5 space-y-1.5">
          <h4 class="text-xs font-bold uppercase tracking-wider ${titleC} flex items-center justify-between">
            <span>${esc(s.title)}</span>
            ${verdictIcon}
          </h4>
          <p class="text-xs text-gray-300 leading-relaxed">${esc(s.text)}</p>
        </div>`;
      }).join('')}
    </div>` : ''}
  </div>` : ''}
  <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
    <div class="card"><div class="mb-2 flex items-center justify-between gap-2"><h3 class="font-bold text-white">Evolución de cargas</h3>
      <select class="inp !w-auto max-w-[60%]" data-change="selHome" aria-label="Seleccionar ejercicio para gráfica">${ex.map((e) => `<option ${e.name === cur ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></div>
      <div class="chart-box"><canvas id="c-home-ex"></canvas></div></div>
    <div class="card"><h3 class="mb-2 font-bold text-white">Peso y % de grasa</h3><div class="chart-box"><canvas id="c-home-body"></canvas></div></div>
  </div>
  <div class="card overflow-x-auto"><div class="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 class="font-bold text-white">Control de cargas del bloque</h3>
    <div class="flex flex-wrap gap-2">
      <button class="btn-primary !py-1.5 !text-xs" data-act="goLog">+ Registrar entrenamiento</button>
      <button class="btn !py-1.5 !text-xs" data-act="ai">${icon('sparkle', 'h-3.5 w-3.5')} ${S.busy === 'ai' ? 'Analizando…' : 'Generar análisis con IA'}</button>
    </div></div>
    <table class="w-full min-w-[640px] text-left text-sm"><thead class="text-xs uppercase text-gray-400"><tr><th class="py-1.5 pr-2">Día</th><th class="pr-2">Ejercicio</th><th class="pr-3 text-right">Obj.</th><th class="pr-3 text-right">Última</th><th class="pr-3">Series</th><th>Estado</th></tr></thead><tbody>
    ${rows.map(({ d, e }) => `<tr class="border-t border-gray-800"><td class="py-1.5 pr-2"><span style="color:${DAY_COLOR[d]}" class="font-bold">${d}</span></td><td class="pr-2">${esc(e.name)}</td><td class="num-col pr-3 text-gray-400">${e.target ? `${e.target.sets}×${e.target.reps}` : ''}</td><td class="num-col pr-3 text-xs text-gray-400">${e.last ? fmtDate(e.last.date) : ''}</td><td class="pr-3 font-mono tabular-nums text-xs">${e.last ? e.last.sets.map((s) => `${s.w}×${s.r}`).join(' · ') : ''}</td><td>${statusBadge(ai?.byExercise[e.name]?.status ? { ...e, status: ai.byExercise[e.name].status! } : e)}</td></tr>`).join('')}
    </tbody></table></div>`;
}

/** Renderiza la vista de detalle de una rutina (`Push`, `Pull` o `Leg`). */
export function viewDay(S: State, day: DayName): string {
  const list = S.analysis.byDay[day];
  if (!list.length) return noData(S) || empty('No hay ejercicios con datos para esta rutina. Revisa la rutina en Ajustes.');
  const cur = S.sel[day] && list.some((e) => e.name === S.sel[day]) ? S.sel[day] : list[0].name;
  const e = list.find((x) => x.name === cur)!;
  chart('c-day', {
    type: 'line',
    data: {
      labels: e.sessions.map((x) => short(x.date)),
      datasets: [
        { label: 'Peso máx (kg)', data: e.sessions.map((x) => x.top), borderColor: DAY_COLOR[day], backgroundColor: DAY_COLOR[day], tension: 0.25 },
        { label: 'e1RM (kg)', data: e.sessions.map((x) => x.e1rm), borderColor: '#F59E0B', borderDash: [5, 4], tension: 0.25 },
      ],
    },
    options: { interaction: { mode: 'index', intersect: false } },
  });
  const sess = S.analysis.sessions.filter((x) => x.day === day);
  const lastS = sess[sess.length - 1];
  const ai = S.settings.ai?.byExercise ?? {};
  return `
  <div class="card flex flex-wrap items-center justify-between gap-2">
    <div><h2 class="text-lg font-extrabold" style="color:${DAY_COLOR[day]}">${day}</h2>
      <p class="text-xs text-gray-400 tabular-nums">${lastS ? `Última sesión: ${fmtDate(lastS.date)} · ${lastS.sets} series · ${sess.length} sesiones registradas` : ''}</p></div>
    <button class="btn-primary !py-1.5 !text-xs" data-act="goLog" data-arg="${day}">+ Registrar ${day}</button>
  </div>
  <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
  ${list.map((x) => {
    const a = ai[x.name];
    const note = a?.biomech ?? S.settings.notes[x.name];
    const selected = x.name === cur;
    return `<button data-act="selEx" data-arg="${day}|${esc(x.name)}" aria-pressed="${selected}" class="card text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${selected ? '!border-electricBlue' : ''}">
      <div class="mb-1 flex items-start justify-between gap-2"><b class="text-white">${esc(x.name)}</b>${statusBadge(a?.status ? { ...x, status: a.status } : x)}</div>
      <div class="text-xs text-gray-400 tabular-nums">Obj. ${x.target ? `${x.target.sets}×${x.target.reps}` : '—'} · ${x.n} sesiones · máx ${x.maxWeight} kg · e1RM máx ${r1(x.maxE1rm)} kg</div>
      <div class="mt-1 font-mono tabular-nums text-xs text-gray-200">${x.last ? `${fmtDate(x.last.date)}: ${x.last.sets.map((s) => `${s.w}×${s.r}`).join(' · ')}` : ''}</div>
      ${x.last?.note ? `<p class="mt-1 flex items-center gap-1 text-xs text-amberGold">${icon('note', 'h-3.5 w-3.5')} ${esc(x.last.note)}</p>` : ''}
      <p class="mt-1 text-xs text-emerald-300">${esc(a?.prescription ?? x.prescription)}</p>
      ${note ? `<p class="mt-1 text-[11px] text-gray-500">${esc(note)}</p>` : ''}
    </button>`;
  }).join('')}
  </div>
  <div class="card"><div class="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 class="font-bold text-white">${esc(cur)}</h3>
    <button class="btn" data-act="editNote" data-arg="${esc(cur)}">${icon('edit', 'h-3.5 w-3.5')} Nota biomecánica</button></div>
    <div class="chart-box"><canvas id="c-day"></canvas></div></div>
  <div class="card overflow-x-auto"><h3 class="mb-2 font-bold text-white">Historial · ${esc(cur)}</h3>
    <table class="w-full text-left text-sm"><thead class="text-xs uppercase text-gray-400"><tr><th class="py-1.5 pr-3">Fecha</th><th class="pr-3">Series</th><th class="pr-3 text-right">Vol.</th><th class="pr-3 text-right">e1RM</th><th>Nota</th></tr></thead><tbody>
    ${[...e.sessions].reverse().slice(0, 30).map((x) => `<tr class="border-t border-gray-800"><td class="py-1.5 pr-3 font-mono tabular-nums text-xs">${fmtDate(x.date)}</td><td class="pr-3 font-mono tabular-nums text-xs">${x.sets.map((s) => `${s.w}×${s.r}`).join(' · ')}</td><td class="num-col pr-3 text-xs">${x.volume}</td><td class="num-col pr-3 text-xs">${r1(x.e1rm)}</td><td class="text-xs text-amberGold">${x.note ? esc(x.note) : ''}</td></tr>`).join('')}
    </tbody></table></div>`;
}
