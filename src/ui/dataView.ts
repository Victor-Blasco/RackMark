import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { DataView } from '../views/DataView';
import type { State } from './shared';

/** Renderiza la vista de datos e importación delegando en `<DataView />`. */
export function viewData(S: State): string {
  return renderToString(h(DataView, { state: S }));
}
