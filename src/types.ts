export type DayName = string;
export const DAYS: DayName[] = ['Push', 'Pull', 'Leg'];

export interface SetRec { w: number; r: number; done?: boolean; restSec?: number; rir?: number }

/** Una fila de fuerza de Samsung Health = un ejercicio dentro de una sesión. */
export interface StrengthRow {
  id: string;            // datauuid (clave de deduplicación)
  sessionId: string;     // routine_datauuid o fecha
  ts: number;            // epoch ms (UTC)
  date: string;          // YYYY-MM-DD local
  ref: string;           // custom_id, "type:10018" o "name:<Nombre>"
  sets: SetRec[];
  durMin?: number;       // duración del ejercicio (min)
  avgHr?: number;        // frecuencia cardíaca media (lpm)
  maxHr?: number;        // frecuencia cardíaca máxima (lpm)
  minHr?: number;        // frecuencia cardíaca mínima (lpm)
  kcal?: number;         // calorías estimadas
  note?: string;         // nota del ejercicio en esta sesión
  day?: DayName;         // rutina asignada manualmente
}

export interface LogExMeta {
  id?: string;
  ts?: number;
  durMin?: number;
  avgHr?: number;
  maxHr?: number;
  minHr?: number;
  kcal?: number;
}

export interface LogExDraft {
  name: string;
  done: boolean;
  sets: SetRec[];
  note: string;
  meta?: LogExMeta;
}

export interface LogDraft {
  date: string;
  day: DayName | 'Libre';
  exercises: LogExDraft[];
  sessionId?: string;
  startedAt?: number;
  dirty?: boolean;
}

export interface LiveWorkout {
  date: string;
  day: DayName | 'Libre';
  startedAt: number;
  curIdx: number;
  exercises: LogExDraft[];
  targetRestSec: number;
  restStartedAt?: number;
  restUntil?: number;
  restRef?: { ei: number; si: number };
  lastCompletedExIdx?: number;
  pickerMode?: 'swap' | 'add';
  pickerQuery?: string;
  exMenuOpen?: boolean;
}

export interface CardioRow {
  id: string; ts: number; date: string; type: number;
  durMin: number; distKm: number; avgHr: number; kcal: number; vo2?: number;
}

export interface DailyWellbeing {
  date: string;         // YYYY-MM-DD
  sleepMin?: number;    // duración de sueño (min)
  sleepScore?: number;  // puntuación de sueño (0-100)
  sleepEff?: number;    // eficiencia de sueño (%)
  remMin?: number;      // sueño REM (min)
  deepMin?: number;     // sueño profundo (min)
  physRec?: number;     // recuperación física (0-100)
  mentalRec?: number;   // recuperación mental (0-100)
  steps?: number;       // pasos totales del día
  stepKm?: number;      // distancia diaria en pasos (km)
  activeMin?: number;   // tiempo activo diario (min)
  stepKcal?: number;    // kcal activas por pasos
  energyScore?: number; // Energy Score / vitalidad (0-100)
  rhr?: number;         // FC en reposo nocturna (lpm)
  hrv?: number;         // HRV nocturna (ms)
}

export interface Measure {
  date: string; // YYYY-MM-DD
  armL?: number; armR?: number; torso?: number; waist?: number;
  thighL?: number; thighR?: number; kneeL?: number; kneeR?: number;
  calfL?: number; calfR?: number; glute?: number; shoulders?: number;
  bf?: number; weight?: number; muscle?: number; note?: string;
}

export type DataKind = 'strength' | 'cardio' | 'measures' | 'wellbeing';
export type DataRecord = StrengthRow | CardioRow | Measure | DailyWellbeing;

export const BASIC_MEASURE_KEYS: (keyof Measure)[] = ['weight', 'bf', 'muscle', 'waist'];

export const MEASURE_FIELDS: { key: keyof Measure; label: string; unit: string }[] = [
  { key: 'weight', label: 'Peso', unit: 'kg' },
  { key: 'bf', label: '% Grasa', unit: '%' },
  { key: 'muscle', label: 'Masa muscular', unit: 'kg' },
  { key: 'waist', label: 'Cintura', unit: 'cm' },
  { key: 'torso', label: 'Torso', unit: 'cm' },
  { key: 'shoulders', label: 'Hombros', unit: 'cm' },
  { key: 'glute', label: 'Glúteo', unit: 'cm' },
  { key: 'armL', label: 'Brazo izq.', unit: 'cm' },
  { key: 'armR', label: 'Brazo der.', unit: 'cm' },
  { key: 'thighL', label: 'Muslo izq.', unit: 'cm' },
  { key: 'thighR', label: 'Muslo der.', unit: 'cm' },
  { key: 'kneeL', label: 'Sobre rodilla izq.', unit: 'cm' },
  { key: 'kneeR', label: 'Sobre rodilla der.', unit: 'cm' },
  { key: 'calfL', label: 'Gemelo izq.', unit: 'cm' },
  { key: 'calfR', label: 'Gemelo der.', unit: 'cm' },
];

export interface RoutineEx { name: string; sets: number; reps: number }
export interface MuscleMap { p: string; s: string[] }
export type AiTone = 'simple' | 'technical';
export interface AiEntry { status?: string; prescription?: string; biomech?: string }
export interface AiSection {
  title: string;
  verdict: 'good' | 'warning' | 'neutral';
  text: string;
}

export interface AiResult {
  date: string;
  tone?: AiTone;
  summary?: string;
  overview?: {
    overallStatus: string;       // ej: "En progresión positiva", "Superávit efectivo", etc.
    highlights: string[];        // 3-4 puntos clave rápidos
    sections: AiSection[];       // Bloques detallados: Composición corporal, Rendimiento PPL, Fatiga/Recuperación, Próximos pasos
  };
  byExercise: Record<string, AiEntry>;
}

export type AiJobStatus = 'pending' | 'running' | 'completed' | 'error';

export interface AiJob {
  id: string;
  status: AiJobStatus;
  tone: AiTone;
  payload: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  attempts: number;
  startedAt?: number;
  finishedAt?: number;
  error?: string;
}

export interface SyncJob {
  id: 'cloud-sync';
  status: 'pending' | 'running' | 'error';
  createdAt: number;
  updatedAt: number;
  attempts: number;
  error?: string;
  nextAttemptAt?: number;
}

export interface RoutineMeta { color?: string; sub?: string }

export type TrainingGoal = 'bulk' | 'cut' | 'recomp' | 'strength';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export interface AthleteProfile {
  sex: string;
  age: number;
  height: number;
  goal?: TrainingGoal;
  experience?: ExperienceLevel;
  daysPerWeek?: number;
}

export interface Settings {
  routines: Record<DayName, RoutineEx[]>;
  routineMeta?: Record<DayName, RoutineMeta>;
  customNames: Record<string, string>;   // ref -> nombre (de custom_exercise.csv)
  refNames: Record<string, string>;      // ref -> nombre manual (renombrar tipos Samsung)
  aliases: Record<string, string>;       // nombre -> nombre (fusionar)
  muscles: Record<string, MuscleMap>;    // nombre normalizado -> músculos
  notes: Record<string, string>;         // nombre -> nota biomecánica editable
  phases: { name: string; start: string }[];
  profile: AthleteProfile;
  onboardingCompleted?: boolean;
  aiTone?: AiTone;
  ai?: AiResult;
}
