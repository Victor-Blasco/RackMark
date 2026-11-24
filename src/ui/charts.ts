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
Chart.defaults.color = '#94A3A8';
Chart.defaults.borderColor = 'rgba(238,243,245,0.07)';
Chart.defaults.maintainAspectRatio = false;

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
      interaction: { mode: 'index', intersect: false },
      ...opts,
      animation: reducedMotion ? false : (opts.animation ?? false),
      plugins: { ...rawPlugins, legend },
      scales,
    },
  } as ChartConfiguration;
}
