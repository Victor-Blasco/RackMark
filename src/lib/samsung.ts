import Papa from 'papaparse';
import { unzipSync, strFromU8 } from 'fflate';
import type { CardioRow, DailyWellbeing, SetRec, StrengthRow } from '../types';

export interface SamsungImport {
  strength: StrengthRow[];
  cardio: CardioRow[];
  customNames: Record<string, string>;
  wellbeing: DailyWellbeing[];
}

const pos = (v: unknown, dec = 0): number | undefined => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const k = 10 ** dec;
  return Math.round(n * k) / k;
};

/** Los CSV de Samsung llevan una primera línea de metadatos antes de la cabecera. */
export function parseSamsungCsv(text: string): Record<string, string>[] {
  const t = text.replace(/^\uFEFF/, '');
  const nl = t.indexOf('\n');
  const body = nl >= 0 ? t.slice(nl + 1) : '';
  return Papa.parse<Record<string, string>>(body, { header: true, skipEmptyLines: true }).data;
}

function offsetMin(off: string | undefined): number {
  const m = /UTC([+-])(\d{2})(\d{2})/.exec(off ?? '');
  if (!m) return 0;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

function localDate(ts: number, offMin: number): string {
  return new Date(ts + offMin * 60000).toISOString().slice(0, 10);
}

export function parseExerciseCsv(text: string): { strength: StrengthRow[]; cardio: CardioRow[] } {
  const strength: StrengthRow[] = [];
  const cardio: CardioRow[] = [];
  for (const r of parseSamsungCsv(text)) {
    const id = r['com.samsung.health.exercise.datauuid'];
    const st = r['com.samsung.health.exercise.start_time'];
    if (!id || !st) continue;
    const ts = Date.parse(st.replace(' ', 'T') + 'Z');
    if (Number.isNaN(ts)) continue;
    const date = localDate(ts, offsetMin(r['com.samsung.health.exercise.time_offset']));
    const type = Number(r['com.samsung.health.exercise.exercise_type'] || 0);

    if (r.subset_data) {
      let raw: { reps?: number; weight?: number }[] = [];
      try { raw = JSON.parse(r.subset_data); } catch { continue; }
      const sets: SetRec[] = raw
        .map((s) => ({ w: Number(s.weight) || 0, r: Number(s.reps) || 0 }))
        .filter((s) => s.r > 0);
      if (!sets.length) continue;
      const ref = r.custom_id ? r.custom_id : `type:${type}`;
      const durMin = pos(Number(r['com.samsung.health.exercise.duration']) / 60000, 1);
      const avgHr = pos(r['com.samsung.health.exercise.mean_heart_rate']);
      const maxHr = pos(r['com.samsung.health.exercise.max_heart_rate']);
      const minHr = pos(r['com.samsung.health.exercise.min_heart_rate']);
      const kcal = pos(r['com.samsung.health.exercise.calorie']);
      strength.push({
        id, sessionId: r.routine_datauuid || date, ts, date, ref, sets,
        ...(durMin != null ? { durMin } : {}),
        ...(avgHr != null ? { avgHr } : {}),
        ...(maxHr != null ? { maxHr } : {}),
        ...(minHr != null ? { minHr } : {}),
        ...(kcal != null ? { kcal } : {}),
      });
    } else if (type !== 0) {
      const dur = Number(r['com.samsung.health.exercise.duration'] || 0) / 60000;
      cardio.push({
        id, ts, date, type, durMin: Math.round(dur * 10) / 10,
        distKm: Math.round(Number(r['com.samsung.health.exercise.distance'] || 0)) / 1000,
        avgHr: Number(r['com.samsung.health.exercise.mean_heart_rate'] || 0),
        kcal: Math.round(Number(r['com.samsung.health.exercise.calorie'] || 0)),
        vo2: r['com.samsung.health.exercise.vo2_max'] ? Number(r['com.samsung.health.exercise.vo2_max']) : undefined,
      });
    }
  }
  return { strength, cardio };
}

export function parseCustomExerciseCsv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of parseSamsungCsv(text)) {
    if (r.custom_type === '0' && r.custom_id && r.custom_name) out[r.custom_id] = r.custom_name.trim();
  }
  return out;
}

/** Parsea registros diarios de sueño (`com.samsung.shealth.sleep.*.csv`), conservando el sueño principal de cada día. */
export function parseSleepCsv(text: string): Map<string, DailyWellbeing> {
  const out = new Map<string, DailyWellbeing>();
  for (const r of parseSamsungCsv(text)) {
    const st = r['com.samsung.health.sleep.start_time'];
    const et = r['com.samsung.health.sleep.end_time'];
    if (!et) continue;
    const endTs = Date.parse(et.replace(' ', 'T') + 'Z');
    const startTs = st ? Date.parse(st.replace(' ', 'T') + 'Z') : NaN;
    if (Number.isNaN(endTs)) continue;
    const date = localDate(endTs, offsetMin(r['com.samsung.health.sleep.time_offset']));
    const sleepMin = pos(r.sleep_duration) ?? (!Number.isNaN(startTs) ? pos((endTs - startTs) / 60000) : undefined);
    if (!sleepMin || sleepMin > 1440) continue;
    const prev = out.get(date);
    if (prev && (prev.sleepMin ?? 0) >= sleepMin) continue;
    const sleepScore = pos(r.sleep_score);
    const sleepEff = pos(r.efficiency);
    const remMin = pos(r.total_rem_duration);
    const deepMin = pos(r.factor_01);
    const physRec = pos(r.physical_recovery);
    const mentalRec = pos(r.mental_recovery);
    out.set(date, {
      date, sleepMin,
      ...(sleepScore != null ? { sleepScore } : {}),
      ...(sleepEff != null ? { sleepEff } : {}),
      ...(remMin != null ? { remMin } : {}),
      ...(deepMin != null ? { deepMin } : {}),
      ...(physRec != null ? { physRec } : {}),
      ...(mentalRec != null ? { mentalRec } : {}),
    });
  }
  return out;
}

/** Parsea pasos diarios (`pedometer_day_summary` o `step_daily_trend`), tomando el mayor total combinado por día. */
export function parseStepsCsv(text: string): Map<string, DailyWellbeing> {
  const out = new Map<string, DailyWellbeing>();
  for (const r of parseSamsungCsv(text)) {
    const date = (r.day_time ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const steps = pos(r.step_count ?? r.count);
    if (!steps) continue;
    const prev = out.get(date);
    if (prev && (prev.steps ?? 0) >= steps) continue;
    const stepKm = pos(Number(r.distance) / 1000, 1);
    const activeMin = pos(Number(r.active_time) / 60000);
    const stepKcal = pos(r.calorie);
    out.set(date, {
      date, steps,
      ...(stepKm != null ? { stepKm } : {}),
      ...(activeMin != null ? { activeMin } : {}),
      ...(stepKcal != null ? { stepKcal } : {}),
    });
  }
  return out;
}

/** Parsea puntuación diaria de vitalidad, FC basal nocturna y HRV (`com.samsung.shealth.vitality_score.*.csv`). */
export function parseVitalityCsv(text: string): Map<string, DailyWellbeing> {
  const out = new Map<string, DailyWellbeing>();
  for (const r of parseSamsungCsv(text)) {
    const date = (r.day_time ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const energyScore = pos(r.total_score);
    const rhr = pos(r.shr_value);
    const hrv = pos(r.shrv_value);
    if (energyScore == null && rhr == null && hrv == null) continue;
    out.set(date, {
      date,
      ...(energyScore != null ? { energyScore } : {}),
      ...(rhr != null ? { rhr } : {}),
      ...(hrv != null ? { hrv } : {}),
    });
  }
  return out;
}

const base = (n: string) => n.split(/[\\/]/).pop() ?? n;
const isCustom = (n: string) => /exercise\.custom_exercise\.\d+\.csv$/i.test(n);
const isExercise = (n: string) => /shealth\.exercise\.\d+\.csv$/i.test(n);
const isSleep = (n: string) => /shealth\.sleep\.\d+\.csv$/i.test(n);
const isSteps = (n: string) => /shealth\.(?:tracker\.pedometer_day_summary|step_daily_trend)\.\d+\.csv$/i.test(n);
const isVitality = (n: string) => /shealth\.vitality_score\.\d+\.csv$/i.test(n);

const MAX_IMPORT_FILE_BYTES = 50 * 1024 * 1024;
const MAX_ZIP_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;

/** Acepta archivos CSV sueltos y/o ZIP de la exportación de Samsung Health. */
export async function importSamsungFiles(files: File[]): Promise<SamsungImport> {
  const wellMap = new Map<string, DailyWellbeing>();
  const mergeMap = (m: Map<string, DailyWellbeing>) => {
    for (const [d, v] of m) wellMap.set(d, { ...(wellMap.get(d) ?? {}), ...v });
  };
  const res: SamsungImport = { strength: [], cardio: [], customNames: {}, wellbeing: [] };
  const handle = (name: string, text: string) => {
    const b = base(name);
    if (isCustom(b)) Object.assign(res.customNames, parseCustomExerciseCsv(text));
    else if (isExercise(b)) {
      const p = parseExerciseCsv(text);
      res.strength.push(...p.strength);
      res.cardio.push(...p.cardio);
    } else if (isSleep(b)) mergeMap(parseSleepCsv(text));
    else if (isSteps(b)) mergeMap(parseStepsCsv(text));
    else if (isVitality(b)) mergeMap(parseVitalityCsv(text));
  };
  for (const f of files) {
    if (f.size > MAX_IMPORT_FILE_BYTES) {
      throw new Error(`Archivo demasiado grande (${Math.round(f.size / (1024 * 1024))} MB). Máximo permitido: 50 MB.`);
    }
    if (/\.zip$/i.test(f.name)) {
      const buf = new Uint8Array(await f.arrayBuffer());
      let totalDeclaredBytes = 0;
      const entries = unzipSync(buf, {
        filter: (e) => {
          const b = base(e.name);
          const matched = isCustom(b) || isExercise(b) || isSleep(b) || isSteps(b) || isVitality(b);
          if (!matched) return false;
          totalDeclaredBytes += e.originalSize ?? e.size ?? 0;
          if (totalDeclaredBytes > MAX_ZIP_UNCOMPRESSED_BYTES) {
            throw new Error('Archivo ZIP demasiado grande al descomprimir.');
          }
          return true;
        },
      });
      let totalUnpackedBytes = 0;
      for (const [name, data] of Object.entries(entries)) {
        totalUnpackedBytes += data.byteLength;
        if (totalUnpackedBytes > MAX_ZIP_UNCOMPRESSED_BYTES) {
          throw new Error('Archivo ZIP demasiado grande al descomprimir.');
        }
        handle(name, strFromU8(data));
      }
    } else if (/\.csv$/i.test(f.name)) {
      handle(f.name, await f.text());
    }
  }
  res.wellbeing = [...wellMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  return res;
}
