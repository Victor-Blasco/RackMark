import { musclesOf } from '../lib/analysis';
import { MUSCLES } from '../lib/seed';
import type { Settings } from '../types';
import { normalizeSelectionText } from '../ui/selection';
import { routineNames, type State } from '../ui/shared';
import { allExerciseNames } from './exerciseCatalog';

/** Elemento del catálogo rápido mostrado en la barra lateral de Plan. */
export interface PlanCatalogItem {
  name: string;
  primary?: string;
  secondary: string[];
}

/** Elemento de ejercicio con su mapa muscular primario y secundario. */
export interface ExerciseMapItem {
  name: string;
  primary: string;
  secondary: string[];
  secondaryText: string;
}

/**
 * Calcula las series efectivas semanales planificadas por músculo según `settings.routines`.
 *
 * @param settings - Configuración del usuario con rutinas y músculos.
 * @returns Mapa músculo -> series semanales ponderadas (1 principal, 0.5 secundario).
 */
export function plannedWeeklyVolume(settings: Settings): Map<string, number> {
  const out = new Map<string, number>(MUSCLES.map((m) => [m, 0]));
  for (const r of routineNames(settings)) {
    for (const item of settings.routines[r] ?? []) {
      if (!item.name || !(item.sets > 0)) continue;
      const m = musclesOf(item.name, settings);
      if (!m) continue;
      out.set(m.p, (out.get(m.p) ?? 0) + item.sets);
      for (const sec of m.s) {
        out.set(sec, (out.get(sec) ?? 0) + item.sets * 0.5);
      }
    }
  }
  return out;
}

/**
 * Filtra y prepara el catálogo rápido de ejercicios para añadir a la rutina destino.
 *
 * @param state - Estado global con consulta `planSearch` y rutina destino.
 * @returns Rutina destino, texto contador y hasta 12 coincidencias.
 */
export function getPlanCatalogData(state: State): { targetRoutine: string; countText: string; items: PlanCatalogItem[] } {
  const routines = routineNames(state.settings);
  const targetRoutine =
    state.planTargetRoutine && routines.includes(state.planTargetRoutine)
      ? state.planTargetRoutine
      : (routines[0] ?? '');
  const names = allExerciseNames(state);
  const q = (state.planSearch ?? '').trim().toLowerCase();
  const matches = names.filter((n) => {
    if (!q) return true;
    if (n.toLowerCase().includes(q)) return true;
    const m = musclesOf(n, state.settings);
    return m ? m.p.toLowerCase().includes(q) || m.s.some((sec) => sec.toLowerCase().includes(q)) : false;
  });
  const items: PlanCatalogItem[] = matches.slice(0, 12).map((name) => {
    const m = musclesOf(name, state.settings);
    return { name, primary: m?.p, secondary: m?.s ?? [] };
  });
  return {
    targetRoutine,
    countText: `${matches.length}/${names.length}`,
    items,
  };
}

function getExerciseMapCandidates(state: State): string[] {
  const names = allExerciseNames(state);
  if (state.showAllExerciseMap) return names;
  const activeRoutineNames = new Set(
    Object.values(state.settings.routines)
      .flat()
      .map((item) => item.name)
      .filter(Boolean),
  );
  return names.filter(
    (name) => activeRoutineNames.has(name) || state.analysis.exercises.has(name) || !musclesOf(name, state.settings),
  );
}

/**
 * Calcula facetas musculares disponibles para filtrar el mapa de ejercicios.
 *
 * @param state - Estado global con búsqueda actual.
 * @returns Lista ordenada de grupos musculares y conteo de ejercicios.
 */
export function getExerciseMapFacets(state: State): Array<{ name: string; count: number }> {
  const candidates = getExerciseMapCandidates(state);
  const q = normalizeSelectionText(state.exerciseMapSearch ?? '');
  const counts = new Map<string, number>();
  for (const name of candidates) {
    const m = musclesOf(name, state.settings);
    const haystack = normalizeSelectionText([name, m?.p ?? '', ...(m?.s ?? [])].join(' '));
    if (q && !q.split(/\s+/).every((token) => haystack.includes(token))) continue;
    for (const group of new Set([m?.p ?? '', ...(m?.s ?? [])].filter(Boolean))) {
      counts.set(group, (counts.get(group) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
    .map(([name, count]) => ({ name, count }));
}

/**
 * Prepara la lista filtrada de ejercicios y sus músculos asignados (máximo 60 visibles).
 *
 * @param state - Estado global de la aplicación.
 * @returns Contador descriptivo y lista de ejercicios listos para editar.
 */
export function getExerciseMapData(state: State): { countText: string; items: ExerciseMapItem[] } {
  const names = allExerciseNames(state);
  const q = normalizeSelectionText(state.exerciseMapSearch ?? '');
  const muscle = state.exerciseMapMuscle ?? '';
  const candidates = getExerciseMapCandidates(state);
  const matches = candidates
    .filter((name) => {
      const m = musclesOf(name, state.settings);
      if (muscle && m?.p !== muscle && !m?.s.includes(muscle)) return false;
      if (!q) return true;
      const haystack = normalizeSelectionText([name, m?.p ?? '', ...(m?.s ?? [])].join(' '));
      return q.split(/\s+/).every((token) => haystack.includes(token));
    })
    .sort((a, b) => {
      const aMapped = musclesOf(a, state.settings)?.p ? 1 : 0;
      const bMapped = musclesOf(b, state.settings)?.p ? 1 : 0;
      return bMapped - aMapped || a.localeCompare(b, 'es');
    });

  const items: ExerciseMapItem[] = matches.slice(0, 60).map((name) => {
    const m = musclesOf(name, state.settings);
    const secondary = m?.s ?? [];
    return { name, primary: m?.p ?? '', secondary, secondaryText: secondary.join(', ') };
  });
  return {
    countText: `${Math.min(matches.length, 60)}/${matches.length} visibles · ${names.length} totales`,
    items,
  };
}
