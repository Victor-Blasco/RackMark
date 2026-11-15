import type { MuscleMap, Settings } from '../types';

export const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** Tipos predefinidos de fuerza de Samsung Health (EXERCISE_TYPE 10004–10027). */
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

const CATALOG_ENTRIES: [string, MuscleMap][] = [
  ['Press horizontal en máquina', M('Pecho', 'Tríceps', 'Hombros')],
  ['Press de banca', M('Pecho', 'Tríceps', 'Hombros')],
  ['Flexiones', M('Pecho', 'Tríceps', 'Hombros')],
  ['Press inclinado en multipower', M('Pecho', 'Hombros', 'Tríceps')],
  ['Press de banca inclinado con mancuernas', M('Pecho', 'Hombros', 'Tríceps')],
  ['Press De Banca Plano Con Mancuernas', M('Pecho', 'Tríceps', 'Hombros')],
  ['Press En Màquina De Discos', M('Pecho', 'Tríceps', 'Hombros')],
  ['Press Kaz', M('Pecho', 'Tríceps', 'Hombros')],
  ['Aperturas En Máquina', M('Pecho')],
  ['Aperturas En Polea', M('Pecho')],
  ['Fondos', M('Pecho', 'Tríceps', 'Hombros')],
  ['Press De Hombros En Máquina', M('Hombros', 'Tríceps')],
  ['Press de hombros Con Mancuernas', M('Hombros', 'Tríceps')],
  ['Press de hombros', M('Hombros', 'Tríceps')],
  ['Elevaciones frontales', M('Hombros')],
  ['Elevaciones laterales', M('Hombros')],
  ['Face Pull', M('Hombros', 'Espalda')],
  ['Peck-deck Inverso', M('Hombros', 'Espalda')],
  ['Extensiones de tríceps con barra', M('Tríceps')],
  ['Extensiones de tríceps unilateral', M('Tríceps')],
  ['Extensiones de tríceps', M('Tríceps')],
  ['Jalones al pecho', M('Espalda', 'Bíceps')],
  ['Jalón Unilateral', M('Espalda', 'Bíceps')],
  ['Dominadas Con Lastre', M('Espalda', 'Bíceps')],
  ['Dominadas', M('Espalda', 'Bíceps')],
  ['Extensiones lumbares', M('Espalda', 'Glúteo', 'Isquios')],
  ['Remo Bajo Unilateral', M('Espalda', 'Bíceps')],
  ['Remo Unilateral', M('Espalda', 'Bíceps')],
  ['Remo En T', M('Espalda', 'Bíceps')],
  ['Remo Con Barra', M('Espalda', 'Bíceps', 'Isquios')],
  ['Pull Over', M('Espalda', 'Pecho')],
  ['Curl de bíceps predicador', M('Bíceps')],
  ['Curl de bíceps Martillo', M('Bíceps')],
  ['Curl de bíceps Bayesian', M('Bíceps')],
  ['Curl de bíceps en banco inclinado', M('Bíceps')],
  ['Curl de bíceps', M('Bíceps')],
  ['Sentadilla Hack', M('Cuádriceps', 'Glúteo')],
  ['Sentadilla', M('Cuádriceps', 'Glúteo', 'Aductores')],
  ['Sentadilla Pendular', M('Cuádriceps', 'Glúteo')],
  ['Zancadas', M('Cuádriceps', 'Glúteo')],
  ['Prensa de piernas', M('Cuádriceps', 'Glúteo')],
  ['Extensiones de piernas', M('Cuádriceps')],
  ['Curl de piernas sentado', M('Isquios')],
  ['Curl Femoral De Pie', M('Isquios')],
  ['RDL', M('Isquios', 'Glúteo')],
  ['Peso muerto Rumano', M('Isquios', 'Glúteo')],
  ['Peso muerto', M('Isquios', 'Espalda', 'Glúteo')],
  ['Hip Thrust', M('Glúteo', 'Isquios')],
  ['Adductores', M('Aductores')],
  ['Abductores', M('Glúteo')],
  ['Sóleo Sentado', M('Gemelos')],
  ['Elevaciones de gemelos', M('Gemelos')],
  ['Abdominales En Maquina', M('Abdomen')],
  ['Abdominales (sit-ups)', M('Abdomen')],
  ['Abdominales (crunches)', M('Abdomen')],
  ['Elevaciones de piernas', M('Abdomen')],
  ['Plancha', M('Abdomen')],
];

export const CATALOG_EXERCISES: string[] = CATALOG_ENTRIES.map(([name]) => name);

/** Músculo principal (1 serie) y secundarios (0,5 series). Clave = nombre normalizado. */
export const DEFAULT_MUSCLES: Record<string, MuscleMap> = Object.fromEntries(
  CATALOG_ENTRIES.map(([name, m]) => [norm(name), m])
);

export const MUSCLES = ['Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Cuádriceps', 'Isquios', 'Glúteo', 'Aductores', 'Gemelos', 'Abdomen'];
export const MUSCLE_DAY: Record<string, 'Push' | 'Pull' | 'Leg' | null> = {
  Pecho: 'Push', Hombros: 'Push', Tríceps: 'Push', Espalda: 'Pull', Bíceps: 'Pull',
  Cuádriceps: 'Leg', Isquios: 'Leg', Glúteo: 'Leg', Aductores: 'Leg', Gemelos: 'Leg', Abdomen: null,
};

export const ROUTINE_COLORS = ['#F43F5E', '#3B82F6', '#10B981', '#F59E0B', '#A855F7', '#06B6D4', '#EC4899', '#84CC16'];

const PPL_ROUTINES: Settings['routines'] = {
  Push: [
    { name: 'Press horizontal en máquina', sets: 2, reps: 10 },
    { name: 'Press inclinado en multipower', sets: 2, reps: 10 },
    { name: 'Aperturas En Máquina', sets: 2, reps: 10 },
    { name: 'Press De Hombros En Máquina', sets: 2, reps: 8 },
    { name: 'Elevaciones laterales', sets: 3, reps: 12 },
    { name: 'Extensiones de tríceps con barra', sets: 3, reps: 10 },
    { name: 'Abdominales En Maquina', sets: 3, reps: 10 },
  ],
  Pull: [
    { name: 'Jalones al pecho', sets: 2, reps: 10 },
    { name: 'Remo Bajo Unilateral', sets: 2, reps: 8 },
    { name: 'Remo En T', sets: 2, reps: 8 },
    { name: 'Curl de bíceps predicador', sets: 3, reps: 10 },
    { name: 'Curl de bíceps Martillo', sets: 3, reps: 10 },
    { name: 'Abdominales En Maquina', sets: 3, reps: 10 },
  ],
  Leg: [
    { name: 'Curl de piernas sentado', sets: 3, reps: 10 },
    { name: 'Sentadilla Hack', sets: 2, reps: 8 },
    { name: 'Extensiones de piernas', sets: 2, reps: 10 },
    { name: 'Adductores', sets: 3, reps: 10 },
    { name: 'Sóleo Sentado', sets: 3, reps: 10 },
    { name: 'Abdominales En Maquina', sets: 2, reps: 10 },
  ],
};

const PPL_META: NonNullable<Settings['routineMeta']> = {
  Push: { color: '#F43F5E', sub: 'Empuje' },
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
        { name: 'Press horizontal en máquina', sets: 3, reps: 8 },
        { name: 'Jalones al pecho', sets: 3, reps: 10 },
        { name: 'Press De Hombros En Máquina', sets: 2, reps: 10 },
        { name: 'Remo Bajo Unilateral', sets: 2, reps: 10 },
        { name: 'Curl de bíceps predicador', sets: 2, reps: 12 },
        { name: 'Extensiones de tríceps con barra', sets: 2, reps: 12 },
      ],
      'Pierna A': [
        { name: 'Sentadilla Hack', sets: 3, reps: 8 },
        { name: 'Curl de piernas sentado', sets: 3, reps: 10 },
        { name: 'Extensiones de piernas', sets: 2, reps: 12 },
        { name: 'Adductores', sets: 2, reps: 12 },
        { name: 'Sóleo Sentado', sets: 3, reps: 12 },
      ],
      'Torso B': [
        { name: 'Press inclinado en multipower', sets: 3, reps: 10 },
        { name: 'Remo En T', sets: 3, reps: 8 },
        { name: 'Aperturas En Máquina', sets: 2, reps: 12 },
        { name: 'Elevaciones laterales', sets: 3, reps: 12 },
        { name: 'Curl de bíceps Martillo', sets: 2, reps: 10 },
        { name: 'Extensiones de tríceps unilateral', sets: 2, reps: 12 },
      ],
      'Pierna B': [
        { name: 'Peso muerto Rumano', sets: 3, reps: 8 },
        { name: 'Sentadilla Pendular', sets: 3, reps: 10 },
        { name: 'Curl Femoral De Pie', sets: 2, reps: 12 },
        { name: 'Hip Thrust', sets: 2, reps: 10 },
        { name: 'Elevaciones de gemelos', sets: 3, reps: 12 },
        { name: 'Abdominales En Maquina', sets: 3, reps: 12 },
      ],
    },
    meta: {
      'Torso A': { color: '#F43F5E', sub: 'Fuerza' },
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
        { name: 'Sentadilla Hack', sets: 3, reps: 8 },
        { name: 'Press horizontal en máquina', sets: 3, reps: 10 },
        { name: 'Jalones al pecho', sets: 3, reps: 10 },
        { name: 'Elevaciones laterales', sets: 3, reps: 12 },
        { name: 'Curl de bíceps predicador', sets: 2, reps: 12 },
      ],
      'Full Body B': [
        { name: 'Peso muerto Rumano', sets: 3, reps: 8 },
        { name: 'Press inclinado en multipower', sets: 3, reps: 10 },
        { name: 'Remo Bajo Unilateral', sets: 3, reps: 10 },
        { name: 'Extensiones de piernas', sets: 2, reps: 12 },
        { name: 'Extensiones de tríceps con barra', sets: 2, reps: 12 },
      ],
      'Full Body C': [
        { name: 'Sentadilla Pendular', sets: 3, reps: 10 },
        { name: 'Press De Hombros En Máquina', sets: 3, reps: 10 },
        { name: 'Remo En T', sets: 3, reps: 10 },
        { name: 'Curl de piernas sentado', sets: 2, reps: 12 },
        { name: 'Abdominales En Maquina', sets: 3, reps: 12 },
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
        { name: 'Press horizontal en máquina', sets: 3, reps: 8 },
        { name: 'Press inclinado en multipower', sets: 3, reps: 10 },
        { name: 'Aperturas En Máquina', sets: 3, reps: 12 },
        { name: 'Extensiones de tríceps con barra', sets: 3, reps: 10 },
        { name: 'Extensiones de tríceps unilateral', sets: 2, reps: 12 },
      ],
      'Espalda y Bíceps': [
        { name: 'Jalones al pecho', sets: 3, reps: 10 },
        { name: 'Remo Bajo Unilateral', sets: 3, reps: 8 },
        { name: 'Remo En T', sets: 3, reps: 10 },
        { name: 'Curl de bíceps predicador', sets: 3, reps: 10 },
        { name: 'Curl de bíceps Martillo', sets: 3, reps: 10 },
      ],
      Pierna: [
        { name: 'Curl de piernas sentado', sets: 3, reps: 10 },
        { name: 'Sentadilla Hack', sets: 3, reps: 8 },
        { name: 'Extensiones de piernas', sets: 3, reps: 12 },
        { name: 'Adductores', sets: 3, reps: 12 },
        { name: 'Sóleo Sentado', sets: 3, reps: 12 },
      ],
      Hombro: [
        { name: 'Press De Hombros En Máquina', sets: 3, reps: 8 },
        { name: 'Elevaciones laterales', sets: 4, reps: 12 },
        { name: 'Peck-deck Inverso', sets: 3, reps: 12 },
        { name: 'Abdominales En Maquina', sets: 3, reps: 12 },
      ],
    },
    meta: {
      'Pecho y Tríceps': { color: '#F43F5E', sub: 'Empuje' },
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
  phases: [{ name: 'Definición', start: '2026-04-11' }],
  profile: { sex: 'hombre', age: 21, height: 167 },
  aiTone: 'technical',
};
