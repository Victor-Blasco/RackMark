import { ROUTINE_TEMPLATES } from '../lib/seed';
import { routineNames, type State } from '../ui/shared';
import { isRoutineTab } from './navigation';
import type { ConfirmModalOpts } from './types';
import { activeWorkoutWarning } from './workoutLaunchActions';

/** Construye las opciones del diálogo para confirmar el borrado de una rutina si tiene filas o entreno activo. */
export function confirmRemoveRoutineOpts(state: State, name: string): ConfirmModalOpts | null {
  const count = state.settings.routines[name]?.length ?? 0;
  const warn = activeWorkoutWarning(state, [name]);
  if (count === 0 && !warn) return null;
  const base = count > 0
    ? `Contiene ${count} ${count === 1 ? 'ejercicio' : 'ejercicios'} configurados. El historial ya guardado se conservará.`
    : 'El historial ya guardado se conservará.';
  return {
    title: `Eliminar rutina "${name}"`,
    message: warn ? `${base} ${warn}` : base,
    confirmLabel: 'Eliminar rutina',
    danger: true,
  };
}

/** Construye las opciones del diálogo para confirmar la aplicación de una plantilla. */
export function confirmTemplateOpts(state: State, key: string): ConfirmModalOpts | null {
  const tpl = ROUTINE_TEMPLATES[key];
  if (!tpl) return null;
  const removed = routineNames(state.settings).filter((n) => !tpl.routines[n]);
  const warn = activeWorkoutWarning(state, removed);
  return {
    title: `Aplicar plantilla "${tpl.label}"`,
    message: warn
      ? `Reemplazará la distribución actual de rutinas y objetivos. ${warn}`
      : 'Reemplazará la distribución actual de rutinas y objetivos.',
    confirmLabel: 'Aplicar plantilla',
  };
}

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
  if (state.sel.home && !state.settings.routines[state.sel.home]) {
    const { home: _home, ...restSel } = state.sel;
    state.sel = restSel;
  }
  syncWorkoutRoutineNames();
  return tpl.label;
}
