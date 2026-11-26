import type { Settings, StrengthRow } from '../types';
import { resolveName } from './analysis';
import { norm } from './seed';

/** Resultado de fusionar una exportación de Samsung Health con sesiones manuales existentes. */
export interface SamsungStrengthMergeResult {
  toUpsert: StrengthRow[];
  mergedDays: number;
  enrichedRows: number;
  skippedExtraRows: number;
}

interface AggregatedPhysiology {
  durMin?: number;
  avgHr?: number;
  maxHr?: number;
  minHr?: number;
  kcal?: number;
}

const isPositiveFinite = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0;

/** Indica si una fila de fuerza fue registrada manualmente en RackMark. */
export function isManualStrengthRow(row: StrengthRow): boolean {
  return row.ref.startsWith('name:') || row.sessionId.startsWith('manual-') || row.id.startsWith('manual-');
}

function aggregatePhysiology(rows: StrengthRow[]): AggregatedPhysiology {
  let durSum = 0;
  let hasDur = false;
  let kcalSum = 0;
  let hasKcal = false;
  let maxHr: number | undefined;
  let minHr: number | undefined;
  let weightedHrSum = 0;
  let weightTotal = 0;
  let simpleHrSum = 0;
  let simpleHrCount = 0;

  for (const r of rows) {
    if (isPositiveFinite(r.durMin)) {
      durSum += r.durMin;
      hasDur = true;
    }
    if (isPositiveFinite(r.kcal)) {
      kcalSum += r.kcal;
      hasKcal = true;
    }
    if (isPositiveFinite(r.maxHr)) {
      maxHr = maxHr == null ? r.maxHr : Math.max(maxHr, r.maxHr);
    }
    if (isPositiveFinite(r.minHr)) {
      minHr = minHr == null ? r.minHr : Math.min(minHr, r.minHr);
    }
    if (isPositiveFinite(r.avgHr)) {
      simpleHrSum += r.avgHr;
      simpleHrCount++;
      if (isPositiveFinite(r.durMin)) {
        weightedHrSum += r.avgHr * r.durMin;
        weightTotal += r.durMin;
      }
    }
  }

  return {
    ...(hasDur ? { durMin: Math.round(durSum * 10) / 10 } : {}),
    ...(simpleHrCount > 0
      ? { avgHr: Math.round(weightTotal > 0 ? weightedHrSum / weightTotal : simpleHrSum / simpleHrCount) }
      : {}),
    ...(maxHr != null ? { maxHr } : {}),
    ...(minHr != null ? { minHr } : {}),
    ...(hasKcal ? { kcal: Math.round(kcalSum) } : {}),
  };
}

/**
 * Fusiona filas de fuerza importadas de Samsung Health con entrenamientos manuales existentes.
 *
 * En días sin entrenamiento manual, las filas de Samsung pasan sin cambios.
 * En días con entrenamiento manual, nunca modifica series/pesos/reps/RIR ni añade ejercicios
 * extra de Samsung; solo enriquece los ejercicios manuales coincidentes con la fisiología
 * agregada (agrupando bloques duplicados de Samsung del mismo ejercicio).
 *
 * @param existingStrength - Filas de fuerza ya almacenadas localmente.
 * @param importedStrength - Filas de fuerza recién leídas de Samsung Health.
 * @param settings - Ajustes con `customNames`, `refNames` y `aliases` ya actualizados.
 * @returns Filas listas para persistir y contadores de resumen.
 */
export function mergeSamsungStrengthWithManual(
  existingStrength: StrengthRow[],
  importedStrength: StrengthRow[],
  settings: Settings,
): SamsungStrengthMergeResult {
  const manualByDate = new Map<string, StrengthRow[]>();
  for (const row of existingStrength) {
    if (!isManualStrengthRow(row)) continue;
    const list = manualByDate.get(row.date);
    if (list) list.push(row);
    else manualByDate.set(row.date, [row]);
  }

  const importedByDate = new Map<string, StrengthRow[]>();
  for (const row of importedStrength) {
    const list = importedByDate.get(row.date);
    if (list) list.push(row);
    else importedByDate.set(row.date, [row]);
  }

  const toUpsert: StrengthRow[] = [];
  let mergedDays = 0;
  let enrichedRows = 0;
  let skippedExtraRows = 0;

  for (const [date, samsungRows] of importedByDate) {
    const manualRows = manualByDate.get(date);
    if (!manualRows?.length) {
      toUpsert.push(...samsungRows);
      continue;
    }

    const samsungByEx = new Map<string, StrengthRow[]>();
    for (const row of samsungRows) {
      const key = norm(resolveName(row.ref, settings));
      const list = samsungByEx.get(key);
      if (list) list.push(row);
      else samsungByEx.set(key, [row]);
    }

    const aggByEx = new Map<string, AggregatedPhysiology>();
    for (const [key, rows] of samsungByEx) {
      aggByEx.set(key, aggregatePhysiology(rows));
    }

    const matchedKeys = new Set<string>();
    let dayMerged = false;

    for (const m of manualRows) {
      const mKey = norm(resolveName(m.ref, settings));
      const agg = aggByEx.get(mKey);
      if (!agg) continue;
      matchedKeys.add(mKey);
      const enriched: StrengthRow = {
        ...m,
        ...(agg.durMin != null ? { durMin: agg.durMin } : {}),
        ...(agg.avgHr != null ? { avgHr: agg.avgHr } : {}),
        ...(agg.maxHr != null ? { maxHr: agg.maxHr } : {}),
        ...(agg.minHr != null ? { minHr: agg.minHr } : {}),
        ...(agg.kcal != null ? { kcal: agg.kcal } : {}),
      };
      toUpsert.push(enriched);
      enrichedRows++;
      dayMerged = true;
    }

    for (const row of samsungRows) {
      const key = norm(resolveName(row.ref, settings));
      if (!matchedKeys.has(key)) skippedExtraRows++;
    }

    if (dayMerged) mergedDays++;
  }

  return { toUpsert, mergedDays, enrichedRows, skippedExtraRows };
}
