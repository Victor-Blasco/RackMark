import Papa from 'papaparse';
import { unzipSync, strFromU8 } from 'fflate';
import type { CardioRow, SetRec, StrengthRow } from '../types';

export interface SamsungImport {
  strength: StrengthRow[];
  cardio: CardioRow[];
  customNames: Record<string, string>;
}

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
      strength.push({ id, sessionId: r.routine_datauuid || date, ts, date, ref, sets });
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

const base = (n: string) => n.split(/[\\/]/).pop() ?? n;
const isCustom = (n: string) => /exercise\.custom_exercise\.\d+\.csv$/i.test(n);
const isExercise = (n: string) => /shealth\.exercise\.\d+\.csv$/i.test(n);

/** Acepta archivos CSV sueltos y/o ZIP de la exportación de Samsung Health. */
export async function importSamsungFiles(files: File[]): Promise<SamsungImport> {
  const res: SamsungImport = { strength: [], cardio: [], customNames: {} };
  const handle = (name: string, text: string) => {
    const b = base(name);
    if (isCustom(b)) Object.assign(res.customNames, parseCustomExerciseCsv(text));
    else if (isExercise(b)) {
      const p = parseExerciseCsv(text);
      res.strength.push(...p.strength);
      res.cardio.push(...p.cardio);
    }
  };
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) {
      const buf = new Uint8Array(await f.arrayBuffer());
      const entries = unzipSync(buf, { filter: (e) => { const b = base(e.name); return isCustom(b) || isExercise(b); } });
      for (const [name, data] of Object.entries(entries)) handle(name, strFromU8(data));
    } else if (/\.csv$/i.test(f.name)) {
      handle(f.name, await f.text());
    }
  }
  return res;
}
