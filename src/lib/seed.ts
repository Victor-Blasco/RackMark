import type { MuscleMap, Settings } from '../types';

export const DRAFT_STORAGE_KEY = 'gymapp_log_draft';
export const LIVE_WORKOUT_STORAGE_KEY = 'gymapp_live_workout';
export const UNSAFE_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);
export const LEGACY_ROUTINE_COLORS: ReadonlySet<string> = new Set(['#F43F5E', '#EC4899']);

export const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Comprueba que `s` sea una fecha real de calendario en formato `YYYY-MM-DD`. */
export function isValidIsoDate(s: unknown): s is string {
  if (typeof s !== 'string' || !ISO_DATE_RE.test(s)) return false;
  const ts = Date.parse(`${s}T00:00:00Z`);
  return Number.isFinite(ts) && new Date(ts).toISOString().slice(0, 10) === s;
}

/** Devuelve la fecha local en formato `YYYY-MM-DD` sin sesgo UTC. */
export function todayIso(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parsea texto decimal admitiendo coma o punto español (`"72,5"` -> `72.5`). */
export function parseDecimal(raw: string): number | undefined {
  const trimmed = raw.trim().replace(',', '.');
  if (!trimmed) return undefined;
  const n = parseFloat(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

/** Devuelve la fecha local `YYYY-MM-DD` correspondiente a hace `days` días. */
export function daysAgoIso(days: number, now = Date.now()): string {
  return todayIso(new Date(now - days * 864e5));
}

/** Calcula los días naturales inclusivos entre dos fechas ISO `YYYY-MM-DD` (`>= 1`). */
export function diffIsoDays(from: string, to: string): number {
  const diff = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5) + 1;
  return Number.isFinite(diff) && diff > 0 ? diff : 1;
}

/** Tipos predefinidos de fuerza de Samsung Health (EXERCISE_TYPE 10004–10027) para importaciones ZIP. */
export const BUILTIN_REF_NAMES: Record<string, string> = {
  'type:10004': 'Flexiones',
  'type:10005': 'Dominadas',
  'type:10006': 'Abdominales (sit-ups)',
  'type:10011': 'Press de banca',
  'type:10012': 'Sentadilla',
  'type:10013': 'Zancadas',
  'type:10014': 'Prensa de piernas',
  'type:10015': 'Extensiones de piernas',
  'type:10016': 'Curl de piernas sentado',
  'type:10017': 'Extensiones lumbares',
  'type:10018': 'Jalones al pecho',
  'type:10019': 'Peso muerto',
  'type:10020': 'Press de hombros',
  'type:10021': 'Elevaciones frontales',
  'type:10022': 'Elevaciones laterales',
  'type:10023': 'Abdominales (crunches)',
  'type:10024': 'Elevaciones de piernas',
  'type:10025': 'Plancha',
  'type:10026': 'Curl de bíceps',
  'type:10027': 'Extensiones de tríceps',
};

const M = (p: string, ...s: string[]): MuscleMap => ({ p, s });

/** Catálogo predeterminado de 60 ejercicios típicos de gimnasio con mapeo muscular. */
const CATALOG_ENTRIES: [string, MuscleMap][] = [
  // Pecho (9)
  ['Press de banca', M('Pecho', 'Tríceps', 'Hombros')],
  ['Press inclinado con mancuernas', M('Pecho', 'Hombros', 'Tríceps')],
  ['Press plano con mancuernas', M('Pecho', 'Tríceps', 'Hombros')],
  ['Press inclinado en multipower', M('Pecho', 'Hombros', 'Tríceps')],
  ['Press en máquina', M('Pecho', 'Tríceps', 'Hombros')],
  ['Aperturas en máquina', M('Pecho')],
  ['Cruce de poleas', M('Pecho')],
  ['Fondos en paralelas', M('Pecho', 'Tríceps', 'Hombros')],
  ['Flexiones', M('Pecho', 'Tríceps', 'Hombros')],
  // Espalda (10)
  ['Dominadas', M('Espalda', 'Bíceps')],
  ['Jalón al pecho', M('Espalda', 'Bíceps')],
  ['Jalón unilateral', M('Espalda', 'Bíceps')],
  ['Remo con barra', M('Espalda', 'Bíceps', 'Isquios')],
  ['Remo en polea baja', M('Espalda', 'Bíceps')],
  ['Remo en máquina', M('Espalda', 'Bíceps')],
  ['Remo con mancuerna', M('Espalda', 'Bíceps')],
  ['Remo en T', M('Espalda', 'Bíceps')],
  ['Pullover en polea', M('Espalda', 'Pecho')],
  ['Extensión lumbar', M('Espalda', 'Glúteo', 'Isquios')],
  // Hombros (7)
  ['Press militar', M('Hombros', 'Tríceps')],
  ['Press de hombros con mancuernas', M('Hombros', 'Tríceps')],
  ['Press de hombros en máquina', M('Hombros', 'Tríceps')],
  ['Elevaciones laterales con mancuernas', M('Hombros')],
  ['Elevaciones laterales en polea', M('Hombros')],
  ['Pájaros en máquina', M('Hombros', 'Espalda')],
  ['Face pull', M('Hombros', 'Espalda')],
  // Bíceps (6)
  ['Curl de bíceps con barra', M('Bíceps')],
  ['Curl con mancuernas', M('Bíceps')],
  ['Curl martillo', M('Bíceps')],
  ['Curl predicador', M('Bíceps')],
  ['Curl en banco inclinado', M('Bíceps')],
  ['Curl en polea', M('Bíceps')],
  // Tríceps (5)
  ['Extensión de tríceps en polea', M('Tríceps')],
  ['Extensión de tríceps con cuerda', M('Tríceps')],
  ['Extensión de tríceps sobre la cabeza', M('Tríceps')],
  ['Press francés', M('Tríceps')],
  ['Fondos en máquina', M('Tríceps', 'Pecho')],
  // Cuádriceps (7)
  ['Sentadilla', M('Cuádriceps', 'Glúteo', 'Aductores')],
  ['Sentadilla hack', M('Cuádriceps', 'Glúteo')],
  ['Sentadilla en multipower', M('Cuádriceps', 'Glúteo')],
  ['Prensa de piernas', M('Cuádriceps', 'Glúteo')],
  ['Extensión de cuádriceps', M('Cuádriceps')],
  ['Sentadilla búlgara', M('Cuádriceps', 'Glúteo')],
  ['Zancadas', M('Cuádriceps', 'Glúteo')],
  // Isquios (5)
  ['Peso muerto convencional', M('Isquios', 'Espalda', 'Glúteo')],
  ['Peso muerto rumano', M('Isquios', 'Glúteo')],
  ['Peso muerto sumo', M('Isquios', 'Glúteo', 'Cuádriceps', 'Aductores')],
  ['Curl femoral sentado', M('Isquios')],
  ['Curl femoral tumbado', M('Isquios')],
  // Glúteo (3)
  ['Hip thrust', M('Glúteo', 'Isquios')],
  ['Patada de glúteo en polea', M('Glúteo')],
  ['Abductores en máquina', M('Glúteo')],
  // Aductores (1)
  ['Aductores en máquina', M('Aductores')],
  // Gemelos (2)
  ['Elevación de gemelos de pie', M('Gemelos')],
  ['Elevación de gemelos sentado', M('Gemelos')],
  // Abdomen (5)
  ['Crunch en polea', M('Abdomen')],
  ['Crunch en máquina', M('Abdomen')],
  ['Elevación de piernas colgado', M('Abdomen')],
  ['Plancha', M('Abdomen')],
  ['Rueda abdominal', M('Abdomen')],
];

/** Respaldo invisible de músculos para nombres históricos / Samsung Health (no aparece en el catálogo). */
const LEGACY_MUSCLE_ENTRIES: [string, MuscleMap][] = [
  ['Press horizontal en máquina', M('Pecho', 'Tríceps', 'Hombros')],
  ['Press de banca inclinado con mancuernas', M('Pecho', 'Hombros', 'Tríceps')],
  ['Press De Banca Plano Con Mancuernas', M('Pecho', 'Tríceps', 'Hombros')],
  ['Press En Máquina De Discos', M('Pecho', 'Tríceps', 'Hombros')],
  ['Press Kaz', M('Pecho', 'Tríceps', 'Hombros')],
  ['Aperturas En Polea', M('Pecho')],
  ['Fondos', M('Pecho', 'Tríceps', 'Hombros')],
  ['Press de hombros', M('Hombros', 'Tríceps')],
  ['Elevaciones frontales', M('Hombros')],
  ['Elevaciones laterales', M('Hombros')],
  ['Peck-deck Inverso', M('Hombros', 'Espalda')],
  ['Extensiones de tríceps con barra', M('Tríceps')],
  ['Extensiones de tríceps unilateral', M('Tríceps')],
  ['Extensiones de tríceps', M('Tríceps')],
  ['Jalones al pecho', M('Espalda', 'Bíceps')],
  ['Dominadas Con Lastre', M('Espalda', 'Bíceps')],
  ['Extensiones lumbares', M('Espalda', 'Glúteo', 'Isquios')],
  ['Remo Bajo Unilateral', M('Espalda', 'Bíceps')],
  ['Remo Unilateral', M('Espalda', 'Bíceps')],
  ['Pull Over', M('Espalda', 'Pecho')],
  ['Curl de bíceps predicador', M('Bíceps')],
  ['Curl de bíceps Martillo', M('Bíceps')],
  ['Curl de bíceps Bayesian', M('Bíceps')],
  ['Curl de bíceps en banco inclinado', M('Bíceps')],
  ['Curl de bíceps', M('Bíceps')],
  ['Sentadilla Pendular', M('Cuádriceps', 'Glúteo')],
  ['Extensiones de piernas', M('Cuádriceps')],
  ['Curl de piernas sentado', M('Isquios')],
  ['Curl Femoral De Pie', M('Isquios')],
  ['RDL', M('Isquios', 'Glúteo')],
  ['Peso muerto', M('Isquios', 'Espalda', 'Glúteo')],
  ['Aductores', M('Aductores')],
  ['Adductores', M('Aductores')],
  ['Abductores', M('Glúteo')],
  ['Sóleo Sentado', M('Gemelos')],
  ['Elevaciones de gemelos', M('Gemelos')],
  ['Abdominales En Máquina', M('Abdomen')],
  ['Abdominales (sit-ups)', M('Abdomen')],
  ['Abdominales (crunches)', M('Abdomen')],
  ['Elevaciones de piernas', M('Abdomen')],
];

export const CATALOG_EXERCISES: string[] = CATALOG_ENTRIES.map(([name]) => name);

export const CATALOG_NORM_SET: ReadonlySet<string> = new Set(CATALOG_EXERCISES.map((n) => norm(n)));

/** Músculo principal (1 serie) y secundarios (0,5 series). Clave = nombre normalizado. */
export const DEFAULT_MUSCLES: Record<string, MuscleMap> = {
  ...Object.fromEntries(LEGACY_MUSCLE_ENTRIES.map(([name, m]) => [norm(name), m])),
  ...Object.fromEntries(CATALOG_ENTRIES.map(([name, m]) => [norm(name), m])),
};

export const MUSCLES = ['Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Cuádriceps', 'Isquios', 'Glúteo', 'Aductores', 'Gemelos', 'Abdomen'];
export const MUSCLE_DAY: Record<string, 'Push' | 'Pull' | 'Leg' | null> = {
  Pecho: 'Push', Hombros: 'Push', Tríceps: 'Push', Espalda: 'Pull', Bíceps: 'Pull',
  Cuádriceps: 'Leg', Isquios: 'Leg', Glúteo: 'Leg', Aductores: 'Leg', Gemelos: 'Leg', Abdomen: null,
};

export const ROUTINE_COLORS = ['#A855F7', '#3B82F6', '#10B981', '#F59E0B', '#06B6D4', '#6366F1', '#14B8A6', '#84CC16'];

const PPL_ROUTINES: Settings['routines'] = {
  Push: [
    { name: 'Press de banca', sets: 3, reps: 8 },
    { name: 'Press inclinado con mancuernas', sets: 3, reps: 10 },
    { name: 'Aperturas en máquina', sets: 2, reps: 12 },
    { name: 'Press de hombros en máquina', sets: 2, reps: 10 },
    { name: 'Elevaciones laterales con mancuernas', sets: 3, reps: 12 },
    { name: 'Extensión de tríceps en polea', sets: 3, reps: 10 },
    { name: 'Crunch en máquina', sets: 3, reps: 12 },
  ],
  Pull: [
    { name: 'Jalón al pecho', sets: 3, reps: 10 },
    { name: 'Remo en polea baja', sets: 3, reps: 10 },
    { name: 'Remo en T', sets: 2, reps: 8 },
    { name: 'Pájaros en máquina', sets: 2, reps: 12 },
    { name: 'Curl predicador', sets: 3, reps: 10 },
    { name: 'Curl martillo', sets: 2, reps: 10 },
    { name: 'Crunch en polea', sets: 3, reps: 12 },
  ],
  Leg: [
    { name: 'Sentadilla hack', sets: 3, reps: 8 },
    { name: 'Peso muerto rumano', sets: 3, reps: 8 },
    { name: 'Extensión de cuádriceps', sets: 2, reps: 12 },
    { name: 'Curl femoral sentado', sets: 3, reps: 10 },
    { name: 'Aductores en máquina', sets: 2, reps: 12 },
    { name: 'Elevación de gemelos sentado', sets: 3, reps: 12 },
  ],
};

const PPL_META: NonNullable<Settings['routineMeta']> = {
  Push: { color: '#A855F7', sub: 'Empuje' },
  Pull: { color: '#3B82F6', sub: 'Tirón' },
  Leg: { color: '#10B981', sub: 'Pierna' },
};

export interface RoutineTemplate {
  label: string;
  desc: string;
  routines: Settings['routines'];
  meta: NonNullable<Settings['routineMeta']>;
}

export const ROUTINE_TEMPLATES: Record<string, RoutineTemplate> = {
  ppl: {
    label: 'Push / Pull / Leg',
    desc: '3 días: Empuje, Tirón y Pierna',
    routines: structuredClone(PPL_ROUTINES),
    meta: structuredClone(PPL_META),
  },
  upperLower: {
    label: 'Torso / Pierna (4 días)',
    desc: 'Torso A, Pierna A, Torso B y Pierna B',
    routines: {
      'Torso A': [
        { name: 'Press de banca', sets: 3, reps: 8 },
        { name: 'Jalón al pecho', sets: 3, reps: 10 },
        { name: 'Press de hombros en máquina', sets: 2, reps: 10 },
        { name: 'Remo en polea baja', sets: 2, reps: 10 },
        { name: 'Curl predicador', sets: 2, reps: 12 },
        { name: 'Extensión de tríceps en polea', sets: 2, reps: 12 },
      ],
      'Pierna A': [
        { name: 'Sentadilla hack', sets: 3, reps: 8 },
        { name: 'Curl femoral sentado', sets: 3, reps: 10 },
        { name: 'Extensión de cuádriceps', sets: 2, reps: 12 },
        { name: 'Aductores en máquina', sets: 2, reps: 12 },
        { name: 'Elevación de gemelos sentado', sets: 3, reps: 12 },
      ],
      'Torso B': [
        { name: 'Press inclinado en multipower', sets: 3, reps: 10 },
        { name: 'Remo en T', sets: 3, reps: 8 },
        { name: 'Aperturas en máquina', sets: 2, reps: 12 },
        { name: 'Elevaciones laterales con mancuernas', sets: 3, reps: 12 },
        { name: 'Curl martillo', sets: 2, reps: 10 },
        { name: 'Extensión de tríceps sobre la cabeza', sets: 2, reps: 12 },
      ],
      'Pierna B': [
        { name: 'Peso muerto rumano', sets: 3, reps: 8 },
        { name: 'Prensa de piernas', sets: 3, reps: 10 },
        { name: 'Curl femoral tumbado', sets: 2, reps: 12 },
        { name: 'Hip thrust', sets: 2, reps: 10 },
        { name: 'Elevación de gemelos de pie', sets: 3, reps: 12 },
        { name: 'Crunch en máquina', sets: 3, reps: 12 },
      ],
    },
    meta: {
      'Torso A': { color: '#A855F7', sub: 'Fuerza' },
      'Pierna A': { color: '#10B981', sub: 'Cuádriceps' },
      'Torso B': { color: '#3B82F6', sub: 'Hipertrofia' },
      'Pierna B': { color: '#F59E0B', sub: 'Cadena post.' },
    },
  },
  fullBody: {
    label: 'Full Body (3 días)',
    desc: 'Cuerpo completo A, B y C',
    routines: {
      'Full Body A': [
        { name: 'Sentadilla', sets: 3, reps: 8 },
        { name: 'Press de banca', sets: 3, reps: 10 },
        { name: 'Jalón al pecho', sets: 3, reps: 10 },
        { name: 'Elevaciones laterales con mancuernas', sets: 3, reps: 12 },
        { name: 'Curl de bíceps con barra', sets: 2, reps: 12 },
      ],
      'Full Body B': [
        { name: 'Peso muerto rumano', sets: 3, reps: 8 },
        { name: 'Press inclinado con mancuernas', sets: 3, reps: 10 },
        { name: 'Remo en polea baja', sets: 3, reps: 10 },
        { name: 'Extensión de cuádriceps', sets: 2, reps: 12 },
        { name: 'Extensión de tríceps en polea', sets: 2, reps: 12 },
      ],
      'Full Body C': [
        { name: 'Prensa de piernas', sets: 3, reps: 10 },
        { name: 'Press militar', sets: 3, reps: 10 },
        { name: 'Remo en máquina', sets: 3, reps: 10 },
        { name: 'Curl femoral sentado', sets: 2, reps: 12 },
        { name: 'Crunch en polea', sets: 3, reps: 12 },
      ],
    },
    meta: {
      'Full Body A': { color: '#3B82F6', sub: 'Día 1' },
      'Full Body B': { color: '#10B981', sub: 'Día 2' },
      'Full Body C': { color: '#A855F7', sub: 'Día 3' },
    },
  },
  weider: {
    label: 'Weider (4 días)',
    desc: 'Pecho/Tríceps, Espalda/Bíceps, Pierna, Hombro',
    routines: {
      'Pecho y Tríceps': [
        { name: 'Press de banca', sets: 3, reps: 8 },
        { name: 'Press inclinado con mancuernas', sets: 3, reps: 10 },
        { name: 'Aperturas en máquina', sets: 3, reps: 12 },
        { name: 'Extensión de tríceps en polea', sets: 3, reps: 10 },
        { name: 'Extensión de tríceps sobre la cabeza', sets: 2, reps: 12 },
      ],
      'Espalda y Bíceps': [
        { name: 'Jalón al pecho', sets: 3, reps: 10 },
        { name: 'Remo en polea baja', sets: 3, reps: 8 },
        { name: 'Remo en T', sets: 3, reps: 10 },
        { name: 'Curl predicador', sets: 3, reps: 10 },
        { name: 'Curl martillo', sets: 3, reps: 10 },
      ],
      Pierna: [
        { name: 'Sentadilla hack', sets: 3, reps: 8 },
        { name: 'Curl femoral sentado', sets: 3, reps: 10 },
        { name: 'Extensión de cuádriceps', sets: 3, reps: 12 },
        { name: 'Aductores en máquina', sets: 3, reps: 12 },
        { name: 'Elevación de gemelos sentado', sets: 3, reps: 12 },
      ],
      Hombro: [
        { name: 'Press de hombros con mancuernas', sets: 3, reps: 8 },
        { name: 'Elevaciones laterales con mancuernas', sets: 4, reps: 12 },
        { name: 'Pájaros en máquina', sets: 3, reps: 12 },
        { name: 'Crunch en máquina', sets: 3, reps: 12 },
      ],
    },
    meta: {
      'Pecho y Tríceps': { color: '#A855F7', sub: 'Empuje' },
      'Espalda y Bíceps': { color: '#3B82F6', sub: 'Tirón' },
      Pierna: { color: '#10B981', sub: 'Tren inf.' },
      Hombro: { color: '#F59E0B', sub: 'Deltoides' },
    },
  },
};

export const DEFAULT_SETTINGS: Settings = {
  routines: structuredClone(PPL_ROUTINES),
  routineMeta: structuredClone(PPL_META),
  customNames: {}, refNames: {}, aliases: {},
  muscles: {}, notes: {},
  phases: [],
  profile: { sex: 'hombre', age: 25, height: 170 },
  aiTone: 'technical',
  theme: 'dark',
};
