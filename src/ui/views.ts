import type { ChartConfiguration } from 'chart.js';
import { currentPhase, resolveName, type ExSession, type ExStats } from '../lib/analysis';
import { norm, ROUTINE_TEMPLATES } from '../lib/seed';
import type { AiTone, DayName, Measure } from '../types';
import { icon } from './icons';
import {
  chart,
  esc,
  fmtDate,
  inRange,
  isAiFreshForEx,
  movingAverage7d,
  noData,
  r1,
  rangePicker,
  resolveRange,
  routineColor,
  routineNames,
  routineShort,
  short,
  todayIso,
  weightDeltaColor,
  type DateBounds,
  type State,
} from './shared';

export { resetCharts, runChartJobs, updateChart, type State } from './shared';
export { defaultSetsForEx, initLogDraft, viewLog } from './logView';
export { initLiveWorkout, liveExQuickInfo, viewWorkout } from './workoutView';
export { viewData } from './dataView';
export { renderModals, renderPlanCatalogResults, viewPlan } from './planView';
export { viewSettings } from './settingsView';
export { buildCompChartConfig, buildPerimChartConfig, runCalc, viewAdherence, viewBody, viewCalc, viewVolume } from './analyticsViews';
export { resolveName, norm };

type ExMetric = 'top' | 'e1rm' | 'volume';

function aiToneToggle(tone: AiTone): string {
  return `<div role="group" aria-label="Nivel técnico de la IA" class="inline-flex rounded-xl border border-white/10 bg-gray-900/70 p-0.5 text-[11px]">
    <button type="button" data-act="setAiTone" data-arg="simple" aria-pressed="${tone === 'simple'}" class="inline-flex min-h-[40px] sm:min-h-[30px] items-center rounded-lg px-2.5 py-1 font-semibold transition-colors ${tone === 'simple' ? 'bg-electricBlue text-white' : 'text-gray-400 hover:text-white'}">Sencillo</button>
    <button type="button" data-act="setAiTone" data-arg="technical" aria-pressed="${tone === 'technical'}" class="inline-flex min-h-[40px] sm:min-h-[30px] items-center rounded-lg px-2.5 py-1 font-semibold transition-colors ${tone === 'technical' ? 'bg-electricBlue text-white' : 'text-gray-400 hover:text-white'}">Técnico</button>
  </div>`;
}

function exMetricToggle(active: ExMetric): string {
  const opts: [ExMetric, string][] = [['top', 'Peso máx'], ['e1rm', 'e1RM'], ['volume', 'Tonelaje']];
  return `<div role="group" aria-label="Métrica de progresión" class="inline-flex rounded-xl border border-white/10 bg-gray-900/70 p-0.5 text-[11px]">
    ${opts.map(([k, lbl]) => `<button type="button" data-act="setExMetric" data-arg="${k}" aria-pressed="${active === k}" class="inline-flex min-h-[40px] sm:min-h-[30px] items-center rounded-lg px-2.5 py-1 font-semibold transition-colors ${active === k ? 'bg-electricBlue text-white' : 'text-gray-400 hover:text-white'}">${lbl}</button>`).join('')}
  </div>`;
}

/** Configura la gráfica de carga (Peso máx, e1RM o Tonelaje) en un único eje Y con detalle completo en el tooltip. */
function exerciseChartConfig(sessions: ExSession[], color: string, metric: ExMetric = 'top'): ChartConfiguration<'line'> {
  const label = metric === 'e1rm' ? 'e1RM est. (kg)' : metric === 'volume' ? 'Tonelaje (kg)' : 'Peso máx (kg)';
  const data = sessions.map((x) =>
    metric === 'e1rm' ? Math.round(x.e1rm * 10) / 10 : metric === 'volume' ? Math.round(x.volume) : x.top,
  );
  return {
    type: 'line',
    data: {
      labels: sessions.map((x) => short(x.date)),
      datasets: [
        {
          label,
          data,
          borderColor: color,
          backgroundColor: color,
          tension: 0.25,
          yAxisID: 'y',
        },
      ],
    },
    options: {
      animation: { duration: 320, easing: 'easeOutCubic' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        tooltip: {
          callbacks: {
            title: (items) => {
              const s = items[0] ? sessions[items[0].dataIndex] : undefined;
              return s ? `${s.date.slice(8, 10)}/${s.date.slice(5, 7)}/${s.date.slice(0, 4)}` : '';
            },
            label: (ctx) => {
              const s = sessions[ctx.dataIndex];
              if (!s) return '';
              return `Peso máx: ${r1(s.top)} kg × ${s.repsAtTop} · e1RM: ${r1(s.e1rm)} kg · Tonelaje: ${Math.round(s.volume)} kg`;
            },
            afterBody: (items) => {
              const s = items[0] ? sessions[items[0].dataIndex] : undefined;
              if (!s) return [];
              const lines = [`Series: ${s.sets.map((x) => `${x.w}×${x.r}`).join(' · ')}`];
              if (s.avgHr != null) lines.push(`FC media: ${Math.round(s.avgHr)} lpm${s.maxHr ? ` (máx ${Math.round(s.maxHr)})` : ''}`);
              return lines;
            },
          },
        },
      },
    },
  };
}

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

function statusInline(e: ExStats, aiStatus?: string): string {
  const text = aiStatus || e.status;
  const st = STATUS_STYLE[e.statusColor] ?? STATUS_STYLE.gray;
  return `<span class="inline-flex max-w-full items-center gap-1.5 text-[13px] sm:text-sm font-semibold ${st.text}"><span class="h-2.5 w-2.5 shrink-0 rounded-full ${st.dot}" aria-hidden="true"></span><span class="truncate">${esc(text)}</span></span>`;
}

function aiStepLabel(title: string): string {
  if (/composici|cuerpo|antropo|peso|forma\s+f[ií]sica/i.test(title)) return 'Cuerpo';
  if (/rendimiento|fuerza|sobrecarga|ppl|progreso/i.test(title)) return 'Fuerza';
  if (/recuperaci|sueñ|suen|neat|card|descanso|pasos|energ[ií]a/i.test(title)) return 'Sueño y FC';
  if (/estrategia|mesociclo|próxim|proxim|plan/i.test(title)) return 'Plan';
  return title.split(/\s+/).slice(0, 2).join(' ');
}

export function renderAiJobStatus(S: State): string {
  const job = S.aiJob;
  if (!job || job.status === 'completed') return '';
  if (job.status === 'error') {
    return `<div role="alert" class="space-y-2 rounded-xl border border-coralRed/40 bg-coralRed/10 px-3 py-2.5 text-sm">
      <p class="font-semibold text-rose-200">No se pudo generar el informe.</p>
      <p class="text-gray-300">${esc(job.error ?? 'Se produjo un error inesperado.')}</p>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn-sm min-h-[44px] sm:min-h-[36px]" data-act="aiRetry">${icon('refresh', 'h-3.5 w-3.5')} Reintentar</button>
        <button type="button" class="btn-sm min-h-[44px] sm:min-h-[36px]" data-act="aiDismiss">Descartar aviso</button>
      </div>
    </div>`;
  }
  const resumed = job.attempts > 1 ? 'Reintentando generación tras recuperar la sesión…' : 'Generando informe…';
  return `<div role="status" aria-live="polite" class="rounded-xl border border-electricBlue/30 bg-electricBlue/10 px-3 py-2.5 text-sm text-blue-100">${resumed}</div>`;
}

export function renderAiReport(S: State): string {
  const ai = S.settings.ai;
  if (!ai) return '';

  const hasHighlights = Boolean(ai.overview?.highlights?.length);
  const steps: { label: string; dot: string; body: string }[] = [
    {
      label: 'Resumen',
      dot: 'bg-electricBlue',
      body: `
        <div class="grid grid-cols-1 gap-4 ${hasHighlights ? 'lg:grid-cols-12 lg:items-start' : ''}">
          <div class="space-y-2 ${hasHighlights ? 'lg:col-span-5' : ''}">
            ${ai.overview?.overallStatus ? `<p class="text-sm sm:text-[15px] font-semibold text-emerald-400">${esc(ai.overview.overallStatus)}</p>` : ''}
            ${ai.summary ? `<p class="text-sm sm:text-[15px] text-gray-100 leading-relaxed">${esc(ai.summary)}</p>` : ''}
          </div>
          ${hasHighlights ? `
            <ul class="border-t border-white/10 pt-3 space-y-2 lg:col-span-7 lg:border-t-0 lg:border-l lg:border-white/10 lg:pt-0 lg:pl-6">
              ${ai.overview!.highlights.map((h) => `
                <li class="flex items-start gap-2.5 text-xs sm:text-sm text-gray-300 leading-relaxed">
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
          <h3 class="text-base sm:text-lg font-bold ${titleC}">${esc(s.title)}</h3>
          <p class="text-[15px] sm:text-base text-gray-200 leading-7">${esc(s.text)}</p>
        `,
      };
    }),
  ];

  const activeIdx = Math.min(Math.max(0, S.aiTab ?? 0), steps.length - 1);
  const current = steps[activeIdx];
  const activeTone: AiTone = S.settings.aiTone === 'simple' ? 'simple' : 'technical';
  const reportTone: AiTone = ai.tone === 'simple' ? 'simple' : 'technical';
  const toneChanged = reportTone !== activeTone;

  return `<section id="ai-report" aria-label="Informe de IA" class="rounded-2xl border border-borderDark bg-cardDark p-4 sm:p-5 space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 class="text-base sm:text-lg font-extrabold text-white">Informe IA</h2>
        <p class="text-xs text-gray-400">Actualizado el ${fmtDate(ai.date)} · modo ${reportTone === 'simple' ? 'Sencillo' : 'Técnico'}${toneChanged ? ` <span class="text-amberGold">(cambiado a ${activeTone === 'simple' ? 'Sencillo' : 'Técnico'} · pulsa Actualizar)</span>` : ''}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        ${aiToneToggle(activeTone)}
        <button class="btn-sm" data-act="ai" ${S.busy === 'ai' ? 'disabled' : ''}>${icon('refresh', 'h-3.5 w-3.5')} ${S.busy === 'ai' ? 'Analizando…' : 'Actualizar'}</button>
      </div>
    </div>

    ${renderAiJobStatus(S)}

    ${steps.length > 1 ? `
    <div role="tablist" aria-label="Secciones del informe IA" class="flex flex-wrap gap-1.5">
      ${steps.map((st, idx) => `
        <button id="ai-tab-${idx}" role="tab" aria-selected="${idx === activeIdx}" aria-controls="ai-tabpanel" tabindex="${idx === activeIdx ? '0' : '-1'}" data-act="aiTab" data-arg="${idx}" class="tab whitespace-nowrap min-h-[44px] sm:min-h-[36px] px-3 py-1.5 text-xs sm:text-sm inline-flex items-center gap-2 ${idx === activeIdx ? 'tab-on' : ''}">
          <span class="h-1.5 w-1.5 rounded-full ${st.dot}" aria-hidden="true"></span>
          <span>${esc(st.label)}</span>
        </button>`).join('')}
    </div>` : ''}

    <div ${steps.length > 1 ? `id="ai-tabpanel" role="tabpanel" aria-labelledby="ai-tab-${activeIdx}"` : ''} class="space-y-3 pt-1">
      ${current.body}
    </div>
  </section>`;
}

function filterExByRange(e: ExStats, bounds: DateBounds): ExStats {
  if (!bounds.from && !bounds.to) return e;
  const sessions = e.sessions.filter((s) => inRange(s.date, bounds));
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

function lastMetric(ms: Measure[], hasFilter: boolean, key: keyof Measure) {
  const vals = ms.filter((m) => typeof m[key] === 'number');
  const cur = vals[vals.length - 1];
  const prev = hasFilter ? (vals.length > 1 ? vals[0] : undefined) : vals[vals.length - 2];
  return {
    val: cur?.[key] as number | undefined,
    prev: prev?.[key] as number | undefined,
    date: cur?.date,
  };
}

function renderLoadControlBlock(
  rows: { d: DayName; c: string; e: ExStats }[],
  S: State,
  hasFilter: boolean,
): string {
  const ai = S.settings.ai;
  const freshStatus = (e: ExStats) => (!hasFilter && isAiFreshForEx(S, S.analysis.exercises.get(e.name) ?? e) ? ai?.byExercise[e.name]?.status : undefined);
  const tableHtml = `
    <div class="hidden md:block overflow-x-auto">
      <table class="table-fixed w-full text-left text-sm">
        <thead class="text-xs uppercase text-gray-400 border-b border-white/15">
          <tr>
            <th class="w-20 py-2.5 pr-3">Día</th>
            <th class="w-[28%] pr-3">Ejercicio</th>
            <th class="w-16 pr-3 text-right">Obj.</th>
            <th class="w-24 pr-3 text-right">Última</th>
            <th class="w-[26%] pr-3">Series</th>
            <th class="w-[26%]">Estado</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/10">
          ${rows.map(({ d, c, e }) => {
            const aiSt = freshStatus(e);
            return `
            <tr data-act="openExDetail" data-arg="${esc(d)}|${esc(e.name)}" role="button" tabindex="0" class="cursor-pointer hover:bg-white/[0.03] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue">
              <td class="py-3 pr-3 truncate"><span style="color:${c}" class="font-bold">${esc(d)}</span></td>
              <td class="py-3 pr-3 font-medium text-white truncate" title="${esc(e.name)}">${esc(e.name)}</td>
              <td class="py-3 pr-3 text-right tabular-nums text-sm font-medium text-gray-300">${e.target ? `${e.target.sets}×${e.target.reps}` : '—'}</td>
              <td class="py-3 pr-3 text-right tabular-nums text-sm text-gray-300">${e.last ? short(e.last.date) : '—'}</td>
              <td class="py-3 pr-3 tabular-nums text-sm font-medium text-gray-100 truncate" title="${e.last ? esc(e.last.sets.map((s) => `${s.w}×${s.r}`).join(' · ')) : ''}">${e.last ? esc(e.last.sets.map((s) => `${s.w}×${s.r}`).join(' · ')) : '—'}</td>
              <td class="py-3 truncate" title="${esc(aiSt ?? e.status)}">${statusInline(e, aiSt)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;

  const mobileHtml = `
    <div class="md:hidden divide-y divide-white/10">
      ${rows.map(({ d, c, e }) => `
        <div data-act="openExDetail" data-arg="${esc(d)}|${esc(e.name)}" role="button" tabindex="0" class="py-3 space-y-1.5 cursor-pointer rounded-xl px-1 -mx-1 hover:bg-white/[0.03] active:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue">
          <div class="flex items-center justify-between gap-2">
            <div class="flex min-w-0 items-center gap-2">
              <span style="color:${c}" class="min-w-[3rem] max-w-[6.5rem] shrink-0 truncate text-xs font-extrabold uppercase tracking-wide">${esc(d)}</span>
              <span class="truncate text-[15px] font-semibold text-white" title="${esc(e.name)}">${esc(e.name)}</span>
            </div>
            <span class="shrink-0 rounded-md bg-white/[0.06] px-2 py-0.5 tabular-nums text-[13px] font-semibold text-gray-200">${e.target ? `${e.target.sets}×${e.target.reps}` : '—'}</span>
          </div>
          <div class="pl-1 tabular-nums text-sm font-medium text-gray-200 truncate">${e.last ? `${short(e.last.date)} · ${esc(e.last.sets.map((s) => `${s.w}×${s.r}`).join(' · '))}` : 'Sin registros'}</div>
          <div class="pl-1 pt-0.5 truncate">${statusInline(e, freshStatus(e))}</div>
        </div>`).join('')}
    </div>`;

  return `<section class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-base font-bold text-white">Control de cargas del bloque</h2>
      <button class="btn-primary-sm sm:text-sm" data-act="goLog">+ Registrar entreno</button>
    </div>
    ${mobileHtml}
    ${tableHtml}
  </section>`;
}

function renderOnboardingHome(S: State): string {
  const routines = routineNames(S.settings);
  const tpls = Object.entries(ROUTINE_TEMPLATES);
  return `<div class="space-y-6">
  <section class="rounded-2xl border border-white/10 bg-cardDark p-5 sm:p-6 space-y-5">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="space-y-1">
        <span class="text-xs font-semibold uppercase tracking-wider text-emerald-400">Primeros pasos</span>
        <h2 class="text-xl sm:text-2xl font-extrabold text-white">Tu cuaderno de entrenamiento está listo</h2>
        <p class="text-sm text-gray-300 max-w-2xl">Registra tu primer entreno directamente desde aquí o elige una distribución base. Si ya tienes historial en Samsung Health o CSV, puedes importarlo cuando quieras.</p>
      </div>
      <div class="flex flex-wrap gap-2 shrink-0">
        <button type="button" class="btn btn-accent min-h-[44px]" data-act="openWizard">${S.settings.onboardingCompleted ? 'Editar perfil y objetivo' : 'Configurar perfil y objetivo (1 min)'}</button>
        <button class="btn-primary shrink-0 min-h-[44px] px-5" data-act="startWorkout">+ Empezar primer entreno hoy</button>
      </div>
    </div>

    <div class="space-y-2 border-t border-white/10 pt-4">
      <p class="text-xs font-semibold uppercase tracking-wider text-gray-400">Iniciar directamente una rutina activa</p>
      <div class="flex flex-wrap items-center gap-2">
        ${routines.map((r, idx) => {
          const hex = routineColor(r, S.settings, idx);
          const count = S.settings.routines[r]?.length ?? 0;
          return `<button type="button" class="btn min-h-[44px]" data-act="startWorkout" data-arg="${esc(r)}">
            <span class="h-2.5 w-2.5 rounded-full" style="background:${hex}" aria-hidden="true"></span>
            <span>${esc(r)}</span>
            <span class="text-xs text-gray-400 tabular-nums">(${count})</span>
          </button>`;
        }).join('')}
        <button type="button" class="btn-sm" data-act="goLog">¿Ya terminaste? Registrar sesión pasada</button>
      </div>
    </div>
  </section>

  <section class="space-y-3 pb-5 border-b border-white/10">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 class="text-base font-bold text-white">Plantillas de rutina</h3>
        <p class="text-xs text-gray-400">Cambia la distribución en un toque o edita los ejercicios a tu gusto.</p>
      </div>
      <button class="btn-sm" data-act="tab" data-arg="plan">Personalizar en Plan y rutinas</button>
    </div>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      ${tpls.map(([key, tpl]) => `
        <button type="button" data-act="rtApplyTpl" data-arg="${esc(key)}" class="rounded-2xl border border-white/10 bg-cardDark p-4 text-left transition-colors hover:border-electricBlue/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue">
          <div class="text-sm font-bold text-white">${esc(tpl.label)}</div>
          <p class="mt-1 text-xs text-gray-400 leading-relaxed">${esc(tpl.desc)}</p>
        </button>`).join('')}
    </div>
  </section>

  <section class="flex flex-wrap items-center justify-between gap-3">
    <div class="text-sm text-gray-300">¿Prefieres empezar registrando tu peso inicial o trayendo datos previos?</div>
    <div class="flex flex-wrap gap-2">
      <button class="btn min-h-[44px]" data-act="tab" data-arg="body">${icon('body', 'h-4 w-4')} Registrar primeras medidas</button>
      <button class="btn min-h-[44px]" data-act="tab" data-arg="data">${icon('upload', 'h-4 w-4')} Importar Samsung Health / CSV</button>
    </div>
  </section>
</div>`;
}

/** Construye la configuración de composición corporal para Resumen evitando crear eje `y1` si falta `% Grasa` o peso. */
export function buildBodyHomeChartConfig(ms: Measure[]): ChartConfiguration<'line'> | null {
  const mm = ms.filter((m) => m.weight != null || m.bf != null);
  if (!mm.length) return null;
  const hasWeight = mm.some((m) => m.weight != null);
  const hasBf = mm.some((m) => m.bf != null);
  const datasets: ChartConfiguration<'line'>['data']['datasets'] = [];
  if (hasWeight) {
    const trend7 = movingAverage7d(mm);
    datasets.push(
      { label: 'Tendencia 7d (kg)', data: trend7, borderColor: '#3B82F6', backgroundColor: '#3B82F6', borderWidth: 2.5, pointRadius: 0, yAxisID: 'y', tension: 0.3, spanGaps: true },
      { label: 'Peso diario (kg)', data: mm.map((m) => m.weight ?? null), borderColor: 'rgba(59,130,246,0.38)', backgroundColor: 'rgba(59,130,246,0.5)', borderDash: [3, 3], borderWidth: 1.5, pointRadius: 2, yAxisID: 'y', tension: 0.2, spanGaps: true },
    );
  }
  if (hasBf) {
    datasets.push({ label: '% Grasa', data: mm.map((m) => m.bf ?? null), borderColor: '#F59E0B', backgroundColor: '#F59E0B', yAxisID: hasWeight ? 'y1' : 'y', tension: 0.25, spanGaps: true });
  }
  return {
    type: 'line',
    data: { labels: mm.map((m) => short(m.date)), datasets },
    options: {
      scales: hasWeight && hasBf
        ? { y: { position: 'left' }, y1: { position: 'right', grid: { drawOnChartArea: false } } }
        : { y: { position: 'left' } },
    },
  };
}

function homeExercises(S: State): ExStats[] {
  return [...S.analysis.exercises.values()]
    .filter((e) => e.day || e.sessions.length > 0)
    .sort((a, b) => Number(Boolean(b.day)) - Number(Boolean(a.day)) || b.n - a.n);
}

/** Construye la configuración de progresión del ejercicio seleccionado en Resumen. */
export function buildHomeExChartConfig(S: State): ChartConfiguration<'line'> | null {
  const bounds = resolveRange(S, 'home');
  const ex = homeExercises(S);
  const cur = S.sel.home && S.analysis.exercises.has(S.sel.home) ? S.sel.home : ex[0]?.name;
  const curEx = cur ? filterExByRange(S.analysis.exercises.get(cur)!, bounds) : undefined;
  return curEx && curEx.sessions.length ? exerciseChartConfig(curEx.sessions, '#3B82F6', S.exMetric ?? 'top') : null;
}

/** Renderiza la vista principal de resumen con diseño híbrido (hero compacto, secciones abiertas e Informe IA sobrio). */
export function viewHome(S: State): string {
  if (!S.strength.length && !S.measures.length && !S.cardio.length && !S.wellbeing.length) {
    return renderOnboardingHome(S);
  }

  const bounds = resolveRange(S, 'home');
  const hasFilter = Boolean(bounds.from || bounds.to);
  const rangeLabel = bounds.label;
  const rangeDays = bounds.days;

  const msAll = S.measures;
  const ms = hasFilter ? msAll.filter((m) => inRange(m.date, bounds)) : msAll;
  const last = ms[ms.length - 1];
  const mWeight = lastMetric(ms, hasFilter, 'weight');
  const mBf = lastMetric(ms, hasFilter, 'bf');
  const mMuscle = lastMetric(ms, hasFilter, 'muscle');
  const mWaist = lastMetric(ms, hasFilter, 'waist');

  const sessAll = S.analysis.sessions;
  const sess = hasFilter ? sessAll.filter((x) => inRange(x.date, bounds)) : sessAll;
  const lastS = sess[sess.length - 1];
  const since28 = todayIso(new Date(Date.now() - 28 * 864e5));
  const since7 = todayIso(new Date(Date.now() - 7 * 864e5));
  const activeDays = new Set((hasFilter ? sess : sess.filter((x) => x.date >= since28)).map((x) => x.date)).size;
  const weeks = rangeDays ? Math.max(1, rangeDays / 7) : 4;
  const phase = currentPhase(S.settings);

  const wScope = hasFilter ? S.wellbeing.filter((w) => inRange(w.date, bounds)) : S.wellbeing.filter((w) => w.date >= since7);
  const wBaseline = hasFilter ? wScope : S.wellbeing.filter((w) => w.date >= since28);
  const sleepMain = mean(wScope.map((w) => (w.sleepMin != null ? w.sleepMin / 60 : undefined)));
  const stepsMain = mean(wScope.map((w) => w.steps));
  const rhrMain = mean(wScope.map((w) => w.rhr));
  const hrvMain = mean(wScope.map((w) => w.hrv));
  const hrForce = mean((hasFilter ? sess : sessAll.filter((x) => x.date >= since28)).map((x) => x.avgHr));
  const showWellbeing = S.wellbeing.length > 0 || wBaseline.length > 0 || hrForce != null;

  const ex = homeExercises(S);
  const cur = S.sel.home && S.analysis.exercises.has(S.sel.home) ? S.sel.home : ex[0]?.name;
  const curEx = cur ? filterExByRange(S.analysis.exercises.get(cur)!, bounds) : undefined;
  const metric: ExMetric = S.exMetric ?? 'top';

  const homeExCfg = buildHomeExChartConfig(S);
  if (homeExCfg) chart('c-home-ex', homeExCfg);
  const mm = ms.filter((m) => m.weight != null || m.bf != null);
  const bodyHomeCfg = buildBodyHomeChartConfig(ms);
  if (bodyHomeCfg) chart('c-home-body', bodyHomeCfg);

  const routines = routineNames(S.settings);
  const rows = routines.flatMap((d, idx) => (S.analysis.byDay[d] ?? []).map((e) => ({ d, c: routineColor(d, S.settings, idx), e: filterExByRange(e, bounds) })));
  const ai = S.settings.ai;
  const tone: AiTone = S.settings.aiTone === 'simple' ? 'simple' : 'technical';
  const lastDayHex = lastS?.day ? routineColor(lastS.day, S.settings, Math.max(0, routines.indexOf(lastS.day))) : '#3B82F6';
  const lastBadge = lastS ? routineShort(lastS.day ?? 'Sesión') : '—';
  const wDelta = delta(mWeight.val, mWeight.prev, '');
  const wDeltaCls = mWeight.val != null && mWeight.prev != null ? weightDeltaColor(mWeight.val - mWeight.prev, phase?.name) : 'text-emerald-400';
  const bfDelta = delta(mBf.val, mBf.prev, '%');

  const fourthMetric = showWellbeing
    ? (sleepMain != null || stepsMain != null
        ? {
            lbl: `Sueño / Pasos (${rangeLabel})`,
            val: sleepMain != null ? `${r1(sleepMain)} h` : '—',
            sub: stepsMain != null ? ` · ${stepsMain >= 1000 ? `${r1(stepsMain / 1000)}k` : Math.round(stepsMain)}` : '',
            cls: 'text-blue-300',
          }
        : {
            lbl: `Pulso (${rangeLabel})`,
            val: rhrMain != null ? `${Math.round(rhrMain)} lpm` : hrForce != null ? `${Math.round(hrForce)} lpm` : '—',
            sub: hrvMain != null ? ` · HRV ${Math.round(hrvMain)}` : hrForce != null && rhrMain != null ? ` · fuerza ${Math.round(hrForce)}` : '',
            cls: 'text-cyan-300',
          })
    : {
        lbl: `Medidas (${rangeLabel})`,
        val: String(ms.length),
        sub: last ? ` · última ${short(last.date)}` : '',
        cls: 'text-blue-300',
      };

  const aiPanel = ai
    ? renderAiReport(S)
    : `<section id="ai-report" aria-label="Informe de IA" class="rounded-2xl border border-borderDark bg-cardDark p-4 sm:p-5 space-y-3.5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-base font-extrabold text-white">Informe IA</h2>
            <p class="text-xs text-gray-400">Resumen personalizado de tus cargas y recuperación.</p>
          </div>
          ${aiToneToggle(tone)}
        </div>
        ${renderAiJobStatus(S)}
        <button class="btn-primary w-full text-xs sm:text-sm" data-act="ai" ${S.busy === 'ai' ? 'disabled' : ''}>${icon('chart', 'h-3.5 w-3.5')} ${S.busy === 'ai' ? 'Analizando…' : 'Generar análisis IA'}</button>
      </section>`;

  return `<div class="space-y-6">
  ${noData(S)}

  <section class="pb-5 border-b border-white/10 space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-3">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-sm font-extrabold tabular-nums" style="background:${lastDayHex}1A;border-color:${lastDayHex}4D;color:${lastDayHex}">${esc(lastBadge)}</div>
        <div class="min-w-0">
          <div class="flex items-center gap-2 text-xs text-gray-400">
            <span class="font-semibold uppercase tracking-wider">Último entreno</span>
            <span>· ${lastS ? fmtDate(lastS.date) : `Sin sesiones${hasFilter ? ` (${esc(rangeLabel)})` : ''}`}</span>
          </div>
          <p class="text-lg sm:text-xl font-extrabold text-white truncate">
            ${lastS ? esc(lastS.day ?? 'Sesión') : '—'}
            <span class="text-xs sm:text-sm font-normal text-gray-400"> · ${activeDays} días activos (${r1(activeDays / weeks)}/sem)${phase ? ` · ${esc(phase.name)}` : ''}${lastS?.durMin ? ` · ${Math.round(lastS.durMin)} min` : ''}${lastS?.avgHr ? ` · ${lastS.avgHr} lpm` : ''}</span>
          </p>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button class="btn-primary min-h-[44px] px-4 py-2 text-xs sm:text-sm" data-act="startWorkout">${icon('play', 'h-3.5 w-3.5')} Iniciar entreno</button>
        <button class="btn min-h-[44px] px-3 py-2 text-xs sm:text-sm" data-act="goLog">${icon('edit', 'h-3.5 w-3.5')} Registrar hecho</button>
      </div>
    </div>

    <div class="pt-3 border-t border-white/10 space-y-4">
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 text-xs">
        <div class="min-w-0">
          <span class="text-gray-400 block">Peso</span>
          <div class="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
            <span class="whitespace-nowrap tabular-nums text-base sm:text-lg font-extrabold text-white">${mWeight.val != null ? `${r1(mWeight.val)} kg` : '—'}</span>
            ${wDelta ? `<span class="whitespace-nowrap tabular-nums font-semibold ${wDeltaCls}">${esc(wDelta)}</span>` : mWeight.date ? `<span class="whitespace-nowrap tabular-nums text-gray-400">${short(mWeight.date)}</span>` : ''}
          </div>
        </div>
        <div class="min-w-0">
          <span class="text-gray-400 block">% Grasa</span>
          <div class="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
            <span class="whitespace-nowrap tabular-nums text-base sm:text-lg font-extrabold text-amberGold">${mBf.val != null ? `${r1(mBf.val)}%` : '—'}</span>
            ${bfDelta ? `<span class="whitespace-nowrap tabular-nums text-gray-400">${esc(bfDelta)}</span>` : mBf.date ? `<span class="whitespace-nowrap tabular-nums text-gray-400">${short(mBf.date)}</span>` : ''}
          </div>
        </div>
        <div class="min-w-0">
          <span class="text-gray-400 block">Músculo / Cintura</span>
          <div class="mt-0.5 flex flex-wrap items-baseline gap-x-1">
            <span class="whitespace-nowrap tabular-nums text-base sm:text-lg font-extrabold text-emeraldGreen">${mMuscle.val != null ? `${r1(mMuscle.val)} kg` : '—'}</span>
            <span class="whitespace-nowrap tabular-nums text-sm font-semibold text-gray-300">/ ${mWaist.val != null ? `${r1(mWaist.val)} cm` : '—'}</span>
          </div>
        </div>
        <div class="min-w-0">
          <span class="text-gray-400 block truncate">${esc(fourthMetric.lbl)}</span>
          <div class="mt-0.5 flex flex-wrap items-baseline gap-x-1">
            <span class="whitespace-nowrap tabular-nums text-base sm:text-lg font-extrabold ${fourthMetric.cls}">${esc(fourthMetric.val)}</span>
            ${fourthMetric.sub ? `<span class="whitespace-nowrap tabular-nums text-xs sm:text-sm text-gray-300">${esc(fourthMetric.sub)}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
        <span class="text-xs font-medium text-gray-400">Periodo de análisis</span>
        ${rangePicker('home', bounds.key, S.customRanges?.home)}
      </div>
    </div>
  </section>

  ${aiPanel}

  <section class="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-5 border-b border-white/10">
    <div class="min-w-0 space-y-2 pb-4 border-b border-white/10 lg:pb-0 lg:border-b-0">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 class="text-base font-bold text-white">Evolución de cargas</h2>
          <p class="text-xs text-gray-400">Toca un punto para ver repes, e1RM y tonelaje</p>
        </div>
        <div class="flex flex-wrap items-center gap-2 max-w-full">
          ${exMetricToggle(metric)}
          <select class="inp w-auto max-w-full sm:max-w-[220px]" data-change="selHome" aria-label="Seleccionar ejercicio para gráfica">${ex.map((e) => `<option ${e.name === cur ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select>
        </div>
      </div>
      ${curEx?.sessions.length ? `<div class="chart-box"><canvas id="c-home-ex"></canvas></div>` : `<p class="py-12 text-center text-sm text-gray-400">Sin sesiones para este ejercicio en ${esc(rangeLabel)}.</p>`}
    </div>

    <div class="min-w-0 space-y-2">
      <div>
        <h2 class="text-base font-bold text-white">Peso y % de grasa</h2>
        <p class="text-xs text-gray-400">Tendencia media 7 días + registros (${esc(rangeLabel)})</p>
      </div>
      ${mm.length ? `<div class="chart-box"><canvas id="c-home-body"></canvas></div>` : `<p class="py-12 text-center text-sm text-gray-400">Sin mediciones de peso en ${esc(rangeLabel)}.</p>`}
    </div>
  </section>

  ${renderLoadControlBlock(rows, S, hasFilter)}
</div>`;
}

function renderDayDetail(
  S: State,
  e: ExStats,
  canvasId: string,
  historyLimit: number,
  rangeLabel: string,
  hasFilter: boolean,
  embedded = false,
): string {
  const ai = S.settings.ai?.byExercise ?? {};
  const a = !hasFilter && isAiFreshForEx(S, S.analysis.exercises.get(e.name) ?? e) ? ai[e.name] : undefined;
  const userNote = S.settings.notes[e.name]?.trim() ?? '';
  const aiBiomech = a?.biomech?.trim() ?? '';
  const recent = [...e.sessions].reverse().slice(0, historyLimit);
  const metric: ExMetric = S.exMetric ?? 'top';
  const prescLabel = a?.prescription && S.settings.ai?.date ? `Próxima sesión · IA (${short(S.settings.ai.date)})` : 'Próxima sesión';

  return `<div class="${embedded ? 'border-t border-white/10 bg-embedDark p-4 space-y-4' : 'rounded-2xl border border-white/10 bg-cardDark p-4 sm:p-5 space-y-5'}">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        ${embedded ? '' : `<h3 class="text-lg font-extrabold text-white">${esc(e.name)}</h3>`}
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 ${embedded ? '' : 'mt-1'}">
          ${statusInline(e, a?.status)}
          <span class="text-xs text-gray-400 tabular-nums">Objetivo ${e.target ? `${e.target.sets}×${e.target.reps}` : '—'} · ${e.n} sesiones</span>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button class="btn-primary-sm" data-act="startWorkout" ${e.day ? `data-arg="${esc(e.day)}"` : ''}>Entrenar hoy</button>
        <button class="btn-sm" data-act="editNote" data-arg="${esc(e.name)}">${icon('edit', 'h-3.5 w-3.5')} Nota</button>
      </div>
    </div>

    <div class="border-l-2 border-emeraldGreen pl-3.5 py-0.5">
      <p class="text-xs font-semibold uppercase tracking-wider text-emerald-400">${prescLabel}</p>
      <p class="mt-1 text-sm sm:text-[15px] text-gray-100 leading-relaxed">${esc(a?.prescription ?? e.prescription)}</p>
    </div>

    <div class="grid grid-cols-3 gap-3 border-y border-white/5 py-3">
      <div><span class="block text-xs text-gray-400">Peso máx</span><span class="mt-0.5 block text-base sm:text-lg font-bold text-white tabular-nums">${e.n ? `${e.maxWeight} kg` : '—'}</span></div>
      <div><span class="block text-xs text-gray-400">e1RM pico</span><span class="mt-0.5 block text-base sm:text-lg font-bold text-white tabular-nums">${e.n ? `${r1(e.maxE1rm)} kg` : '—'}</span></div>
      <div><span class="block text-xs text-gray-400">FC media</span><span class="mt-0.5 block text-base sm:text-lg font-bold text-cyan-300 tabular-nums">${e.avgHr ? `${e.avgHr} lpm` : '—'}</span></div>
    </div>

    <div class="space-y-2">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-xs font-semibold text-gray-400">Progresión · toca un punto para ver repes, e1RM y pulso</p>
        ${exMetricToggle(metric)}
      </div>
      ${e.sessions.length ? `<div class="chart-box"><canvas id="${canvasId}"></canvas></div>` : `<p class="py-8 text-center text-sm text-gray-400">Sin registros para este ejercicio en ${esc(rangeLabel)}.</p>`}
    </div>

    ${e.last?.note ? `<p class="flex items-start gap-2 text-xs sm:text-sm text-amberGold">${icon('note', 'h-4 w-4 mt-0.5')}<span>Última nota: ${esc(e.last.note)}</span></p>` : ''}
    ${userNote ? `<p class="text-xs sm:text-sm text-gray-200 leading-relaxed"><span class="font-semibold text-white">Nota fija:</span> ${esc(userNote)}</p>` : ''}
    ${aiBiomech && aiBiomech !== userNote ? `<p class="text-xs sm:text-sm text-gray-300 leading-relaxed"><span class="font-semibold text-gray-200">Biomecánica (IA):</span> ${esc(aiBiomech)}</p>` : ''}

    ${recent.length ? `<div class="space-y-2 pt-2 border-t border-white/10">
      <p class="text-xs font-semibold uppercase tracking-wider text-gray-400">Últimas sesiones</p>
      <div class="divide-y divide-white/10">
        ${recent.map((x) => {
          const meta = [
            x.avgHr ? `<span class="text-cyan-300">${Math.round(x.avgHr)}${x.maxHr ? `/${Math.round(x.maxHr)}` : ''} lpm</span>` : '',
            x.durMin ? `${Math.round(x.durMin)}m` : '',
          ].filter(Boolean).join(' · ');
          return `
          <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 text-sm">
            <span class="font-medium text-gray-300 tabular-nums">${fmtDate(x.date)}</span>
            <span class="font-semibold text-gray-100 tabular-nums">${esc(x.sets.map((s) => `${s.w}×${s.r}`).join(' · '))}</span>
            ${meta ? `<span class="text-[13px] text-gray-400 tabular-nums">${meta}</span>` : ''}
            ${x.note ? `<span class="w-full text-xs text-amberGold">${esc(x.note)}</span>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}
  </div>`;
}

/** Renderiza la vista de detalle de una rutina en formato Maestro + Detalle (y acordeón en móvil). */
export function viewDay(S: State, day: DayName): string {
  const bounds = resolveRange(S, day);
  const hasFilter = Boolean(bounds.from || bounds.to);
  const rangeLabel = bounds.label;
  const routines = routineNames(S.settings);
  const dayColor = routineColor(day, S.settings, Math.max(0, routines.indexOf(day)));

  const analyzedByDay = (S.analysis.byDay[day] ?? []).map((e) => filterExByRange(e, bounds));
  const analyzedNorms = new Set(analyzedByDay.map((e) => norm(e.name)));
  const plannedOnly: ExStats[] = (S.settings.routines[day] ?? [])
    .filter((r) => r.name.trim() && !analyzedNorms.has(norm(r.name)))
    .map((r) => ({
      name: r.name,
      day,
      target: r,
      sessions: [],
      last: undefined,
      n: 0,
      maxWeight: 0,
      maxE1rm: 0,
      status: 'Pendiente de estrenar',
      statusColor: 'electricBlue' as const,
      prescription: `Estrena este ejercicio hoy: objetivo ${r.sets} series de ${r.reps} repeticiones con un peso que controles dejando 1–2 repeticiones en reserva.`,
    }));
  const primary = [...analyzedByDay, ...plannedOnly];
  const primaryNorms = new Set(primary.map((e) => norm(e.name)));
  const extraAll = [...S.analysis.exercises.values()]
    .filter((e) => !primaryNorms.has(norm(e.name)) && !e.name.startsWith('Samsung #') && (e.day === day || e.day == null))
    .map((e) => filterExByRange(e, bounds))
    .filter((e) => !hasFilter || e.n > 0)
    .sort((a, b) => (a.day === day ? 0 : 1) - (b.day === day ? 0 : 1) || b.n - a.n);

  if (!primary.length && !extraAll.length) {
    return `<div class="card flex flex-wrap items-center justify-between gap-3 text-sm text-gray-300">
      <p>Esta rutina aún no tiene ejercicios asignados.</p>
      <div class="flex flex-wrap gap-2">
        <button class="btn-sm" data-act="tab" data-arg="plan">Configurar rutina en Plan</button>
        <button class="btn-primary-sm" data-act="startWorkout" data-arg="${esc(day)}">${icon('play', 'h-3.5 w-3.5')} Iniciar ${esc(day)}</button>
      </div>
    </div>`;
  }

  const showingExtra = Boolean(S.dayExtra?.[day]) && extraAll.length > 0;
  const visibleList = showingExtra ? extraAll : primary.length ? primary : extraAll;
  const allPool = [...primary, ...extraAll];

  const rawSel = S.sel[day];
  const desktopCur = rawSel && visibleList.some((e) => e.name === rawSel) ? rawSel : visibleList[0].name;
  const mobileCur = rawSel === '__closed__' ? undefined : desktopCur;

  const metric: ExMetric = S.exMetric ?? 'top';
  const registerDayChart = (canvasId: string, exName: string) => {
    const e = allPool.find((x) => x.name === exName)!;
    if (!e.sessions.length) return;
    chart(canvasId, exerciseChartConfig(e.sessions, dayColor, metric));
  };

  registerDayChart('c-day', desktopCur);
  if (mobileCur) registerDayChart('c-day-mob', mobileCur);

  const sessAll = S.analysis.sessions.filter((x) => x.day === day);
  const sess = hasFilter ? sessAll.filter((x) => inRange(x.date, bounds)) : sessAll;
  const lastS = sess[sess.length - 1];
  const ai = S.settings.ai?.byExercise ?? {};
  const desktopEx = allPool.find((x) => x.name === desktopCur)!;

  const dEsc = esc(day);
  const scopeToggle = extraAll.length && primary.length
    ? `<div role="tablist" aria-label="Filtro de ejercicios" class="inline-flex rounded-xl border border-white/10 bg-gray-900/70 p-1 gap-1">
        <button role="tab" aria-selected="${!showingExtra}" data-act="setDayScope" data-arg="${dEsc}|routine" class="inline-flex min-h-[44px] sm:min-h-[34px] items-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${!showingExtra ? 'bg-electricBlue text-white' : 'text-gray-400 hover:text-white'}">En rutina (${primary.length})</button>
        <button role="tab" aria-selected="${showingExtra}" data-act="setDayScope" data-arg="${dEsc}|extra" class="inline-flex min-h-[44px] sm:min-h-[34px] items-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${showingExtra ? 'bg-electricBlue text-white' : 'text-gray-400 hover:text-white'}">Anteriores (${extraAll.length})</button>
      </div>`
    : '';

  return `<div class="space-y-5">
  <section class="pb-4 border-b border-white/10 space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="space-y-0.5">
        <div class="flex items-center gap-2">
          <span class="h-3 w-3 shrink-0 rounded-full" style="background-color:${dayColor}" aria-hidden="true"></span>
          <h2 class="text-lg font-extrabold text-white">Rutina ${esc(day)}</h2>
          <span class="text-xs text-gray-400">· ${sess.length} sesiones${hasFilter ? ` (${esc(rangeLabel)})` : ''}</span>
        </div>
        <p class="text-xs sm:text-sm text-gray-400 tabular-nums">${lastS ? `Última: ${fmtDate(lastS.date)} · ${lastS.sets} series${lastS.durMin ? ` · ${Math.round(lastS.durMin)} min` : ''}${lastS.avgHr ? ` · Pulso ${lastS.avgHr}${lastS.maxHr ? `/${lastS.maxHr}` : ''} lpm` : ''}${lastS.kcal ? ` · ${lastS.kcal} kcal` : ''}` : `Sin sesiones en ${esc(rangeLabel)}`}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto">
        ${S.analysis.unmapped.length ? `<button class="btn-sm border-amberGold/40 text-amberGold" data-act="openUnmapped">${S.analysis.unmapped.length} sin nombre</button>` : ''}
        <button class="btn-sm sm:text-sm" data-act="tab" data-arg="plan">${icon('edit', 'h-3.5 w-3.5')} Editar rutina</button>
        <button class="btn-sm sm:text-sm" data-act="goLog" data-arg="${dEsc}">Registrar hecho</button>
        <button class="btn-primary-sm flex-1 sm:flex-initial sm:text-sm" data-act="startWorkout" data-arg="${dEsc}">${icon('play', 'h-3.5 w-3.5')} Iniciar ${dEsc}</button>
      </div>
    </div>
    <div class="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3">
      ${scopeToggle || '<span></span>'}
      ${rangePicker(day, bounds.key, S.customRanges?.[day])}
    </div>
  </section>

  <!-- Móvil: acordeón maestro-detalle in-place -->
  <div class="lg:hidden space-y-3">
    ${visibleList.map((x) => {
      const open = x.name === mobileCur;
      const st = STATUS_STYLE[x.statusColor] ?? STATUS_STYLE.gray;
      const lastTxt = x.last
        ? `${short(x.last.date)} · ${x.last.sets.map((s) => `${s.w}×${s.r}`).join(' · ')}`
        : x.n === 0 && x.target
          ? `Objetivo ${x.target.sets}×${x.target.reps} · Sin estrenar`
          : `Sin registros en ${esc(rangeLabel)}`;
      return `<div class="rounded-2xl border ${open ? 'border-electricBlue/60' : 'border-white/10'} bg-cardDark overflow-hidden">
        <button data-act="selEx" data-arg="${dEsc}|${open ? '__closed__' : esc(x.name)}" aria-expanded="${open}" class="w-full p-4 text-left flex items-center justify-between gap-3 transition-colors hover:bg-white/[0.02]">
          <div class="min-w-0 space-y-1">
            <p class="text-sm font-bold text-white truncate">${esc(x.name)}</p>
            <p class="text-[13px] font-medium text-gray-300 tabular-nums truncate">${lastTxt}</p>
          </div>
          <div class="shrink-0 flex items-center gap-2.5">
            <span class="h-2.5 w-2.5 rounded-full ${st.dot}" title="${esc((!hasFilter && isAiFreshForEx(S, S.analysis.exercises.get(x.name) ?? x) ? ai[x.name]?.status : undefined) ?? x.status)}"></span>
            <span class="text-xs text-gray-400">${open ? '▲' : '▼'}</span>
          </div>
        </button>
        ${open ? renderDayDetail(S, x, 'c-day-mob', 8, rangeLabel, hasFilter, true) : ''}
      </div>`;
    }).join('')}
  </div>

  <!-- Escritorio: maestro izquierda + detalle fijo derecha -->
  <div class="hidden lg:grid lg:grid-cols-12 lg:gap-5 xl:gap-6 lg:items-start">
    <div class="lg:col-span-5 xl:col-span-4 space-y-2" role="listbox" aria-orientation="vertical" aria-label="Ejercicios de ${dEsc}">
      ${visibleList.map((x, idx) => {
        const sel = x.name === desktopCur;
        const st = STATUS_STYLE[x.statusColor] ?? STATUS_STYLE.gray;
        const lastTxt = x.last
        ? `${short(x.last.date)} · ${x.last.sets.map((s) => `${s.w}×${s.r}`).join(' · ')}`
        : x.n === 0 && x.target
          ? `Objetivo ${x.target.sets}×${x.target.reps} · Sin estrenar`
          : `Sin registros en ${esc(rangeLabel)}`;
        const rightMeta = x.target ? `${x.target.sets}×${x.target.reps}` : `${x.n} ses.`;
        return `<button id="day-opt-${idx}" role="option" tabindex="${sel ? '0' : '-1'}" data-act="selEx" data-arg="${dEsc}|${esc(x.name)}" aria-selected="${sel}" class="w-full rounded-2xl border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${sel ? 'border-electricBlue bg-electricBlue/10' : 'border-white/10 bg-cardDark hover:border-white/25'}">
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-bold text-white truncate">${esc(x.name)}</span>
            <span class="h-2.5 w-2.5 shrink-0 rounded-full ${st.dot}" title="${esc((!hasFilter && isAiFreshForEx(S, S.analysis.exercises.get(x.name) ?? x) ? ai[x.name]?.status : undefined) ?? x.status)}"></span>
          </div>
          <div class="mt-1 flex items-center justify-between gap-2 text-[13px] text-gray-300">
            <span class="font-medium tabular-nums truncate">${lastTxt}</span>
            <span class="shrink-0 font-semibold text-gray-200 tabular-nums">${rightMeta}</span>
          </div>
        </button>`;
      }).join('')}
    </div>
    <div class="lg:col-span-7 xl:col-span-8 lg:sticky lg:top-6">
      ${renderDayDetail(S, desktopEx, 'c-day', 20, rangeLabel, hasFilter, false)}
    </div>
  </div>
</div>`;
}
