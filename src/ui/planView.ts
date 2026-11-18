import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { ModalHost } from '../components/modals/ModalHost';
import { PlanCatalogList, PlanExerciseMapList } from '../components/plan/PlanCatalogList';
import { getExerciseMapData, getPlanCatalogData, plannedWeeklyVolume } from '../store/planSelectors';
import { PlanView } from '../views/PlanView';
import type { State } from './shared';

export { plannedWeeklyVolume };

/** Renderiza todos los modales globales declarativos delegando en `<ModalHost />`. */
export function renderModals(S: State): string {
  return renderToString(h(ModalHost, { state: S }));
}

/** Genera contador y listado filtrado del catálogo rápido en Plan delegando en `<PlanCatalogList />`. */
export function renderPlanCatalogResults(S: State): { countText: string; listHtml: string } {
  const data = getPlanCatalogData(S);
  return {
    countText: data.countText,
    listHtml: renderToString(
      h(PlanCatalogList, {
        items: data.items,
        targetRoutine: data.targetRoutine,
        searchQuery: S.planSearch ?? '',
      }),
    ),
  };
}

/** Genera contador y filas del editor de mapa muscular delegando en `<PlanExerciseMapList />`. */
export function renderPlanExerciseMapResults(S: State): { countText: string; listHtml: string } {
  const data = getExerciseMapData(S);
  return {
    countText: data.countText,
    listHtml: renderToString(h(PlanExerciseMapList, { items: data.items })),
  };
}

/** Renderiza la vista de planificación de rutinas, fases y catálogo delegando en `<PlanView />`. */
export function viewPlan(S: State): string {
  return renderToString(h(PlanView, { state: S }));
}
