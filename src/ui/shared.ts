import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartConfiguration,
} from 'chart.js';
import type { Analysis, ExStats } from '../lib/analysis';
import type { CloudUser } from '../lib/firebase';
import { ROUTINE_COLORS, todayIso } from '../lib/seed';
import type { AiJob, AiSection, CardioRow, DailyWellbeing, DayName, LiveWorkout, LogDraft, Measure, Settings, StrengthRow, SyncJob } from '../types';
import type { WizardDraft } from './wizardView';

export { todayIso };

Chart.register(
  LineController,
  LineElement,
  PointElement,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
);
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
  return days ? todayIso(new Date(Date.now() - days * 864e5)) : null;
}

export function rangePicker(scope: string, active: RangeKey, custom?: { from?: string; to?: string }): string {
  const sEsc = esc(scope);
  return `<div class="flex flex-wrap items-center justify-start sm:justify-end gap-2">
    <div role="group" aria-label="Filtro temporal" class="inline-flex flex-wrap rounded-xl border border-white/10 bg-gray-900/70 p-1 gap-0.5">
      ${RANGES.map((r) => `<button type="button" data-act="setRange" data-arg="${sEsc}|${r.key}" aria-pressed="${active === r.key}" class="inline-flex min-h-[40px] sm:min-h-[30px] items-center rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${active === r.key ? 'bg-electricBlue text-white' : 'text-gray-400 hover:text-white'}">${r.label}</button>`).join('')}
    </div>
    ${active === 'Custom' ? `
      <div class="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-gray-900/70 px-2.5 py-1.5 text-xs">
        <label class="inline-flex items-center gap-1.5 text-gray-400">
          <span>Desde</span>
          <input type="date" class="inp w-auto py-1 px-2 tabular-nums" value="${esc(custom?.from ?? '')}" data-change="rangeFrom" data-arg="${sEsc}" aria-label="Fecha de inicio">
        </label>
        <label class="inline-flex items-center gap-1.5 text-gray-400">
          <span>Hasta</span>
          <input type="date" class="inp w-auto py-1 px-2 tabular-nums" value="${esc(custom?.to ?? '')}" data-change="rangeTo" data-arg="${sEsc}" aria-label="Fecha de fin">
        </label>
      </div>` : ''}
  </div>`;
}

export interface WorkoutSummary {
  day: DayName | 'Libre';
  durationMin: number;
  exercises: number;
  sets: number;
  tonnageKg: number;
  prNames: string[];
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
  homeExQuery?: string;
  logAddQuery?: string;
  perimeter: string;
  muscleSel: string;
  logDraft?: LogDraft;
  liveWorkout?: LiveWorkout;
  workoutSummary?: WorkoutSummary;
  logFilter?: string;
  planTab?: 'routines' | 'exercises';
  aiTab?: number;
  exMetric?: 'top' | 'e1rm' | 'volume';
  dayExtra?: Record<string, boolean>;
  ranges?: Record<string, RangeKey>;
  customRanges?: Record<string, { from?: string; to?: string }>;
  measureDate?: string;
  measurePerimOpen?: boolean;
  measureDraft?: Record<string, string>;
  bodyMetric?: 'weight' | 'muscle';
  calcDraft?: { w?: string; r?: string; rir?: string; act?: string; goal?: string };
  exModal?: { routine?: string; rowIdx?: number; fromLog?: boolean };
  routineModal?: { mode: 'create' | 'edit'; oldName?: string; name: string; sub: string; color: string };
  confirmModal?: { title: string; message: string; confirmLabel?: string; danger?: boolean };
  noteModal?: { exName: string; value: string };
  wizard?: WizardDraft;
  planSearch?: string;
  exerciseMapSearch?: string;
  showAllExerciseMap?: boolean;
  planTargetRoutine?: string;
  authReady?: boolean;
  user?: CloudUser | null;
  syncing?: boolean;
  syncJob?: SyncJob;
  lastSync?: number;
  busy?: string;
  aiJob?: AiJob;
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
export function resolveRange(S: State, scope: string, fallback: RangeKey = '1M'): DateBounds {
  const key: RangeKey = S.ranges?.[scope] ?? fallback;
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

/** Calcula la media móvil de 7 días naturales para una serie ordenada de mediciones con peso. */
export function movingAverage7d(items: { date: string; weight?: number }[]): (number | null)[] {
  return items.map((cur, idx) => {
    const curMs = Date.parse(`${cur.date}T00:00:00Z`);
    if (!Number.isFinite(curMs)) return cur.weight ?? null;
    let sum = 0;
    let count = 0;
    for (let j = idx; j >= 0; j--) {
      const prev = items[j];
      const prevMs = Date.parse(`${prev.date}T00:00:00Z`);
      if (!Number.isFinite(prevMs)) continue;
      const diffDays = (curMs - prevMs) / 864e5;
      if (diffDays > 6) break;
      if (diffDays >= 0 && typeof prev.weight === 'number' && Number.isFinite(prev.weight)) {
        sum += prev.weight;
        count++;
      }
    }
    return count > 0 ? Math.round((sum / count) * 10) / 10 : null;
  });
}

/** Determina el color semántico de una variación de peso según la fase nutricional activa. */
export function weightDeltaColor(diff: number, phaseName?: string): string {
  const p = (phaseName ?? '').toLowerCase();
  if (/definici|cut|pérdida|perdida|déficit|deficit/.test(p)) {
    return diff <= 0.1 ? 'text-emerald-400' : 'text-amberGold';
  }
  if (/volumen|bulk|superávit|superavit|ganancia/.test(p)) {
    return diff >= -0.1 && diff <= 1.5 ? 'text-emerald-400' : 'text-amberGold';
  }
  return Math.abs(diff) <= 0.6 ? 'text-emerald-400' : 'text-blue-300';
}

/** Busca una sección del informe IA por expresión regular sobre su título. */
export function findAiSection(S: State, pattern: RegExp): AiSection | undefined {
  return S.settings.ai?.overview?.sections?.find((s) => pattern.test(s.title));
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

/** Devuelve una abreviatura corta y distintiva para badges compactos de calendario y adherencia. */
export function routineShort(name: string): string {
  const trimmed = name.trim();
  if (trimmed === 'Push') return 'Pu';
  if (trimmed === 'Pull') return 'Pl';
  if (trimmed === 'Leg') return 'Lg';
  const words = trimmed.split(/[^a-zA-Z0-9ÁÉÍÓÚÜÑáéíóúüñ]+/).filter(Boolean);
  if (!words.length) return '·';
  if (words.length === 1) return words[0].slice(0, 2).replace(/^./, (c) => c.toUpperCase());
  const skip = new Set(['y', 'e', 'de', 'del', 'la', 'el', 'con', 'and', 'or']);
  const sig = words.filter((w) => !skip.has(w.toLowerCase()));
  const pool = sig.length >= 2 ? sig : words;
  return pool.slice(0, 3).map((w) => (/^\d+$/.test(w) ? w[0] : w[0].toUpperCase())).join('');
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
  const reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
      animation: reducedMotion ? false : opts.animation ?? false,
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
    charts.get(id)?.destroy();
    charts.set(id, new Chart(el, normalized) as unknown as Chart);
  });
}

/** Actualiza una gráfica existente en el DOM sin destruir el `<canvas>`, o devuelve `false` si no está montada. */
export function updateChart(id: string, cfg: ChartConfiguration): boolean {
  const el = document.getElementById(id) as HTMLCanvasElement | null;
  if (!el || el.getBoundingClientRect().width === 0) return false;
  const normalized = normalizeChartConfig(cfg);
  const existing = charts.get(id) as (Chart & { canvas?: HTMLCanvasElement; config?: ChartConfiguration }) | undefined;
  if (existing && existing.canvas === el && existing.config?.type === normalized.type) {
    existing.data = normalized.data;
    if (normalized.options) existing.options = normalized.options as never;
    existing.update('none');
    return true;
  }
  existing?.destroy();
  charts.set(id, new Chart(el, normalized) as unknown as Chart);
  return true;
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
          <button class="btn-primary-sm" data-act="goLog">+ Registrar entreno</button>
          <button class="btn-sm" data-act="tab" data-arg="data">Importar datos</button>
        </div>
      </div>`;
