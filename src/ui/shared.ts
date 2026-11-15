import { Chart, registerables, type ChartConfiguration } from 'chart.js';
import type { Analysis, ExStats } from '../lib/analysis';
import type { CloudUser } from '../lib/firebase';
import { ROUTINE_COLORS } from '../lib/seed';
import type { CardioRow, DailyWellbeing, LogDraft, Measure, Settings, StrengthRow } from '../types';

Chart.register(...registerables);
Chart.defaults.color = '#9CA3AF';
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
Chart.defaults.maintainAspectRatio = false;

export type RangeKey = '1M' | '3M' | '6M' | '1A' | 'Todo' | 'Custom';
export const RANGES: { key: RangeKey; label: string; days?: number }[] = [
  { key: '1M', label: '1M', days: 30 },
  { key: '3M', label: '3M', days: 90 },
  { key: '6M', label: '6M', days: 180 },
  { key: '1A', label: '1A', days: 365 },
  { key: 'Todo', label: 'Todo' },
  { key: 'Custom', label: 'Fechas' },
];

export function rangeCutoff(r: RangeKey): string | null {
  const days = RANGES.find((x) => x.key === r)?.days;
  return days ? new Date(Date.now() - days * 864e5).toISOString().slice(0, 10) : null;
}

export function rangePicker(scope: string, active: RangeKey, custom?: { from?: string; to?: string }): string {
  const sEsc = esc(scope);
  return `<div class="flex flex-wrap items-center justify-start sm:justify-end gap-2">
    <div role="group" aria-label="Filtro temporal" class="inline-flex flex-wrap rounded-xl border border-white/10 bg-gray-900/70 p-1 gap-0.5">
      ${RANGES.map((r) => `<button type="button" data-act="setRange" data-arg="${sEsc}|${r.key}" aria-pressed="${active === r.key}" class="rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${active === r.key ? 'bg-electricBlue text-white' : 'text-gray-400 hover:text-white'}">${r.label}</button>`).join('')}
    </div>
    ${active === 'Custom' ? `
      <div class="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-gray-900/70 px-2.5 py-1.5 text-xs">
        <label class="inline-flex items-center gap-1.5 text-gray-400">
          <span>Desde</span>
          <input type="date" class="inp !w-auto !py-1 !px-2 text-base sm:!text-sm tabular-nums" value="${esc(custom?.from ?? '')}" data-change="rangeFrom" data-arg="${sEsc}" aria-label="Fecha de inicio">
        </label>
        <label class="inline-flex items-center gap-1.5 text-gray-400">
          <span>Hasta</span>
          <input type="date" class="inp !w-auto !py-1 !px-2 text-base sm:!text-sm tabular-nums" value="${esc(custom?.to ?? '')}" data-change="rangeTo" data-arg="${sEsc}" aria-label="Fecha de fin">
        </label>
      </div>` : ''}
  </div>`;
}

/** Estado global de la aplicación en memoria. */
export interface State {
  tab: string;
  strength: StrengthRow[];
  cardio: CardioRow[];
  measures: Measure[];
  wellbeing: DailyWellbeing[];
  settings: Settings;
  analysis: Analysis;
  sel: Record<string, string>;
  perimeter: string;
  muscleSel: string;
  logDraft?: LogDraft;
  logFilter?: string;
  planTab?: 'routines' | 'exercises';
  aiTab?: number;
  dayExtra?: Record<string, boolean>;
  ranges?: Record<string, RangeKey>;
  customRanges?: Record<string, { from?: string; to?: string }>;
  measureDate?: string;
  measurePerimOpen?: boolean;
  measureDraft?: Record<string, string>;
  calcDraft?: { w?: string; r?: string; rir?: string; act?: string; goal?: string };
  exModal?: { routine?: string; rowIdx?: number; fromLog?: boolean };
  routineModal?: { mode: 'create' | 'edit'; oldName?: string; name: string; sub: string; color: string };
  confirmModal?: { title: string; message: string; confirmLabel?: string; danger?: boolean };
  authReady?: boolean;
  user?: CloudUser | null;
  syncing?: boolean;
  lastSync?: number;
  busy?: string;
  toast?: string;
}

/** Escapa caracteres especiales HTML para interpolación segura en plantillas. */
export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Formatea una fecha ISO (`YYYY-MM-DD`) a `DD/MM/YYYY`. */
export const fmtDate = (d: string) => esc(`${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`);

/** Formatea una fecha ISO (`YYYY-MM-DD`) a formato corto `DD/MM`. */
export const short = (d: string) => esc(`${d.slice(8, 10)}/${d.slice(5, 7)}`);

export interface DateBounds {
  key: RangeKey;
  from: string | null;
  to: string | null;
  label: string;
  days?: number;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const cleanIso = (v?: string) => (v && ISO_DATE_RE.test(v.trim()) ? v.trim() : null);

/** Resuelve los límites de fecha activos (`from`, `to`, `label` y días) para un ámbito dado. */
export function resolveRange(S: State, scope: string): DateBounds {
  const key: RangeKey = S.ranges?.[scope] ?? '1M';
  if (key === 'Custom') {
    const raw = S.customRanges?.[scope] ?? {};
    let from = cleanIso(raw.from);
    let to = cleanIso(raw.to);
    if (from && to && from > to) [from, to] = [to, from];
    const days = from && to
      ? Math.max(1, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5) + 1)
      : undefined;
    const label = from && to
      ? `${short(from)}–${short(to)}`
      : from
        ? `desde ${short(from)}`
        : to
          ? `hasta ${short(to)}`
          : 'personalizado';
    return { key, from, to, label, days };
  }
  const from = rangeCutoff(key);
  const days = RANGES.find((x) => x.key === key)?.days;
  return { key, from, to: null, label: key, days };
}

/** Comprueba si una fecha ISO (`YYYY-MM-DD`) cae dentro del rango especificado. */
export function inRange(date: string, b: DateBounds): boolean {
  if (b.from && date < b.from) return false;
  if (b.to && date > b.to) return false;
  return true;
}

/** Indica si el informe IA guardado sigue vigente respecto a la última sesión de un ejercicio. */
export function isAiFreshForEx(S: State, e?: ExStats): boolean {
  const aiDate = S.settings.ai?.date;
  if (!aiDate) return false;
  const lastDate = e?.last?.date;
  return !lastDate || aiDate >= lastDate;
}

/** Redondea a 1 decimal usando coma decimal española. */
export const r1 = (n: number) => (Math.round(n * 10) / 10).toString().replace('.', ',');

export const DAY_COLOR: Record<string, string> = { Push: '#F43F5E', Pull: '#3B82F6', Leg: '#10B981' };

/** Devuelve la lista ordenada de rutinas definidas en los ajustes (o PPL por defecto). */
export function routineNames(s: Settings): string[] {
  const keys = Object.keys(s.routines ?? {});
  return keys.length ? keys : ['Push', 'Pull', 'Leg'];
}

/** Devuelve el color hex asignado a una rutina, con fallback por defecto o por índice. */
export function routineColor(name: string, s?: Settings, idx = 0): string {
  return s?.routineMeta?.[name]?.color ?? DAY_COLOR[name] ?? ROUTINE_COLORS[idx % ROUTINE_COLORS.length];
}

/** Devuelve una abreviatura de 2 caracteres para badges compactos de calendario/adherencia. */
export function routineShort(name: string): string {
  if (name === 'Push') return 'Pu';
  if (name === 'Pull') return 'Pl';
  if (name === 'Leg') return 'Lg';
  const clean = name.replace(/[^a-zA-Z0-9ÁÉÍÓÚÜÑáéíóúüñ]/g, '').trim();
  return (clean.slice(0, 2) || name.slice(0, 2) || '·').replace(/^./, (c) => c.toUpperCase());
}

const charts = new Map<string, Chart>();
type ChartJob = () => void;
let jobs: ChartJob[] = [];

/** Ejecuta los trabajos de inicialización de gráficas pendientes tras el render. */
export const runChartJobs = () => {
  const pending = jobs;
  jobs = [];
  pending.forEach((fn) => fn());
};

/** Destruye todas las instancias activas de Chart.js y limpia la cola. */
export function resetCharts() {
  charts.forEach((c) => c.destroy());
  charts.clear();
  jobs = [];
}

/** Añade offset, ticks legibles en móvil, leyenda compacta y puntos adaptativos sin pisar opciones explícitas. */
export function normalizeChartConfig(cfg: ChartConfiguration): ChartConfiguration {
  const opts = { ...(cfg.options ?? {}) } as Record<string, unknown>;
  const rawScales = (opts.scales as Record<string, Record<string, unknown>> | undefined) ?? {};
  const scales: Record<string, Record<string, unknown>> = { ...rawScales };
  const rawPlugins = (opts.plugins as Record<string, Record<string, unknown>> | undefined) ?? {};
  const rawLegend = rawPlugins.legend ?? {};
  const datasets = (cfg.data?.datasets ?? []) as unknown as Record<string, unknown>[];
  const pointCount = cfg.data?.labels?.length ?? 0;

  if (cfg.type === 'line') {
    const xScale = scales.x ?? {};
    const xTicks = (xScale.ticks as Record<string, unknown> | undefined) ?? {};
    scales.x = {
      offset: true,
      ...xScale,
      ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6, font: { size: 10 }, ...xTicks },
    };
    const yKeys = Object.keys(scales).filter((k) => k.startsWith('y'));
    if (!yKeys.length) yKeys.push('y');
    for (const k of yKeys) {
      const yScale = scales[k] ?? {};
      const yTicks = (yScale.ticks as Record<string, unknown> | undefined) ?? {};
      scales[k] = { offset: true, ...yScale, ticks: { maxTicksLimit: 6, font: { size: 11 }, ...yTicks } };
    }
  } else if (cfg.type === 'bar') {
    const xScale = scales.x ?? {};
    const xTicks = (xScale.ticks as Record<string, unknown> | undefined) ?? {};
    scales.x = { ...xScale, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6, font: { size: 10 }, ...xTicks } };
    scales.y = { beginAtZero: true, grace: '8%', ...scales.y };
  }

  const nextDatasets = cfg.type === 'line'
    ? datasets.map((ds) => ({
        borderWidth: 2,
        pointRadius: pointCount > 24 ? 0 : 2.5,
        pointHoverRadius: 5,
        pointHitRadius: 18,
        ...ds,
      }))
    : datasets;

  const legend = {
    display: datasets.length > 1,
    ...rawLegend,
    labels: {
      usePointStyle: true,
      boxWidth: 8,
      boxHeight: 8,
      padding: 12,
      font: { size: 11 },
      ...((rawLegend.labels as Record<string, unknown> | undefined) ?? {}),
    },
  };

  return {
    ...cfg,
    data: { ...cfg.data, datasets: nextDatasets },
    options: {
      interaction: { mode: 'index', intersect: false },
      ...opts,
      plugins: { ...rawPlugins, legend },
      scales,
    },
  } as ChartConfiguration;
}

/** Programa la creación de una gráfica Chart.js tras montar el `<canvas>` en el DOM. */
export function chart(id: string, cfg: ChartConfiguration) {
  const normalized = normalizeChartConfig(cfg);
  jobs.push(() => {
    const el = document.getElementById(id) as HTMLCanvasElement | null;
    if (!el || el.getBoundingClientRect().width === 0) return;
    charts.set(id, new Chart(el, normalized) as unknown as Chart);
  });
}

export const badge = (text: string, color: string) =>
  `<span class="inline-block rounded-full border border-${color}/40 bg-${color}/15 px-2 py-0.5 text-[11px] font-bold text-${color}">${esc(text)}</span>`;

export const statusBadge = (e: ExStats) => badge(e.status, e.statusColor === 'gray' ? 'gray-400' : e.statusColor);

/** Renderiza una tarjeta KPI con alineación numérica tabular. */
export function kpi(label: string, value: string, sub = '', color = 'text-white') {
  return `<div class="card !p-3"><span class="block text-[11px] text-gray-400">${label}</span><span class="tabular-nums text-xl font-extrabold ${color}">${value}</span><span class="block text-[11px] text-gray-500">${sub}</span></div>`;
}

export function empty(msg: string) {
  return `<div class="card text-center text-sm text-gray-400">${msg}</div>`;
}

export const noData = (S: State) =>
  S.strength.length
    ? ''
    : `<div class="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-gray-300">
        <p>Aún no hay entrenamientos guardados. Registra tu primera sesión o importa tus datos previos.</p>
        <div class="flex shrink-0 flex-wrap gap-2">
          <button class="btn-primary !py-1.5 !text-xs" data-act="goLog">+ Registrar entreno</button>
          <button class="btn !py-1.5 !text-xs" data-act="tab" data-arg="data">Importar datos</button>
        </div>
      </div>`;
