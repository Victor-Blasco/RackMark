import type { MuscleMap, Settings } from '../types';

export const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** Tipos integrados de Samsung Health identificados por comparación con el histórico. */
export const BUILTIN_REF_NAMES: Record<string, string> = {
  'type:10015': 'Extensiones de piernas',
  'type:10016': 'Curl de piernas sentado',
  'type:10018': 'Jalones al pecho',
  'type:10022': 'Elevaciones laterales',
};

const M = (p: string, ...s: string[]): MuscleMap => ({ p, s });

const CATALOG_ENTRIES: [string, MuscleMap][] = [
  ['Press horizontal en máquina', M('Pecho', 'Tríceps', 'Hombros')],
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
  ['Elevaciones laterales', M('Hombros')],
  ['Face Pull', M('Hombros', 'Espalda')],
  ['Peck-deck Inverso', M('Hombros', 'Espalda')],
  ['Extensiones de tríceps con barra', M('Tríceps')],
  ['Extensiones de tríceps unilateral', M('Tríceps')],
  ['Jalones al pecho', M('Espalda', 'Bíceps')],
  ['Jalón Unilateral', M('Espalda', 'Bíceps')],
  ['Dominadas Con Lastre', M('Espalda', 'Bíceps')],
  ['Remo Bajo Unilateral', M('Espalda', 'Bíceps')],
  ['Remo Unilateral', M('Espalda', 'Bíceps')],
  ['Remo En T', M('Espalda', 'Bíceps')],
  ['Remo Con Barra', M('Espalda', 'Bíceps', 'Isquios')],
  ['Pull Over', M('Espalda', 'Pecho')],
  ['Curl de bíceps predicador', M('Bíceps')],
  ['Curl de bíceps Martillo', M('Bíceps')],
  ['Curl de bíceps Bayesian', M('Bíceps')],
  ['Curl de bíceps en banco inclinado', M('Bíceps')],
  ['Sentadilla Hack', M('Cuádriceps', 'Glúteo')],
  ['Sentadilla', M('Cuádriceps', 'Glúteo', 'Aductores')],
  ['Sentadilla Pendular', M('Cuádriceps', 'Glúteo')],
  ['Extensiones de piernas', M('Cuádriceps')],
  ['Curl de piernas sentado', M('Isquios')],
  ['Curl Femoral De Pie', M('Isquios')],
  ['RDL', M('Isquios', 'Glúteo')],
  ['Peso muerto Rumano', M('Isquios', 'Glúteo')],
  ['Hip Thrust', M('Glúteo', 'Isquios')],
  ['Adductores', M('Aductores')],
  ['Abductores', M('Glúteo')],
  ['Sóleo Sentado', M('Gemelos')],
  ['Elevaciones de gemelos', M('Gemelos')],
  ['Abdominales En Maquina', M('Abdomen')],
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

export const DEFAULT_SETTINGS: Settings = {
  routines: {
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
  },
  customNames: {}, refNames: {}, aliases: {},
  muscles: {}, notes: {},
  phases: [{ name: 'Definición', start: '2026-04-11' }],
  profile: { sex: 'hombre', age: 21, height: 167 },
};
