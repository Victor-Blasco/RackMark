import { ROUTINE_TEMPLATES } from '../lib/seed';
import { routineNames, type State } from '../ui/shared';
import { isRoutineTab } from './navigation';

/**
 * Aplica una plantilla predefinida sobre `state.settings` actualizando rutinas y metadatos.
 *
 * @param state - Estado global actual.
 * @param tplKey - Clave de plantilla dentro de `ROUTINE_TEMPLATES`.
 * @param getLastRoutine - Lee la última rutina visitada en móvil.
 * @param setLastRoutine - Actualiza la última rutina visitada si fue eliminada.
 * @param syncWorkoutRoutineNames - Sincroniza borradores activos con el nuevo esquema.
 * @returns Etiqueta de la plantilla aplicada o `undefined` si no existe.
 */
export function applyRoutineTemplateToState(
  state: State,
  tplKey: string,
  getLastRoutine: () => string,
  setLastRoutine: (day: string) => void,
  syncWorkoutRoutineNames: (oldName?: string, newName?: string) => void,
): string | undefined {
  const tpl = ROUTINE_TEMPLATES[tplKey];
  if (!tpl) return undefined;
  state.settings = {
    ...state.settings,
    routines: structuredClone(tpl.routines),
    routineMeta: structuredClone(tpl.meta),
  };
  const remaining = routineNames(state.settings);
  if (!isRoutineTab(state, getLastRoutine())) setLastRoutine(remaining[0] ?? 'Push');
  state.planRoutine = remaining[0];
  state.planTargetRoutine = remaining[0];
  if (state.sel.home && !state.settings.routines[state.sel.home]) {
    const { home: _home, ...restSel } = state.sel;
    state.sel = restSel;
  }
  syncWorkoutRoutineNames();
  return tpl.label;
}
