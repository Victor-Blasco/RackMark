import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { StepperInput } from '../components/common/StepperInput';
import { RestTimerBar } from '../components/workout/RestTimerBar';
import { fmtMMSS } from '../hooks/useRestTimer';
import {
  allExerciseNames,
  defaultSetsForEx,
  exerciseContext,
  extractTargetWeight,
  manualSessionId,
  quickExSuggestions,
} from '../store/exerciseCatalog';
import { initLogDraft } from '../store/logSelectors';
import { LogWorkoutView } from '../views/LogWorkoutView';
import { routineNames, todayIso, type State } from './shared';

export {
  allExerciseNames,
  defaultSetsForEx,
  exerciseContext,
  extractTargetWeight,
  fmtMMSS,
  initLogDraft,
  manualSessionId,
  quickExSuggestions,
};

/** Renderiza la barra ligera de cronómetro de descanso delegando en `<RestTimerBar />`. */
export function renderRestTimerBar(timer: { targetRestSec?: number; restUntil?: number }): string {
  return renderToString(
    h(RestTimerBar, {
      restUntil: timer.restUntil,
      targetRestSec: timer.targetRestSec,
    }),
  );
}

export interface StepperOpts {
  label: string;
  labelCls?: string;
  wrapCls?: string;
  value: number;
  step: string;
  inputMode: 'decimal' | 'numeric';
  dataAttr: string;
  inputAria: string;
  stepAct: string;
  stepArgPrefix: string;
  delta: number;
  decAria: string;
  incAria: string;
  btnCls?: string;
  inpCls?: string;
}

/** Renderiza un control numérico táctil delegando en `<StepperInput />`. */
export function renderStepper(o: StepperOpts): string {
  const match = o.dataAttr.match(/^([a-z0-9-]+)="([^"]*)"$/i);
  const inputData = match ? { [match[1]]: match[2] } : undefined;
  return renderToString(
    h(StepperInput, {
      label: o.label,
      labelClass: o.labelCls,
      wrapClass: o.wrapCls,
      value: o.value,
      step: o.step,
      inputMode: o.inputMode,
      inputData,
      inputAria: o.inputAria,
      stepAct: o.stepAct,
      stepArgPrefix: o.stepArgPrefix,
      delta: o.delta,
      decAria: o.decAria,
      incAria: o.incAria,
      btnClass: o.btnCls,
      inputClass: o.inpCls,
    }),
  );
}

/** Renderiza la vista de registro manual delegando en `<LogWorkoutView />`. */
export function viewLog(S: State): string {
  if (!S.logDraft) {
    const routines = routineNames(S.settings);
    S.logDraft = initLogDraft(S, routines[0] ?? 'Libre', todayIso());
  }
  return renderToString(h(LogWorkoutView, { state: S }));
}
