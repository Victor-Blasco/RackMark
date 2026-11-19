import type { Analysis } from '../lib/analysis';
import type { CloudUser } from '../lib/firebase';
import type {
  AiJob,
  CardioRow,
  DailyWellbeing,
  LiveWorkout,
  LogDraft,
  Measure,
  Settings,
  StrengthRow,
  SyncJob,
} from '../types';
import type { State, WorkoutSummary } from '../ui/shared';
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

/** Opciones de diálogo de confirmación modal. */
export interface ConfirmModalOpts {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm?: () => void;
}

/** Estado de dominio persistido y su análisis derivado. */
export interface DomainState {
  strength: StrengthRow[];
  cardio: CardioRow[];
  measures: Measure[];
  wellbeing: DailyWellbeing[];
  settings: Settings;
  analysis: Analysis;
}

/** Unión discriminada de todos los modales posibles en la aplicación. */
export type ActiveModal =
  | null
  | ({ type: 'confirm' } & ConfirmModalOpts)
  | { type: 'wizard'; draft: WizardDraft }
  | { type: 'exercise'; routine?: string; rowIdx?: number; fromLog?: boolean }
  | { type: 'routine'; mode: 'create' | 'edit'; oldName?: string; name: string; sub: string; color: string }
  | { type: 'note'; exName: string; value: string }
  | { type: 'workoutSummary'; summary: WorkoutSummary };

/** Estado efímero de navegación, borradores activos y red/UI. */
export interface UiState {
  tab: string;
  sel: Record<string, string>;
  perimeter: string;
  muscleSel: string;
  ranges?: Record<string, RangeKey>;
  customRanges?: Record<string, { from?: string; to?: string }>;
  liveWorkout?: LiveWorkout;
  logDraft?: LogDraft;
  activeModal: ActiveModal;
  authReady?: boolean;
  user?: CloudUser | null;
  syncing?: boolean;
  syncJob?: SyncJob;
  lastSync?: number;
  busy?: string;
  aiJob?: AiJob;
  toast?: string;
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
