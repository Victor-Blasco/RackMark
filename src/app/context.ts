import { DRAFT_STORAGE_KEY, LIVE_WORKOUT_STORAGE_KEY } from '../lib/seed';
import type { ConfirmModalOpts, ToastAction } from '../store/types';
import { createWizardDraft } from '../store/wizardSelectors';
import type { LiveWorkout, LogDraft } from '../types';
import type { State } from '../ui/shared';

export interface AppContext {
  readonly state: State;
  render: () => void;
  reload: () => Promise<void>;
  toast: (msg: string, action?: ToastAction) => void;
  askConfirm: (opts: ConfirmModalOpts) => Promise<boolean>;
  clearActiveWorkouts: () => void;
}

function loadJson<T>(key: string): T | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function saveJson(key: string, val?: unknown): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (val !== undefined) localStorage.setItem(key, JSON.stringify(val));
    else localStorage.removeItem(key);
  } catch {
    /* ignore quota errors */
  }
}

export const loadDraft = (): LogDraft | undefined => loadJson<LogDraft>(DRAFT_STORAGE_KEY);
export const saveDraft = (d?: LogDraft): void => saveJson(DRAFT_STORAGE_KEY, d);
export const loadLive = (): LiveWorkout | undefined => loadJson<LiveWorkout>(LIVE_WORKOUT_STORAGE_KEY);
export const saveLive = (w?: LiveWorkout): void => saveJson(LIVE_WORKOUT_STORAGE_KEY, w);

export function maybeOpenInitialWizard(S: State): boolean {
  if (
    S.settings.onboardingCompleted ||
    S.strength.length > 0 ||
    S.measures.length > 0 ||
    S.activeModal?.type === 'wizard'
  ) {
    return false;
  }
  const draft = createWizardDraft(S);
  S.activeModal = { type: 'wizard', draft };
  return true;
}
