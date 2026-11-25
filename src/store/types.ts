import type { Analysis } from '../lib/analysis';
import type { AiQuotaStatus } from '../lib/aiQuota';
import type { CloudUser } from '../lib/firebase';
import type {
  AiJob,
  CardioRow,
  DailyWellbeing,
  DayName,
  LiveWorkout,
  LogDraft,
  Measure,
  Settings,
  StrengthRow,
  SyncJob,
} from '../types';
import type { WizardDraft } from './wizardSelectors';

export type RangeKey = '1M' | '3M' | '6M' | '1A' | 'Todo' | 'Custom';
export const RANGES: { key: RangeKey; label: string; days?: number }[] = [
  { key: '1M', label: '1M', days: 30 },
  { key: '3M', label: '3M', days: 90 },
  { key: '6M', label: '6M', days: 180 },
  { key: '1A', label: '1A', days: 365 },
  { key: 'Todo', label: 'Todo' },
  { key: 'Custom', label: 'Fechas' },
];

export interface WorkoutSummary {
  day: DayName | 'Libre';
  durationMin: number;
  exercises: number;
  sets: number;
  tonnageKg: number;
  prNames: string[];
}

/** Subpestañas disponibles dentro de `Planificación`. */
export type PlanTab = 'routines' | 'exercises' | 'phases';

export interface DateBounds {
  key: RangeKey;
  from: string | null;
  to: string | null;
  label: string;
  days?: number;
}

/** Estado global de la aplicación en memoria. */
export interface State {
  tab: string;
  strength: StrengthRow[];
  cardio: CardioRow[];
  measures: Measure[];
  wellbeing: DailyWellbeing[];
  settings: Settings;
  analysis: Analysis;
  sel: Record<string, string>;
  perimeter: string;
  muscleSel: string;
  logDraft?: LogDraft;
  liveWorkout?: LiveWorkout;
  planTab?: PlanTab;
  aiTab?: number;
  dayExtra?: Record<string, boolean>;
  ranges?: Record<string, RangeKey>;
  customRanges?: Record<string, { from?: string; to?: string }>;
  measureDate?: string;
  measurePerimOpen?: boolean;
  measureDraft?: Record<string, string>;
  measureScrollTs?: number;
  bodyMetric?: 'weight' | 'muscle';
  calcDraft?: {
    w?: string;
    r?: string;
    rir?: string;
    bodyW?: string;
    bodyBf?: string;
    act?: string;
    goal?: string;
    protein?: string;
    fat?: string;
    meals?: string;
  };
  activeModal?: ActiveModal;
  exerciseMapSearch?: string;
  exerciseMapMuscle?: string;
  showAllExerciseMap?: boolean;
  mergeFrom?: string;
  mergeTo?: string;
  planRoutine?: string;
  authReady?: boolean;
  user?: CloudUser | null;
  syncing?: boolean;
  syncJob?: SyncJob;
  lastSync?: number;
  busy?: 'ai';
  aiJob?: AiJob;
  aiQuota?: AiQuotaStatus;
  toast?: string;
  toastAction?: ToastAction;
}

/** Acción opcional embebida dentro de un toast (p. ej. `Deshacer`). */
export interface ToastAction {
  label: string;
  onAction: () => void;
}

/** Opciones de diálogo de confirmación modal. */
export interface ConfirmModalOpts {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm?: () => void;
}

/** Unión discriminada de todos los modales posibles en la aplicación. */
export type ActiveModal =
  | null
  | ({ type: 'confirm' } & ConfirmModalOpts)
  | { type: 'wizard'; draft: WizardDraft }
  | { type: 'exercise'; routine?: string; rowIdx?: number; fromLog?: boolean; initialName?: string }
  | { type: 'routineExercisePicker'; routine: string; replaceRowIdx?: number }
  | { type: 'logExercisePicker' }
  | { type: 'homeExercisePicker' }
  | { type: 'mergeExercisePicker'; slot: 'from' | 'to' }
  | { type: 'routine'; mode: 'create' | 'edit'; oldName?: string; name: string; sub: string; color: string }
  | { type: 'note'; exName: string; value: string }
  | { type: 'workoutSummary'; summary: WorkoutSummary };

const ERROR_PATTERNS: [RegExp, string][] = [
  [/permission-denied|insufficient permissions/i, 'Sin permisos en la nube. Cierra sesión y vuelve a entrar con tu cuenta verificada.'],
  [/offline|network-request-failed|unavailable|failed to fetch|load failed/i, 'Sin conexión estable. Tus datos están a salvo en el dispositivo y se sincronizarán al volver la red.'],
  [/popup-closed-by-user|cancelled-popup-request/i, 'Se cerró la ventana antes de completar el inicio de sesión.'],
  [/popup-blocked/i, 'El navegador bloqueó la ventana emergente. Permite popups e inténtalo de nuevo.'],
  [/quota-exceeded|resource-exhausted|\b429\b/i, 'Límite temporal de peticiones alcanzado. Espera unos minutos y vuelve a intentarlo.'],
  [/auth\/invalid-credential|auth\/wrong-password|auth\/user-not-found/i, 'Correo o contraseña incorrectos.'],
  [/auth\/invalid-email/i, 'El formato del correo electrónico no es válido.'],
  [/auth\/email-already-in-use/i, 'Ya existe una cuenta con ese correo. Prueba a iniciar sesión o recuperar la contraseña.'],
  [/auth\/weak-password/i, 'La contraseña debe tener al menos 6 caracteres.'],
  [/auth\/too-many-requests/i, 'Demasiados intentos seguidos. Espera unos minutos antes de volver a intentarlo.'],
  [/unauthenticated|auth\/|user-token-expired|requires-recent-login/i, 'Tu sesión ha caducado. Vuelve a iniciar sesión.'],
  [/invalid zip|corrupt|unexpected eof/i, 'El archivo ZIP está dañado o incompleto. Vuelve a exportarlo desde Samsung Health.'],
];

/**
 * Traduce errores técnicos internos (Firebase, red, ZIP/CSV) a mensajes claros y accionables en español.
 *
 * @param err - Excepción o mensaje técnico original.
 * @param fallback - Texto seguro si el error viene vacío o en jerga de SDK.
 * @returns Mensaje comprensible para el usuario final.
 */
export function humanizeError(err: unknown, fallback = 'No se pudo completar la operación.'): string {
  const msg = (typeof err === 'string' ? err : err instanceof Error ? err.message : '').trim();
  for (const [pattern, label] of ERROR_PATTERNS) {
    if (pattern.test(msg)) return label;
  }
  if (!msg || /FirebaseError|firestore\/|indexedDB/i.test(msg)) return fallback;
  return msg;
}

/**
 * Resuelve el modal activo leyendo la unión tipada `activeModal`.
 *
 * @param state - Estado global de la aplicación.
 * @returns El descriptor discriminado del modal abierto o `null`.
 */
export function resolveActiveModal(state: State): ActiveModal {
  return state.activeModal ?? null;
}
