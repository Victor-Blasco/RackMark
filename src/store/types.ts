import type { Analysis } from '../lib/analysis';
import type { CloudUser } from '../lib/firebase';
import type {
  AiJob,
  CardioRow,
  DailyWellbeing,
  Measure,
  Settings,
  StrengthRow,
  SyncJob,
} from '../types';
import type { LiveWorkout, LogDraft } from '../types';
import type { RangeKey, State, WorkoutSummary } from '../ui/shared';
import type { WizardDraft } from '../ui/wizardView';

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
  | {
      type: 'confirm';
      title: string;
      message: string;
      confirmLabel?: string;
      danger?: boolean;
      onConfirm?: () => void;
    }
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
 * Resuelve el modal activo leyendo la unión tipada `activeModal` o los campos
 * heredados durante la convivencia entre Preact y controladores antiguos.
 *
 * @param state - Estado global de la aplicación.
 * @returns El descriptor discriminado del modal abierto o `null`.
 */
export function resolveActiveModal(state: State): ActiveModal {
  if (state.activeModal) return state.activeModal;
  if (state.confirmModal) return { type: 'confirm', ...state.confirmModal };
  if (state.wizard) return { type: 'wizard', draft: state.wizard };
  if (state.workoutSummary) return { type: 'workoutSummary', summary: state.workoutSummary };
  if (state.exModal) return { type: 'exercise', ...state.exModal };
  if (state.routineModal) return { type: 'routine', ...state.routineModal };
  if (state.noteModal) return { type: 'note', ...state.noteModal };
  return null;
}
