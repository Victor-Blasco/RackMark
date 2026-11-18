import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { SettingsView } from '../views/SettingsView';
import type { State } from './shared';

/** Renderiza la vista de cuenta y ajustes delegando en `<SettingsView />`. */
export function viewSettings(S: State): string {
  return renderToString(h(SettingsView, { state: S }));
}
