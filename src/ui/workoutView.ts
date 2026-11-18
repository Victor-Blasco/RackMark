import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { initLiveWorkout, liveExQuickInfo } from '../store/workoutSelectors';
import { LiveWorkoutView } from '../views/LiveWorkoutView';
import type { State } from './shared';

export { initLiveWorkout, liveExQuickInfo };

/**
 * Renderiza la vista simplificada de entrenamiento en vivo delegando en `<LiveWorkoutView />`.
 *
 * @param S - Estado global de la aplicación.
 * @returns Cadena HTML renderizada de la vista `En vivo`.
 */
export function viewWorkout(S: State): string {
  return renderToString(h(LiveWorkoutView, { state: S }));
}
