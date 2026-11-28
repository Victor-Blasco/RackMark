import type { ExStats } from '../lib/analysis';
import { daysAgoIso, diffIsoDays, isValidIsoDate, LEGACY_ROUTINE_COLORS, norm, ROUTINE_COLORS, todayIso } from '../lib/seed';
import type { AiEntry, AiResult, AiSection, Settings } from '../types';
import {
  humanizeError,
  RANGES,
  type DateBounds,
  type PlanTab,
  type RangeKey,
  type State,
  type ToastAction,
  type WorkoutSummary,
} from '../store/types';

export {
  humanizeError,
  RANGES,
  todayIso,
  type DateBounds,
  type PlanTab,
  type RangeKey,
  type State,
  type ToastAction,
  type WorkoutSummary,
};

export function rangeCutoff(r: RangeKey): string | null {
  const days = RANGES.find((x) => x.key === r)?.days;
  return days ? daysAgoIso(days) : null;
}

const safeDateSlice = (d: string, a: number, b: number) => d.replace(/[<>&"']/g, '').slice(a, b);

/** Formatea una fecha ISO (`YYYY-MM-DD`) a `DD/MM/YYYY`. */
export const fmtDate = (d: string) => `${safeDateSlice(d, 8, 10)}/${safeDateSlice(d, 5, 7)}/${safeDateSlice(d, 0, 4)}`;

/** Formatea una fecha ISO (`YYYY-MM-DD`) a formato corto `DD/MM`. */
export const short = (d: string) => `${safeDateSlice(d, 8, 10)}/${safeDateSlice(d, 5, 7)}`;

const cleanIso = (v?: string) => {
  const t = v?.trim();
  return t && isValidIsoDate(t) ? t : null;
};

/** Resuelve los límites de fecha activos (`from`, `to`, `label` y días) para un ámbito dado. */
export function resolveRange(S: State, scope: string, fallback: RangeKey = '1M'): DateBounds {
  const key: RangeKey = S.ranges?.[scope] ?? fallback;
  if (key === 'Custom') {
    const raw = S.customRanges?.[scope] ?? {};
    let from = cleanIso(raw.from);
    let to = cleanIso(raw.to);
    if (from && to && from > to) [from, to] = [to, from];
    const days = from && to ? diffIsoDays(from, to) : undefined;
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

/** Busca un consejo del Coach IA por nombre exacto o normalizado (sin distinción de mayúsculas/tildes). */
export function findAiExercise(ai: AiResult | undefined, exName: string): AiEntry | undefined {
  const byEx = ai?.byExercise;
  if (!byEx) return undefined;
  if (byEx[exName]) return byEx[exName];
  const target = norm(exName);
  const hit = Object.entries(byEx).find(([k]) => norm(k) === target);
  return hit?.[1];
}

/** Calcula la media móvil de 7 días naturales conservando los 6 días previos de `fullHistory` si está disponible. */
export function movingAverage7dFor(
  items: { date: string; weight?: number }[],
  fullHistory?: { date: string; weight?: number }[],
): (number | null)[] {
  if (!fullHistory || fullHistory.length <= items.length) return movingAverage7d(items);
  const sorted = [...fullHistory].sort((a, b) => a.date.localeCompare(b.date));
  const avgs = movingAverage7d(sorted);
  const byDate = new Map<string, number | null>();
  sorted.forEach((m, i) => byDate.set(m.date, avgs[i]));
  return items.map((m) => (byDate.has(m.date) ? byDate.get(m.date)! : null));
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

export const DAY_COLOR: Record<string, string> = { Push: '#A855F7', Pull: '#3B82F6', Leg: '#10B981' };

/** Devuelve la lista ordenada de rutinas definidas en los ajustes (o PPL por defecto). */
export function routineNames(s: Settings): string[] {
  const keys = Object.keys(s.routines ?? {});
  return keys.length ? keys : ['Push', 'Pull', 'Leg'];
}

/** Devuelve el color hex asignado a una rutina, con fallback por defecto o por índice. */
export function routineColor(name: string, s?: Settings, idx = 0): string {
  const raw = s?.routineMeta?.[name]?.color;
  if (raw && !LEGACY_ROUTINE_COLORS.has(raw.toUpperCase())) return raw;
  return DAY_COLOR[name] ?? ROUTINE_COLORS[idx % ROUTINE_COLORS.length];
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
