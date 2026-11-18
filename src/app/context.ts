import type { DayName, LiveWorkout, LogDraft } from '../types';
import type { State } from '../ui/shared';
import { createWizardDraft } from '../store/wizardSelectors';

export const DRAFT_KEY = 'gymapp_log_draft';
export const LIVE_WORKOUT_KEY = 'gymapp_live_workout';

export interface AppContext {
  readonly state: State;
  readonly root: HTMLElement;
  render: () => void;
  reload: () => Promise<void>;
  persist: () => Promise<void>;
  toast: (msg: string) => void;
  setTab: (tab: string) => void;
  getLastRoutine: () => DayName;
  setLastRoutine: (day: DayName) => void;
  queueSync: () => void;
  updateSyncDom: () => void;
  askConfirm: (opts: NonNullable<State['confirmModal']>) => Promise<boolean>;
  clearActiveWorkouts: () => void;
  addExToDraft: (name: string, fallbackSets?: number, fallbackReps?: number) => void;
  syncWorkoutRoutineNames: (oldName?: string, newName?: string) => void;
}

export const arg = (el: HTMLElement): string => el.dataset.arg ?? '';

export const splitPair = (raw: string): [string, string] => {
  const sep = raw.lastIndexOf('|');
  return sep < 0 ? [raw, ''] : [raw.slice(0, sep), raw.slice(sep + 1)];
};

export const num = (v: string): number | undefined => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

export function loadJson<T>(key: string): T | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

export function saveJson(key: string, val?: unknown): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (val !== undefined) localStorage.setItem(key, JSON.stringify(val));
    else localStorage.removeItem(key);
  } catch {
    /* ignore quota errors */
  }
}

export const loadDraft = (): LogDraft | undefined => loadJson<LogDraft>(DRAFT_KEY);
export const saveDraft = (d?: LogDraft): void => saveJson(DRAFT_KEY, d);
export const loadLive = (): LiveWorkout | undefined => loadJson<LiveWorkout>(LIVE_WORKOUT_KEY);
export const saveLive = (w?: LiveWorkout): void => saveJson(LIVE_WORKOUT_KEY, w);

export function maybeOpenInitialWizard(S: State): boolean {
  if (S.settings.onboardingCompleted || S.strength.length > 0 || S.measures.length > 0 || S.wizard) return false;
  S.wizard = createWizardDraft(S);
  return true;
}
