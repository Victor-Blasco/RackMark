import { BASIC_MEASURE_KEYS, MEASURE_FIELDS, type Measure } from '../types';
import { inRange, r1, resolveRange, todayIso, type State } from '../ui/shared';
import {
  PERIM,
  PERIM_ALL_KEYS,
  PERIM_GROUPS,
  buildCompChartConfig,
  buildPerimChartConfig,
} from './bodyChartConfigs';

export { PERIM, PERIM_ALL_KEYS, PERIM_GROUPS, buildCompChartConfig, buildPerimChartConfig };

function buildLastKnownMap(measures: Measure[]): Partial<Record<keyof Measure, number>> {
  const found: Partial<Record<keyof Measure, number>> = {};
  for (let i = measures.length - 1; i >= 0; i--) {
    const m = measures[i];
    for (const { key } of MEASURE_FIELDS) {
      if (found[key] === undefined && typeof m[key] === 'number') {
        found[key] = m[key] as number;
      }
    }
  }
  return found;
}

/**
 * Calcula los datos base, tabla inversa y formulario derivado para `<BodyView />`.
 *
 * @param state - Estado global de la aplicación.
 * @returns Modelo de vista para composición corporal, perímetros, formulario e historial.
 */
export function buildBodyViewModel(state: State) {
  const ms = state.measures;
  const bounds = resolveRange(state, 'body', 'Todo');
  const hasFilter = Boolean(bounds.from || bounds.to);
  const msInRange = hasFilter ? ms.filter((m) => inRange(m.date, bounds)) : ms;
  const measuresDesc = [...msInRange].reverse();
  const today = todayIso();
  const activeDate = state.measureDate ?? today;
  const currentEntry = ms.find((m) => m.date === activeDate);
  const comp = msInRange.filter((m) => m.weight != null || m.bf != null || m.muscle != null);
  const hasCompWeight = comp.some((m) => m.weight != null);
  const hasCompMuscle = comp.some((m) => m.muscle != null);
  const activeCompMode: 'weight' | 'muscle' = state.bodyMetric === 'muscle' && hasCompMuscle ? 'muscle' : 'weight';

  const pk = PERIM[state.perimeter] ?? PERIM.arms;
  const basicFields = MEASURE_FIELDS.filter((f) => BASIC_MEASURE_KEYS.includes(f.key));
  const hasPerimsInCurrent = Boolean(currentEntry && PERIM_ALL_KEYS.some((k) => currentEntry[k] != null));
  const perimOpen = state.measurePerimOpen ?? hasPerimsInCurrent;
  const perimGroups = PERIM_GROUPS.map((g) => ({
    title: g.title,
    fields: g.keys.map((k) => MEASURE_FIELDS.find((f) => f.key === k)!),
  }));

  const visibleCols = MEASURE_FIELDS.filter((f) => msInRange.some((m) => m[f.key] != null));
  const tableCols = visibleCols.length ? visibleCols : basicFields;
  const lastKnownByKey = buildLastKnownMap(ms);

  const getFieldInputMeta = (key: keyof Measure): { value: string; placeholder: string } => {
    const draftVal = state.measureDraft?.[key];
    const entryVal = currentEntry?.[key];
    const value = draftVal ?? (entryVal != null ? String(entryVal) : '');
    const lastKnown = lastKnownByKey[key];
    return {
      value,
      placeholder: lastKnown != null ? `Últ: ${r1(lastKnown)}` : '—',
    };
  };

  return {
    ms,
    bounds,
    hasFilter,
    msInRange,
    measuresDesc,
    today,
    activeDate,
    currentEntry,
    compCount: comp.length,
    hasCompWeight,
    hasCompMuscle,
    activeCompMode,
    pk,
    basicFields,
    perimOpen,
    perimGroups,
    tableCols,
    noteValue: state.measureDraft?.note ?? currentEntry?.note ?? '',
    getFieldInputMeta,
  };
}
