import { Chart, registerables, type ChartConfiguration } from 'chart.js';
import type { Analysis, ExStats } from '../lib/analysis';
import type { CardioRow, LogDraft, Measure, Settings, StrengthRow } from '../types';

Chart.register(...registerables);
Chart.defaults.color = '#9CA3AF';
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
Chart.defaults.maintainAspectRatio = false;

/** Estado global de la aplicación en memoria. */
export interface State {
  tab: string;
  strength: StrengthRow[];
  cardio: CardioRow[];
  measures: Measure[];
  settings: Settings;
  analysis: Analysis;
  sel: Record<string, string>;
  perimeter: string;
  muscleSel: string;
  logDraft?: LogDraft;
  logFilter?: string;
  busy?: string;
  toast?: string;
}

/** Escapa caracteres especiales HTML para interpolación segura en plantillas. */
export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Formatea una fecha ISO (`YYYY-MM-DD`) a `DD/MM/YYYY`. */
export const fmtDate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/** Formatea una fecha ISO (`YYYY-MM-DD`) a formato corto `DD/MM`. */
export const short = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Redondea a 1 decimal usando coma decimal española. */
export const r1 = (n: number) => (Math.round(n * 10) / 10).toString().replace('.', ',');

export const DAY_COLOR: Record<string, string> = { Push: '#F43F5E', Pull: '#3B82F6', Leg: '#10B981' };

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

/** Programa la creación de una gráfica Chart.js tras montar el `<canvas>` en el DOM. */
export function chart(id: string, cfg: ChartConfiguration) {
  jobs.push(() => {
    const el = document.getElementById(id) as HTMLCanvasElement | null;
    if (!el) return;
    charts.set(id, new Chart(el, cfg) as unknown as Chart);
  });
}

export const badge = (text: string, color: string) =>
  `<span class="inline-block rounded-full border border-${color}/40 bg-${color}/15 px-2 py-0.5 text-[11px] font-bold text-${color}">${esc(text)}</span>`;

export const statusBadge = (e: ExStats) => badge(e.status, e.statusColor === 'gray' ? 'gray-400' : e.statusColor);

/** Renderiza una tarjeta KPI con alineación numérica tabular. */
export function kpi(label: string, value: string, sub = '', color = 'text-white') {
  return `<div class="card !p-3"><span class="block text-[11px] text-gray-400">${label}</span><span class="font-mono tabular-nums text-xl font-extrabold ${color}">${value}</span><span class="block text-[11px] text-gray-500">${sub}</span></div>`;
}

export function empty(msg: string) {
  return `<div class="card text-center text-sm text-gray-400">${msg}</div>`;
}

export const noData = (S: State) =>
  S.strength.length
    ? ''
    : empty('Aún no hay datos. Registra un entrenamiento en <b>+ Entrenar</b> o ve a <b>Ajustes</b> para importar tu exportación de Samsung Health (ZIP o CSV) y tus medidas (CSV).');
