import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { AiCoachPanel, AiJobStatusBanner } from '../components/home/AiCoachPanel';
import { buildBodyHomeChartConfig, buildHomeExChartConfig } from '../store/homeSelectors';
import type { DayName } from '../types';
import { DayRoutineView } from '../views/DayRoutineView';
import { HomeView } from '../views/HomeView';
import type { State } from './shared';

export { resetCharts, runChartJobs, updateChart, type State } from './shared';
export { resolveName } from '../lib/analysis';
export { norm } from '../lib/seed';
export { buildBodyHomeChartConfig, buildHomeExChartConfig };
export { viewData } from './dataView';
export { viewSettings } from './settingsView';
export { defaultSetsForEx, initLogDraft, viewLog } from './logView';
export { initLiveWorkout, liveExQuickInfo, viewWorkout } from './workoutView';
export { renderModals, renderPlanCatalogResults, viewPlan } from './planView';
export {
  buildCompChartConfig,
  buildPerimChartConfig,
  runCalc,
  viewAdherence,
  viewBody,
  viewCalc,
  viewVolume,
} from './analyticsViews';

/** Renderiza la tira de progreso o error de generación del informe de IA. */
export function renderAiJobStatus(S: State): string {
  return S.aiJob ? renderToString(h(AiJobStatusBanner, { job: S.aiJob })) : '';
}

/** Renderiza la tarjeta completa del informe Coach IA delegando en `<AiCoachPanel />`. */
export function renderAiReport(S: State): string {
  return renderToString(h(AiCoachPanel, { state: S, tone: S.settings.aiTone ?? 'simple' }));
}

/** Renderiza la pestaña principal `Resumen` delegando en `<HomeView />`. */
export function viewHome(S: State): string {
  return renderToString(h(HomeView, { state: S }));
}

/** Renderiza la vista de rutina/día delegando en `<DayRoutineView />`. */
export function viewDay(S: State, day: DayName): string {
  return renderToString(h(DayRoutineView, { state: S, day }));
}
