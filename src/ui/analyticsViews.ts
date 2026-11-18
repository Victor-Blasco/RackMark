import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { buildCompChartConfig, buildPerimChartConfig } from '../store/bodySelectors';
import { AdherenceView } from '../views/AdherenceView';
import { BodyView } from '../views/BodyView';
import { CalcView } from '../views/CalcView';
import { VolumeView } from '../views/VolumeView';
import type { State } from './shared';

export { buildCompChartConfig, buildPerimChartConfig };

/** Renderiza la vista de medidas antropométricas delegando en `<BodyView />`. */
export function viewBody(S: State): string {
  return renderToString(h(BodyView, { state: S }));
}

/** Renderiza la matriz de volumen semanal delegando en `<VolumeView />`. */
export function viewVolume(S: State): string {
  return renderToString(h(VolumeView, { state: S }));
}

/** Renderiza la vista de adherencia y bienestar delegando en `<AdherenceView />`. */
export function viewAdherence(S: State): string {
  return renderToString(h(AdherenceView, { state: S }));
}

/** Renderiza la vista de calculadoras delegando en `<CalcView />`. */
export function viewCalc(S: State): string {
  return renderToString(h(CalcView, { state: S }));
}

/** No-op legado conservado hasta la limpieza de `ui/views.ts` en el Bloque D; `<CalcView />` calcula declarativamente. */
export function runCalc(): void {}
