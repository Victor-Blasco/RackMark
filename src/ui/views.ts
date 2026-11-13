import { currentPhase, resolveName, type ExStats } from '../lib/analysis';
import { norm } from '../lib/seed';
import { DAYS, type DayName } from '../types';
import { icon } from './icons';
import { DAY_COLOR, RANGES, chart, empty, esc, fmtDate, noData, r1, rangeCutoff, rangePicker, short, type RangeKey, type State } from './shared';

export { resetCharts, runChartJobs, type State } from './shared';
export { defaultSetsForEx, initLogDraft, viewLog } from './logView';
export { viewSettings } from './settingsView';
export { runCalc, viewAdherence, viewBody, viewCalc, viewVolume } from './analyticsViews';
export { resolveName, norm };

const delta = (a?: number, b?: number, u = '') => (a != null && b != null ? `${a - b >= 0 ? '+' : ''}${r1(a - b)}${u}` : '');
const mean = (vals: (number | undefined)[]) => {
  const nums = vals.filter((v): v is number => v != null && Number.isFinite(v));
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : undefined;
};

const STATUS_STYLE: Record<ExStats['statusColor'], { dot: string; text: string }> = {
  emeraldGreen: { dot: 'bg-emeraldGreen', text: 'text-emerald-300' },
  electricBlue: { dot: 'bg-electricBlue', text: 'text-blue-300' },
  amberGold: { dot: 'bg-amberGold', text: 'text-amber-300' },
  coralRed: { dot: 'bg-coralRed', text: 'text-rose-300' },
  gray: { dot: 'bg-gray-500', text: 'text-gray-400' },
};

function statCell(label: string, value: string, sub = '', color = 'text-white'): string {
  return `<div class="min-w-0">
    <span class="block text-xs text-gray-400">${label}</span>
    <span class="mt-0.5 block font-mono tabular-nums text-xl sm:text-2xl font-extrabold ${color}">${value}</span>
    ${sub ? `<span class="mt-0.5 block text-xs text-gray-500 truncate">${sub}</span>` : ''}
  </div>`;
}

function statusInline(e: ExStats, aiStatus?: string): string {
  const text = aiStatus || e.status;
  const st = STATUS_STYLE[e.statusColor] ?? STATUS_STYLE.gray;
  return `<span class="inline-flex items-center gap-1.5 text-xs font-medium ${st.text}"><span class="h-2 w-2 shrink-0 rounded-full ${st.dot}" aria-hidden="true"></span><span>${esc(text)}</span></span>`;
}

function aiStepLabel(title: string): string {
  if (/composici|cuerpo|antropo/i.test(title)) return 'Cuerpo';
  if (/rendimiento|fuerza|sobrecarga|ppl/i.test(title)) return 'Fuerza';
  if (/recuperaci|sueñ|suen|neat|card/i.test(title)) return 'Sueño y FC';
  if (/estrategia|mesociclo|próxim|proxim|plan/i.test(title)) return 'Plan';
  return title.split(/\s+/).slice(0, 2).join(' ');
}

function renderAiReport(S: State): string {
  const ai = S.settings.ai;
  if (!ai) return '';

  const hasHighlights = Boolean(ai.overview?.highlights?.length);
  const steps: { label: string; dot: string; body: string }[] = [
    {
      label: 'Resumen',
      dot: 'bg-electricBlue',
      body: `
        <div class="${hasHighlights && ai.summary ? 'grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start' : 'space-y-3'}">
          <div class="${hasHighlights && ai.summary ? 'lg:col-span-5 space-y-2.5' : 'space-y-2.5'}">
            ${ai.overview?.overallStatus ? `<p class="text-sm sm:text-[15px] font-semibold text-emerald-400">${esc(ai.overview.overallStatus)}</p>` : ''}
            ${ai.summary ? `<p class="text-[15px] sm:text-base text-gray-100 leading-7">${esc(ai.summary)}</p>` : ''}
          </div>
          ${hasHighlights ? `
            <ul class="${ai.summary ? 'lg:col-span-7 border-t border-white/5 pt-3 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0' : 'border-t border-white/5 pt-2'} space-y-2.5">
              ${ai.overview!.highlights.map((h) => `
                <li class="flex items-start gap-2.5 text-sm sm:text-[15px] text-gray-300 leading-relaxed">
                  <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-electricBlue" aria-hidden="true"></span>
                  <span>${esc(h)}</span>
                </li>`).join('')}
            </ul>` : ''}
        </div>
      `,
    },
    ...(ai.overview?.sections ?? []).map((s) => {
      const dot = s.verdict === 'good' ? 'bg-emeraldGreen' : s.verdict === 'warning' ? 'bg-coralRed' : 'bg-electricBlue';
      const titleC = s.verdict === 'good' ? 'text-emerald-300' : s.verdict === 'warning' ? 'text-rose-300' : 'text-blue-300';
      return {
        label: aiStepLabel(s.title),
        dot,
        body: `
          <h4 class="text-base sm:text-lg font-bold ${titleC}">${esc(s.title)}</h4>
          <p class="text-[15px] sm:text-base text-gray-200 leading-7">${esc(s.text)}</p>
        `,
      };
    }),
  ];

  const activeIdx = Math.min(Math.max(0, S.aiTab ?? 0), steps.length - 1);
  const current = steps[activeIdx];

  return `<section aria-label="Informe de IA" class="card border border-electricBlue/30 bg-gradient-to-br from-cardDark via-cardDark to-blue-950/15 space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 class="text-base sm:text-lg font-extrabold text-white">Informe IA</h3>
        <p class="text-xs text-gray-400">Actualizado el ${fmtDate(ai.date)}</p>
      </div>
      <button class="btn !py-1.5 !text-xs" data-act="ai" ${S.busy === 'ai' ? 'disabled' : ''}>${icon('refresh', 'h-3.5 w-3.5')} ${S.busy === 'ai' ? 'Analizando…' : 'Actualizar'}</button>
    </div>

    ${steps.length > 1 ? `
    <div role="tablist" aria-label="Secciones del informe IA" class="flex gap-1.5 overflow-x-auto pb-1">
      ${steps.map((st, idx) => `
        <button role="tab" aria-selected="${idx === activeIdx}" data-act="aiTab" data-arg="${idx}" class="tab whitespace-nowrap !px-3 !py-1.5 !text-xs sm:!text-sm inline-flex items-center gap-2 ${idx === activeIdx ? 'tab-on' : ''}">
          <span class="h-1.5 w-1.5 rounded-full ${st.dot}" aria-hidden="true"></span>
          <span>${esc(st.label)}</span>
        </button>`).join('')}
    </div>` : ''}

    <div role="tabpanel" class="space-y-3 py-1">
      ${current.body}
    </div>

    ${steps.length > 1 ? `
    <div class="flex items-center justify-between border-t border-white/5 pt-3 text-xs sm:text-sm">
      <button class="btn !py-1.5 !px-3 !text-xs sm:!text-sm" data-act="aiTab" data-arg="${activeIdx - 1}" ${activeIdx === 0 ? 'disabled' : ''}>← Anterior</button>
      <span class="text-gray-400 tabular-nums">Paso ${activeIdx + 1} de ${steps.length}</span>
      <button class="btn !py-1.5 !px-3 !text-xs sm:!text-sm" data-act="aiTab" data-arg="${activeIdx + 1}" ${activeIdx === steps.length - 1 ? 'disabled' : ''}>Siguiente →</button>
    </div>` : ''}
  </section>`;
}

function filterExByRange(e: ExStats, cutoff: string | null): ExStats {
  if (!cutoff) return e;
  const sessions = e.sessions.filter((s) => s.date >= cutoff);
  if (sessions.length === e.sessions.length) return e;
  const hrs = sessions.map((s) => s.avgHr).filter((h): h is number => h != null);
  const maxHrs = sessions.map((s) => s.maxHr).filter((h): h is number => h != null);
  return {
    ...e,
    sessions,
    n: sessions.length,
    last: sessions[sessions.length - 1],
    maxWeight: sessions.length ? Math.max(...sessions.map((s) => s.top)) : 0,
    maxE1rm: sessions.length ? Math.max(...sessions.map((s) => s.e1rm)) : 0,
    avgHr: hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : undefined,
    maxHr: maxHrs.length ? Math.max(...maxHrs) : undefined,
  };
}

/** Renderiza la vista principal de resumen con filtro temporal, tarjetas agrupadas, informe IA por pestañas, gráficas y bloque. */
export function viewHome(S: State): string {
  const range: RangeKey = S.ranges?.home ?? 'Todo';
  const cutoff = rangeCutoff(range);
  const rangeDays = RANGES.find((r) => r.key === range)?.days;

  const msAll = S.measures;
  const ms = cutoff ? msAll.filter((m) => m.date >= cutoff) : msAll;
  const last = ms[ms.length - 1];
  const prev = cutoff ? (ms.length > 1 ? ms[0] : undefined) : ms[ms.length - 2];
  const deltaSuffix = cutoff ? ` en ${range}` : ' vs anterior';

  const sessAll = S.analysis.sessions;
  const sess = cutoff ? sessAll.filter((x) => x.date >= cutoff) : sessAll;
  const lastS = sess[sess.length - 1];
  const since28 = new Date(Date.now() - 28 * 864e5).toISOString().slice(0, 10);
  const since7 = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const activeDays = new Set((cutoff ? sess : sess.filter((x) => x.date >= since28)).map((x) => x.date)).size;
  const weeks = rangeDays ? rangeDays / 7 : 4;
  const phase = currentPhase(S.settings);

  const wScope = cutoff ? S.wellbeing.filter((w) => w.date >= cutoff) : S.wellbeing.filter((w) => w.date >= since7);
  const wBaseline = cutoff ? S.wellbeing.filter((w) => w.date >= cutoff) : S.wellbeing.filter((w) => w.date >= since28);
  const sleepMain = mean(wScope.map((w) => (w.sleepMin != null ? w.sleepMin / 60 : undefined)));
  const sleep28 = mean(S.wellbeing.filter((w) => w.date >= since28).map((w) => (w.sleepMin != null ? w.sleepMin / 60 : undefined)));
  const stepsMain = mean(wScope.map((w) => w.steps));
  const steps28 = mean(S.wellbeing.filter((w) => w.date >= since28).map((w) => w.steps));
  const rhrMain = mean(wScope.map((w) => w.rhr));
  const hrvMain = mean(wScope.map((w) => w.hrv));
  const hrForce = mean((cutoff ? sess : sessAll.filter((x) => x.date >= since28)).map((x) => x.avgHr));
  const showWellbeing = S.wellbeing.length > 0 || wBaseline.length > 0 || hrForce != null;

  const ex = [...S.analysis.exercises.values()].filter((e) => e.day).sort((a, b) => b.n - a.n);
  const cur = S.sel.home && S.analysis.exercises.has(S.sel.home) ? S.sel.home : ex[0]?.name;
  const curEx = cur ? filterExByRange(S.analysis.exercises.get(cur)!, cutoff) : undefined;

  if (curEx && curEx.sessions.length) {
    chart('c-home-ex', {
      type: 'line',
      data: {
        labels: curEx.sessions.map((x) => short(x.date)),
        datasets: [
          { label: 'Peso máx (kg)', data: curEx.sessions.map((x) => x.top), borderColor: '#3B82F6', backgroundColor: '#3B82F6', tension: 0.25, yAxisID: 'y' },
          { label: 'e1RM (kg)', data: curEx.sessions.map((x) => x.e1rm), borderColor: '#10B981', backgroundColor: '#10B981', borderDash: [5, 4], tension: 0.25, yAxisID: 'y' },
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

  const rows = DAYS.flatMap((d) => S.analysis.byDay[d].map((e) => ({ d, e: filterExByRange(e, cutoff) })));
  const ai = S.settings.ai;
  const lastDayColor = lastS?.day && DAY_COLOR[lastS.day] ? `style="color:${DAY_COLOR[lastS.day]}"` : '';
  const summaryCols = showWellbeing ? 'lg:grid-cols-3' : 'lg:grid-cols-2';
  const dFmt = (a?: number, b?: number, u = '') => {
    const val = delta(a, b, u);
    return val ? `${val}${deltaSuffix}` : '';
  };

  return `<div class="space-y-5">
  ${noData(S)}

  <div class="flex flex-wrap items-center justify-between gap-2">
    <span class="text-xs font-semibold uppercase tracking-wider text-gray-400">Periodo de datos</span>
    ${rangePicker('home', range)}
  </div>

  <div class="grid grid-cols-1 gap-4 ${summaryCols}">
    <section class="card space-y-4">
      <div class="flex items-baseline justify-between gap-2">
        <h3 class="text-sm font-bold text-white">Composición corporal</h3>
        <span class="text-xs text-gray-400 truncate">${phase ? `${esc(phase.name)} · ${short(phase.start)}` : 'Sin fase'}</span>
      </div>
      <div class="grid grid-cols-2 gap-x-5 gap-y-4">
        ${statCell('Peso', last?.weight != null ? `${r1(last.weight)} kg` : '—', dFmt(last?.weight, prev?.weight, ' kg') || (last ? fmtDate(last.date) : ''))}
        ${statCell('% Grasa', last?.bf != null ? `${r1(last.bf)}%` : '—', dFmt(last?.bf, prev?.bf, '%'), 'text-coralRed')}
        ${statCell('Masa muscular', last?.muscle != null ? `${r1(last.muscle)} kg` : '—', dFmt(last?.muscle, prev?.muscle, ' kg'), 'text-emeraldGreen')}
        ${statCell('Cintura', last?.waist != null ? `${r1(last.waist)} cm` : '—', dFmt(last?.waist, prev?.waist, ' cm'), 'text-amberGold')}
      </div>
    </section>

    <section class="card flex flex-col justify-between gap-4">
      <div class="space-y-1">
        <div class="flex items-baseline justify-between gap-2">
          <h3 class="text-sm font-bold text-white">Entrenamiento PPL</h3>
          <span class="text-xs text-gray-400">${lastS ? fmtDate(lastS.date) : `Sin sesiones${cutoff ? ` (${range})` : ''}`}</span>
        </div>
        <p class="pt-1 font-mono tabular-nums text-2xl font-extrabold text-white" ${lastDayColor}>${lastS ? esc(lastS.day ?? 'Sesión') : '—'}</p>
        <p class="text-xs text-gray-400">${lastS ? `${lastS.durMin ? `${Math.round(lastS.durMin)} min` : 'Duración N/D'}${lastS.avgHr ? ` · ${lastS.avgHr} lpm medios` : ''}` : 'Sin registros en este periodo'}</p>
      </div>
      <div class="grid grid-cols-2 gap-4 border-t border-white/5 pt-3.5">
        ${statCell(cutoff ? `Días (${range})` : 'Últimos 28d', String(activeDays), `${r1(activeDays / weeks)} / semana`)}
        ${statCell('Medidas', String(ms.length), last ? `última ${short(last.date)}` : 'sin registros')}
      </div>
    </section>

    ${showWellbeing ? `
    <section class="card space-y-4">
      <div class="flex items-baseline justify-between gap-2">
        <h3 class="text-sm font-bold text-white">Recuperación y pulso</h3>
        <span class="text-xs text-gray-400">${cutoff ? `media ${range}` : 'media 7 días'}</span>
      </div>
      <div class="grid grid-cols-2 gap-x-5 gap-y-4">
        ${statCell('Sueño', sleepMain != null ? `${r1(sleepMain)} h` : '—', !cutoff && sleep28 != null ? `28d: ${r1(sleep28)} h` : `${wScope.length} días`, 'text-blue-300')}
        ${statCell('Pasos / día', stepsMain != null ? Math.round(stepsMain).toLocaleString('es-ES') : '—', !cutoff && steps28 != null ? `28d: ${Math.round(steps28).toLocaleString('es-ES')}` : '', 'text-emeraldGreen')}
        ${statCell('FC reposo / HRV', rhrMain != null ? `${Math.round(rhrMain)} lpm` : '—', hrvMain != null ? `HRV ${Math.round(hrvMain)} ms` : '')}
        ${statCell('Pulso fuerza', hrForce != null ? `${Math.round(hrForce)} lpm` : '—', cutoff ? `media ${range}` : 'media 28 días', 'text-coralRed')}
      </div>
    </section>` : ''}
  </div>

  ${renderAiReport(S)}

  <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
    <div class="card"><div class="mb-3 flex items-center justify-between gap-2"><h3 class="font-bold text-white">Evolución de cargas</h3>
      <select class="inp !w-auto max-w-[60%]" data-change="selHome" aria-label="Seleccionar ejercicio para gráfica">${ex.map((e) => `<option ${e.name === cur ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></div>
      ${curEx?.sessions.length ? `<div class="chart-box"><canvas id="c-home-ex"></canvas></div>` : `<p class="py-12 text-center text-sm text-gray-500">Sin sesiones para este ejercicio en ${range}.</p>`}</div>
    <div class="card"><h3 class="mb-3 font-bold text-white">Peso y % de grasa</h3>
      ${mm.length ? `<div class="chart-box"><canvas id="c-home-body"></canvas></div>` : `<p class="py-12 text-center text-sm text-gray-500">Sin mediciones de peso en ${range}.</p>`}</div>
  </div>

  <section class="card space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="font-bold text-white">Control de cargas del bloque</h3>
      <div class="flex flex-wrap gap-2">
        <button class="btn-primary !py-1.5 !text-xs sm:!text-sm" data-act="goLog">+ Registrar entreno</button>
        ${!ai ? `<button class="btn !py-1.5 !text-xs sm:!text-sm" data-act="ai" ${S.busy === 'ai' ? 'disabled' : ''}>${icon('sparkle', 'h-3.5 w-3.5')} ${S.busy === 'ai' ? 'Analizando…' : 'Generar análisis IA'}</button>` : ''}
      </div>
    </div>

    <div class="md:hidden divide-y divide-white/5">
      ${rows.map(({ d, e }) => `
        <div class="py-3 space-y-1.5">
          <div class="flex items-start justify-between gap-2">
            <p class="text-sm font-semibold text-white leading-snug">
              <span style="color:${DAY_COLOR[d]}" class="mr-1.5 text-xs font-bold uppercase">${d}</span>${esc(e.name)}
            </p>
            ${e.target ? `<span class="shrink-0 font-mono text-xs text-gray-400 tabular-nums">${e.target.sets}×${e.target.reps}</span>` : ''}
          </div>
          <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span class="font-mono text-xs text-gray-300 tabular-nums">${e.last ? `${short(e.last.date)} · ${e.last.sets.map((s) => `${s.w}×${s.r}`).join(' · ')}` : 'Sin registros'}</span>
            ${statusInline(e, ai?.byExercise[e.name]?.status)}
          </div>
        </div>`).join('')}
    </div>

    <div class="hidden md:block overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="text-xs uppercase text-gray-400 border-b border-gray-800">
          <tr><th class="py-2 pr-3">Día</th><th class="pr-3">Ejercicio</th><th class="pr-3 text-right">Obj.</th><th class="pr-3 text-right">Última</th><th class="pr-3">Series</th><th>Estado</th></tr>
        </thead>
        <tbody class="divide-y divide-gray-800/70">
          ${rows.map(({ d, e }) => `
            <tr>
              <td class="py-2.5 pr-3"><span style="color:${DAY_COLOR[d]}" class="font-bold">${d}</span></td>
              <td class="pr-3 text-gray-100">${esc(e.name)}</td>
              <td class="num-col pr-3 text-gray-400">${e.target ? `${e.target.sets}×${e.target.reps}` : ''}</td>
              <td class="num-col pr-3 text-xs text-gray-400">${e.last ? fmtDate(e.last.date) : ''}</td>
              <td class="pr-3 font-mono tabular-nums text-xs text-gray-200">${e.last ? e.last.sets.map((s) => `${s.w}×${s.r}`).join(' · ') : ''}</td>
              <td class="py-2.5">${statusInline(e, ai?.byExercise[e.name]?.status)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </section>
</div>`;
}

function renderDayDetail(
  S: State,
  e: ExStats,
  canvasId: string,
  historyLimit: number,
  range: RangeKey,
  embedded = false,
): string {
  const ai = S.settings.ai?.byExercise ?? {};
  const a = ai[e.name];
  const note = a?.biomech ?? S.settings.notes[e.name];
  const recent = [...e.sessions].reverse().slice(0, historyLimit);

  return `<div class="${embedded ? 'border-t border-white/10 bg-[#0D1320]/70 p-4 space-y-4' : 'card space-y-5'}">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        ${embedded ? '' : `<h3 class="text-lg font-extrabold text-white">${esc(e.name)}</h3>`}
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 ${embedded ? '' : 'mt-1'}">
          ${statusInline(e, a?.status)}
          <span class="text-xs text-gray-400 tabular-nums">Objetivo ${e.target ? `${e.target.sets}×${e.target.reps}` : '—'} · ${e.n} sesiones</span>
        </div>
      </div>
      <button class="btn !py-1.5 !text-xs" data-act="editNote" data-arg="${esc(e.name)}">${icon('edit', 'h-3.5 w-3.5')} Nota</button>
    </div>

    <div class="rounded-xl border border-emeraldGreen/25 bg-emerald-950/20 p-3.5">
      <p class="text-xs font-semibold uppercase tracking-wider text-emerald-400">Próxima sesión</p>
      <p class="mt-1 text-sm sm:text-[15px] text-gray-100 leading-relaxed">${esc(a?.prescription ?? e.prescription)}</p>
    </div>

    <div class="grid grid-cols-3 gap-3 border-y border-white/5 py-3">
      <div><span class="block text-xs text-gray-400">Peso máx</span><span class="mt-0.5 block font-mono text-base sm:text-lg font-bold text-white tabular-nums">${e.n ? `${e.maxWeight} kg` : '—'}</span></div>
      <div><span class="block text-xs text-gray-400">e1RM pico</span><span class="mt-0.5 block font-mono text-base sm:text-lg font-bold text-white tabular-nums">${e.n ? `${r1(e.maxE1rm)} kg` : '—'}</span></div>
      <div><span class="block text-xs text-gray-400">FC media</span><span class="mt-0.5 block font-mono text-base sm:text-lg font-bold text-cyan-300 tabular-nums">${e.avgHr ? `${e.avgHr} lpm` : '—'}</span></div>
    </div>

    <div>
      <p class="mb-2 text-xs font-semibold text-gray-400">Progresión (peso máx, e1RM${e.sessions.some((s) => s.avgHr != null) ? ' y pulso' : ''})</p>
      ${e.sessions.length ? `<div class="chart-box"><canvas id="${canvasId}"></canvas></div>` : `<p class="py-8 text-center text-sm text-gray-500">Sin registros para este ejercicio en ${range}.</p>`}
    </div>

    ${e.last?.note ? `<p class="flex items-start gap-2 text-xs sm:text-sm text-amberGold">${icon('note', 'h-4 w-4 mt-0.5')}<span>Última nota: ${esc(e.last.note)}</span></p>` : ''}
    ${note ? `<p class="text-xs sm:text-sm text-gray-300 leading-relaxed"><span class="font-semibold text-gray-200">Biomecánica:</span> ${esc(note)}</p>` : ''}

    ${recent.length ? `<div class="space-y-2 pt-1">
      <p class="text-xs font-semibold uppercase tracking-wider text-gray-400">Últimas sesiones</p>
      <div class="grid grid-cols-1 gap-2 xl:grid-cols-2">
        ${recent.map((x) => `
          <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl bg-gray-900/70 px-3 py-2 text-xs sm:text-sm">
            <span class="font-mono text-gray-400 tabular-nums">${fmtDate(x.date)}</span>
            <span class="font-mono text-gray-100 tabular-nums">${x.sets.map((s) => `${s.w}×${s.r}`).join(' · ')}</span>
            <span class="font-mono text-xs text-gray-400 tabular-nums">e1RM ${r1(x.e1rm)}${x.avgHr ? ` · <span class="text-cyan-300">${x.avgHr}${x.maxHr ? `/${x.maxHr}` : ''} lpm</span>` : ''}${x.durMin ? ` · ${Math.round(x.durMin)}m` : ''}</span>
            ${x.note ? `<span class="w-full text-xs text-amberGold">${esc(x.note)}</span>` : ''}
          </div>`).join('')}
      </div>
    </div>` : ''}
  </div>`;
}

/** Renderiza la vista de detalle de una rutina (`Push`, `Pull` o `Leg`) en formato Maestro + Detalle (y acordeón en móvil). */
export function viewDay(S: State, day: DayName): string {
  const range: RangeKey = S.ranges?.[day] ?? 'Todo';
  const cutoff = rangeCutoff(range);

  const primary = S.analysis.byDay[day].map((e) => filterExByRange(e, cutoff));
  const primaryNorms = new Set(primary.map((e) => norm(e.name)));
  const extraAll = [...S.analysis.exercises.values()]
    .filter((e) => !primaryNorms.has(norm(e.name)) && !e.name.startsWith('Samsung #') && (e.day === day || e.day == null))
    .map((e) => filterExByRange(e, cutoff))
    .filter((e) => !cutoff || e.n > 0)
    .sort((a, b) => (a.day === day ? 0 : 1) - (b.day === day ? 0 : 1) || b.n - a.n);

  if (!primary.length && !extraAll.length) {
    return noData(S) || empty('No hay ejercicios con datos para esta rutina. Revisa la rutina en Ajustes.');
  }

  const showingExtra = Boolean(S.dayExtra?.[day]) && extraAll.length > 0;
  const visibleList = showingExtra ? extraAll : primary.length ? primary : extraAll;
  const allPool = [...primary, ...extraAll];

  const rawSel = S.sel[day];
  const desktopCur = rawSel && visibleList.some((e) => e.name === rawSel) ? rawSel : visibleList[0].name;
  const mobileCur = rawSel === '__closed__' ? undefined : desktopCur;

  const registerDayChart = (canvasId: string, exName: string) => {
    const e = allPool.find((x) => x.name === exName)!;
    if (!e.sessions.length) return;
    const hasHr = e.sessions.some((x) => x.avgHr != null);
    chart(canvasId, {
      type: 'line',
      data: {
        labels: e.sessions.map((x) => short(x.date)),
        datasets: [
          { label: 'Peso máx (kg)', data: e.sessions.map((x) => x.top), borderColor: DAY_COLOR[day], backgroundColor: DAY_COLOR[day], tension: 0.25, yAxisID: 'y' },
          { label: 'e1RM (kg)', data: e.sessions.map((x) => x.e1rm), borderColor: '#F59E0B', borderDash: [5, 4], tension: 0.25, yAxisID: 'y' },
          ...(hasHr ? [{ label: 'FC media (lpm)', data: e.sessions.map((x) => x.avgHr ?? null), borderColor: '#22D3EE', backgroundColor: '#22D3EE', tension: 0.25, spanGaps: true, yAxisID: 'y1' }] : []),
        ],
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        ...(hasHr ? { scales: { y: { position: 'left' }, y1: { position: 'right', grid: { drawOnChartArea: false } } } } : {}),
      },
    });
  };

  registerDayChart('c-day', desktopCur);
  if (mobileCur) registerDayChart('c-day-mob', mobileCur);

  const sessAll = S.analysis.sessions.filter((x) => x.day === day);
  const sess = cutoff ? sessAll.filter((x) => x.date >= cutoff) : sessAll;
  const lastS = sess[sess.length - 1];
  const ai = S.settings.ai?.byExercise ?? {};
  const desktopEx = allPool.find((x) => x.name === desktopCur)!;

  const scopeToggle = extraAll.length && primary.length
    ? `<div role="tablist" aria-label="Filtro de ejercicios" class="inline-flex rounded-xl border border-white/10 bg-gray-900/70 p-1 gap-1">
        <button role="tab" aria-selected="${!showingExtra}" data-act="setDayScope" data-arg="${day}|routine" class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${!showingExtra ? 'bg-electricBlue text-white' : 'text-gray-400 hover:text-white'}">En rutina (${primary.length})</button>
        <button role="tab" aria-selected="${showingExtra}" data-act="setDayScope" data-arg="${day}|extra" class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${showingExtra ? 'bg-electricBlue text-white' : 'text-gray-400 hover:text-white'}">Anteriores (${extraAll.length})</button>
      </div>`
    : '';

  return `<div class="space-y-4">
  <div class="card space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="space-y-0.5">
        <div class="flex items-center gap-2.5">
          <span class="h-3 w-3 rounded-full" style="background-color:${DAY_COLOR[day]}" aria-hidden="true"></span>
          <h2 class="text-lg font-extrabold text-white">Rutina ${day}</h2>
          <span class="text-xs text-gray-400">· ${sess.length} sesiones${cutoff ? ` (${range})` : ''}</span>
        </div>
        <p class="text-xs sm:text-sm text-gray-400 tabular-nums">${lastS ? `Última: ${fmtDate(lastS.date)} · ${lastS.sets} series${lastS.durMin ? ` · ${Math.round(lastS.durMin)} min` : ''}${lastS.avgHr ? ` · Pulso ${lastS.avgHr}${lastS.maxHr ? `/${lastS.maxHr}` : ''} lpm` : ''}${lastS.kcal ? ` · ${lastS.kcal} kcal` : ''}` : `Sin sesiones en ${range}`}</p>
      </div>
      <button class="btn-primary w-full sm:w-auto !py-2 !text-xs sm:!text-sm" data-act="goLog" data-arg="${day}">+ Registrar ${day}</button>
    </div>
    <div class="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3">
      ${scopeToggle || '<span></span>'}
      ${rangePicker(day, range)}
    </div>
  </div>

  <!-- Móvil: acordeón maestro-detalle in-place -->
  <div class="lg:hidden space-y-3">
    ${visibleList.map((x) => {
      const open = x.name === mobileCur;
      const st = STATUS_STYLE[x.statusColor] ?? STATUS_STYLE.gray;
      const lastTxt = x.last ? `${short(x.last.date)} · ${x.last.sets.map((s) => `${s.w}×${s.r}`).join(' · ')}` : `Sin registros en ${range}`;
      return `<div class="rounded-2xl border ${open ? 'border-electricBlue/60' : 'border-white/10'} bg-cardDark/85 overflow-hidden">
        <button data-act="selEx" data-arg="${day}|${open ? '__closed__' : esc(x.name)}" aria-expanded="${open}" class="w-full p-4 text-left flex items-center justify-between gap-3 transition-colors hover:bg-white/[0.02]">
          <div class="min-w-0 space-y-1">
            <p class="text-sm font-bold text-white truncate">${esc(x.name)}</p>
            <p class="text-xs font-mono text-gray-400 tabular-nums truncate">${lastTxt}</p>
          </div>
          <div class="shrink-0 flex items-center gap-2.5">
            <span class="h-2.5 w-2.5 rounded-full ${st.dot}" title="${esc(ai[x.name]?.status ?? x.status)}"></span>
            <span class="text-xs text-gray-400">${open ? '▲' : '▼'}</span>
          </div>
        </button>
        ${open ? renderDayDetail(S, x, 'c-day-mob', 8, range, true) : ''}
      </div>`;
    }).join('')}
  </div>

  <!-- Escritorio: maestro izquierda + detalle fijo derecha -->
  <div class="hidden lg:grid lg:grid-cols-12 lg:gap-5 xl:gap-6 lg:items-start">
    <div class="lg:col-span-5 xl:col-span-4 space-y-2" role="listbox" aria-label="Ejercicios de ${day}">
      ${visibleList.map((x) => {
        const sel = x.name === desktopCur;
        const st = STATUS_STYLE[x.statusColor] ?? STATUS_STYLE.gray;
        const lastTxt = x.last ? `${short(x.last.date)} · ${x.last.sets.map((s) => `${s.w}×${s.r}`).join(' · ')}` : `Sin registros en ${range}`;
        const rightMeta = x.target ? `${x.target.sets}×${x.target.reps}` : `${x.n} ses.`;
        return `<button data-act="selEx" data-arg="${day}|${esc(x.name)}" aria-selected="${sel}" class="w-full rounded-2xl border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${sel ? 'border-electricBlue bg-electricBlue/10' : 'border-white/10 bg-cardDark/85 hover:border-white/25'}">
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-bold text-white truncate">${esc(x.name)}</span>
            <span class="h-2.5 w-2.5 shrink-0 rounded-full ${st.dot}" title="${esc(ai[x.name]?.status ?? x.status)}"></span>
          </div>
          <div class="mt-1 flex items-center justify-between gap-2 text-xs text-gray-400">
            <span class="font-mono tabular-nums truncate">${lastTxt}</span>
            <span class="shrink-0 font-mono tabular-nums">${rightMeta}</span>
          </div>
        </button>`;
      }).join('')}
    </div>
    <div class="lg:col-span-7 xl:col-span-8 lg:sticky lg:top-6">
      ${renderDayDetail(S, desktopEx, 'c-day', 20, range, false)}
    </div>
  </div>
</div>`;
}
