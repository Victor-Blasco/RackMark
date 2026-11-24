import { isValidIsoDate } from '../lib/seed';
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
  const hasAnyPerim = ms.some((m) => PERIM_ALL_KEYS.some((k) => m[k] != null));
  const hasPerimsInCurrent = Boolean(currentEntry && PERIM_ALL_KEYS.some((k) => currentEntry[k] != null));
  const perimOpen = state.measurePerimOpen ?? hasPerimsInCurrent;
  const perimGroups = PERIM_GROUPS.map((g) => ({
    title: g.title,
    fields: g.keys.map((k) => MEASURE_FIELDS.find((f) => f.key === k)!),
  }));

  const visibleCols = MEASURE_FIELDS.filter((f) => msInRange.some((m) => m[f.key] != null));
  const tableCols = visibleCols.length ? visibleCols : basicFields;
  const lastKnownByKey = buildLastKnownMap(ms);

  const getFieldInputMeta = (key: keyof Measure): { value: string; placeholder: string; lastLabel?: string } => {
    const draftVal = state.measureDraft?.[key];
    const entryVal = currentEntry?.[key];
    const value = draftVal ?? (entryVal != null ? String(entryVal) : '');
    const lastKnown = lastKnownByKey[key];
    return {
      value,
      placeholder: '—',
      ...(lastKnown != null ? { lastLabel: `Últ: ${r1(lastKnown)}` } : {}),
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
    hasAnyPerim,
    pk,
    basicFields,
    perimOpen,
    perimGroups,
    tableCols,
    noteValue: state.measureDraft?.note ?? currentEntry?.note ?? '',
    getFieldInputMeta,
  };
}

const parseMeasureDecimal = (v: string): number | undefined => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Extrae y valida un registro `Measure` a partir de un `FormData` preservando campos ocultos previos.
 *
 * @param fd - Datos enviados desde el formulario de medidas corporales.
 * @param existingByDate - Buscador del registro previo por fecha para conservar campos no editados.
 * @returns Fecha validada y objeto `Measure`, o mensaje de error en caso de validación fallida.
 */
export function parseMeasureFormData(
  fd: FormData,
  existingByDate: (date: string) => Measure | undefined,
): { date: string; measure: Measure } | { error: string } {
  const date = String(fd.get('date') ?? '').trim();
  if (!isValidIsoDate(date)) return { error: 'Introduce una fecha válida.' };
  const existing = existingByDate(date);
  const measure: Measure = { date };
  let metricCount = 0;
  for (const { key } of MEASURE_FIELDS) {
    const val = fd.has(key)
      ? parseMeasureDecimal(String(fd.get(key) ?? ''))
      : typeof existing?.[key] === 'number'
        ? existing[key]
        : undefined;
    if (val != null) {
      (measure as unknown as Record<string, number>)[key] = val;
      metricCount++;
    }
  }
  if (!metricCount) return { error: 'Introduce al menos una métrica numérica (por ejemplo, peso o % de grasa).' };
  const note = fd.has('note') ? String(fd.get('note') ?? '').trim() : (existing?.note ?? '');
  if (note) measure.note = note;
  return { date, measure };
}
