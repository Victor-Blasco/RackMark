import type { ChartConfiguration } from 'chart.js';
import { MEASURE_FIELDS, type Measure } from '../types';
import { inRange, movingAverage7dFor, resolveRange, short, type State } from '../ui/shared';

export const PERIM: Record<string, { label: string; keys: (keyof Measure)[] }> = {
  arms: { label: 'Brazos', keys: ['armL', 'armR'] },
  thighs: { label: 'Muslos', keys: ['thighL', 'thighR'] },
  trunk: { label: 'Torso / Cintura / Hombros / Glúteo', keys: ['torso', 'waist', 'shoulders', 'glute'] },
  calves: { label: 'Gemelos y rodillas', keys: ['calfL', 'calfR', 'kneeL', 'kneeR'] },
};

export const PERIM_GROUPS: { title: string; keys: (keyof Measure)[] }[] = [
  { title: 'Torso y cadera', keys: ['torso', 'shoulders', 'glute'] },
  { title: 'Brazos', keys: ['armL', 'armR'] },
  { title: 'Piernas', keys: ['thighL', 'thighR', 'kneeL', 'kneeR', 'calfL', 'calfR'] },
];

export const PERIM_ALL_KEYS: (keyof Measure)[] = PERIM_GROUPS.flatMap((g) => g.keys);
const PAL = ['#3B82F6', '#10B981', '#F59E0B', '#A78BFA', '#22D3EE', '#6366F1'];

/** Construye la configuración de Composición Corporal separando Peso y Masa muscular. */
export function buildCompChartConfig(
  msInRange: Measure[],
  mode: 'weight' | 'muscle' = 'weight',
  allMeasures?: Measure[],
): ChartConfiguration<'line'> | null {
  const comp = msInRange.filter((m) => m.weight != null || m.bf != null || m.muscle != null);
  if (!comp.length) return null;
  const hasWeight = comp.some((m) => m.weight != null);
  const hasMuscle = comp.some((m) => m.muscle != null);
  const hasBf = comp.some((m) => m.bf != null);
  const showMuscle = (mode === 'muscle' && hasMuscle) || (!hasWeight && hasMuscle);
  const datasets: ChartConfiguration<'line'>['data']['datasets'] = [];

  if (showMuscle) {
    datasets.push({
      label: 'Masa muscular (kg)',
      data: comp.map((m) => m.muscle ?? null),
      borderColor: '#10B981',
      backgroundColor: '#10B981',
      yAxisID: 'y',
      tension: 0.25,
      spanGaps: true,
    });
  } else if (hasWeight) {
    datasets.push(
      {
        label: 'Tendencia 7d (kg)',
        data: movingAverage7dFor(comp, allMeasures),
        borderColor: '#3B82F6',
        backgroundColor: '#3B82F6',
        borderWidth: 2.5,
        pointRadius: 0,
        yAxisID: 'y',
        tension: 0.3,
        spanGaps: true,
      },
      {
        label: 'Peso diario (kg)',
        data: comp.map((m) => m.weight ?? null),
        borderColor: 'rgba(59,130,246,0.38)',
        backgroundColor: 'rgba(59,130,246,0.5)',
        borderDash: [3, 3],
        borderWidth: 1.5,
        pointRadius: 2,
        yAxisID: 'y',
        tension: 0.2,
        spanGaps: true,
      },
    );
  }

  if (hasBf) {
    datasets.push({
      label: '% Grasa',
      data: comp.map((m) => m.bf ?? null),
      borderColor: '#F59E0B',
      backgroundColor: '#F59E0B',
      yAxisID: hasWeight || hasMuscle ? 'y1' : 'y',
      tension: 0.25,
      spanGaps: true,
    });
  }

  const hasDualY = (hasWeight || hasMuscle) && hasBf;
  return {
    type: 'line',
    data: { labels: comp.map((m) => short(m.date)), datasets },
    options: hasDualY
      ? {
          animation: { duration: 320, easing: 'easeOutCubic' },
          scales: { y: { position: 'left' }, y1: { position: 'right', grid: { drawOnChartArea: false } } },
        }
      : { animation: { duration: 320, easing: 'easeOutCubic' } },
  };
}

/** Construye la configuración del gráfico de perímetros según el grupo activo en `state.perimeter`. */
export function buildPerimChartConfig(state: State, msInRange?: Measure[]): ChartConfiguration<'line'> | null {
  const list = msInRange ?? (() => {
    const bounds = resolveRange(state, 'body', 'Todo');
    const hasFilter = Boolean(bounds.from || bounds.to);
    return hasFilter ? state.measures.filter((m) => inRange(m.date, bounds)) : state.measures;
  })();
  const pk = PERIM[state.perimeter] ?? PERIM.arms;
  const perimRows = list.filter((m) => pk.keys.some((k) => m[k] != null));
  if (!perimRows.length) return null;
  return {
    type: 'line',
    data: {
      labels: perimRows.map((m) => short(m.date)),
      datasets: pk.keys.map((k, i) => ({
        label: MEASURE_FIELDS.find((f) => f.key === k)!.label,
        data: perimRows.map((m) => (m[k] as number | undefined) ?? null),
        borderColor: PAL[i],
        tension: 0.25,
        spanGaps: true,
      })),
    },
  };
}
