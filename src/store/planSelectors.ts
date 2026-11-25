import { effectiveMuscleCredits, musclesOf } from '../lib/analysis';
import { MUSCLES, norm } from '../lib/seed';
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

/** Aportación de un ejercicio de rutina al volumen semanal efectivo de un músculo. */
export interface PlannedMuscleContribution {
  routine: string;
  freq: number;
  exercise: string;
  sets: number;
  factor: number;
  effective: number;
}

/** Elemento de ejercicio con su mapa muscular primario y secundario. */
export interface ExerciseMapItem {
  name: string;
  primary: string;
  secondary: string[];
  secondaryText: string;
}

/** Devuelve la frecuencia semanal configurada para una rutina (`0..7`, por defecto `1`). */
export function routineFreq(settings: Settings, day: string): number {
  const raw = settings.routineMeta?.[day]?.freq;
  return typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.min(7, Math.round(raw))) : 1;
}

/**
 * Calcula las series efectivas semanales planificadas por músculo según `settings.routines` y su frecuencia.
 *
 * @param settings - Configuración del usuario con rutinas, frecuencias y músculos.
 * @returns Mapa músculo -> series semanales ponderadas (1 principal, 0.5 secundario).
 */
export function plannedWeeklyVolume(settings: Settings): Map<string, number> {
  const out = new Map<string, number>(MUSCLES.map((m) => [m, 0]));
  for (const r of routineNames(settings)) {
    const freq = routineFreq(settings, r);
    if (freq <= 0) continue;
    for (const item of settings.routines[r] ?? []) {
      if (!item.name || !(item.sets > 0)) continue;
      const m = musclesOf(item.name, settings);
      if (!m) continue;
      for (const [muscle, factor] of effectiveMuscleCredits(m)) {
        out.set(muscle, (out.get(muscle) ?? 0) + item.sets * factor * freq);
      }
    }
  }
  return out;
}

/**
 * Desglosa por músculo las aportaciones planificadas y detecta ejercicios sin músculo asignado.
 */
export function plannedVolumeBreakdown(settings: Settings): {
  byMuscle: Map<string, PlannedMuscleContribution[]>;
  unmapped: { routine: string; exercise: string }[];
  totalWeeklySessions: number;
  totalPlannedSets: number;
} {
  const byMuscle = new Map<string, PlannedMuscleContribution[]>(MUSCLES.map((m) => [m, []]));
  const unmapped: { routine: string; exercise: string }[] = [];
  let totalWeeklySessions = 0;
  let totalPlannedSets = 0;
  for (const r of routineNames(settings)) {
    const freq = routineFreq(settings, r);
    totalWeeklySessions += freq;
    if (freq <= 0) continue;
    for (const item of settings.routines[r] ?? []) {
      if (!item.name || !(item.sets > 0)) continue;
      totalPlannedSets += item.sets * freq;
      const m = musclesOf(item.name, settings);
      if (!m?.p) {
        unmapped.push({ routine: r, exercise: item.name });
        continue;
      }
      for (const [muscle, factor] of effectiveMuscleCredits(m)) {
        const list = byMuscle.get(muscle);
        if (!list) continue;
        list.push({
          routine: r,
          freq,
          exercise: item.name,
          sets: item.sets,
          factor,
          effective: item.sets * factor * freq,
        });
      }
    }
  }
  return { byMuscle, unmapped, totalWeeklySessions, totalPlannedSets };
}

const MUSCLE_HINTS: ReadonlyArray<[RegExp, string]> = [
  [/\b(peso muerto|rdl|femoral|isquio)\b/, 'Isquios'],
  [/\b(remo|jalon|jalones|dominada|dominadas|pullover|pull over|dorsal|espalda|lumbar|lumbares)\b/, 'Espalda'],
  [/\b(banca|pecho|apertura|aperturas|cruce|flexion|flexiones|peck)\b/, 'Pecho'],
  [/\b(sentadilla|prensa|cuadriceps|zancada|zancadas|bulgara)\b/, 'Cuádriceps'],
  [/\b(hip thrust|gluteo|gluteos|abductor|abductores)\b/, 'Glúteo'],
  [/\b(aductor|aductores|adductores)\b/, 'Aductores'],
  [/\b(gemelo|gemelos|soleo)\b/, 'Gemelos'],
  [/\b(curl|biceps|martillo|predicador|bayesian)\b/, 'Bíceps'],
  [/\b(triceps|frances|fondo|fondos)\b/, 'Tríceps'],
  [/\b(hombro|hombros|militar|lateral|laterales|frontal|frontales|pajaro|pajaros|face pull)\b/, 'Hombros'],
  [/\b(abdom|abdominal|abdominales|crunch|crunches|plancha|rueda)\b/, 'Abdomen'],
];

/** Sugiere el músculo principal probable a partir del nombre del ejercicio (sin imponerlo si no coincide). */
export function suggestPrimaryMuscle(name: string): string | undefined {
  const k = norm(name);
  if (!k) return undefined;
  return MUSCLE_HINTS.find(([re]) => re.test(k))?.[1];
}

function matchesExerciseQuery(name: string, m: ReturnType<typeof musclesOf>, tokens: string[]): boolean {
  if (!tokens.length) return true;
  const hay = normalizeSelectionText([name, m?.p ?? '', ...(m?.s ?? [])].join(' '));
  return tokens.every((t) => hay.includes(t));
}

/**
 * Filtra y ordena ejercicios del catálogo para añadir a una rutina (búsqueda sin tildes y multi-músculo).
 *
 * @param state - Estado global con rutinas y mapa muscular.
 * @param opts - Consulta opcional, grupos musculares filtrados, rutina destino y límite visible.
 * @returns Rutina destino, texto contador y coincidencias ordenadas (primero músculo principal).
 */
export function getPlanCatalogData(
  state: State,
  opts?: { query?: string; muscles?: string[]; routine?: string; candidates?: string[]; limit?: number },
): { targetRoutine: string; countText: string; items: PlanCatalogItem[] } {
  const routines = routineNames(state.settings);
  const preferred = opts?.routine || state.planRoutine;
  const targetRoutine = preferred && routines.includes(preferred) ? preferred : (routines[0] ?? '');
  const names = opts?.candidates ?? allExerciseNames(state);
  const q = normalizeSelectionText(opts?.query ?? '');
  const tokens = q ? q.split(/\s+/) : [];
  const muscleSet = opts?.muscles?.length ? new Set(opts.muscles) : null;
  const matches = names
    .filter((name) => {
      const m = musclesOf(name, state.settings);
      if (muscleSet && !muscleSet.has(m?.p ?? '') && !(m?.s ?? []).some((s) => muscleSet.has(s))) return false;
      return matchesExerciseQuery(name, m, tokens);
    })
    .sort((a, b) => {
      if (muscleSet) {
        const ap = muscleSet.has(musclesOf(a, state.settings)?.p ?? '') ? 0 : 1;
        const bp = muscleSet.has(musclesOf(b, state.settings)?.p ?? '') ? 0 : 1;
        if (ap !== bp) return ap - bp;
      }
      return a.localeCompare(b, 'es');
    });
  const items = matches.slice(0, opts?.limit ?? 60).map((name) => {
    const m = musclesOf(name, state.settings);
    return { name, primary: m?.p, secondary: m?.s ?? [] };
  });
  return { targetRoutine, countText: `${matches.length}/${names.length}`, items };
}

function getExerciseMapCandidates(state: State): string[] {
  const names = allExerciseNames(state);
  if (state.showAllExerciseMap) return names;
  const activeRoutineNames = new Set(Object.values(state.settings.routines).flat().map((i) => i.name).filter(Boolean));
  const customNorms = new Set(Object.values(state.settings.customNames).map((n) => norm(n)).filter(Boolean));
  return names.filter(
    (n) => activeRoutineNames.has(n) || customNorms.has(norm(n)) || state.analysis.exercises.has(n) || !musclesOf(n, state.settings),
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
  const tokens = q ? q.split(/\s+/) : [];
  const counts = new Map<string, number>();
  for (const name of candidates) {
    const m = musclesOf(name, state.settings);
    if (!matchesExerciseQuery(name, m, tokens)) continue;
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
  const tokens = q ? q.split(/\s+/) : [];
  const muscle = state.exerciseMapMuscle ?? '';
  const candidates = getExerciseMapCandidates(state);
  const matches = candidates
    .filter((name) => {
      const m = musclesOf(name, state.settings);
      if (muscle && m?.p !== muscle && !m?.s.includes(muscle)) return false;
      return matchesExerciseQuery(name, m, tokens);
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
