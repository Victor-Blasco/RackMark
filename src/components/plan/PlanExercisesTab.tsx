import { useRef } from 'preact/hooks';
import type { PlanActions } from '../../store/planActions';
import { getExerciseMapData, getExerciseMapFacets } from '../../store/planSelectors';
import { fmtDate, type State } from '../../ui/shared';
import { Icon } from '../common/Icon';
import { PlanExerciseMapList } from './PlanCatalogList';

interface PlanExercisesTabProps {
  /** Estado global con ejercicios, alias y mapa muscular. */
  state: State;
  /** Lista completa de nombres conocidos para sugerencias y fusiones. */
  allNames: string[];
  /** Lista combinada de nombres en historial y biblioteca. */
  knownNames: string[];
  /** Acciones tipadas de edición de ejercicios y músculos. */
  actions: PlanActions;
}

/**
 * Pestaña `Ejercicios y músculos` dentro de Plan: mapeo de importados, fusiones y grupos musculares.
 */
export function PlanExercisesTab({ state, allNames, knownNames, actions }: PlanExercisesTabProps) {
  const unmappedCount = state.analysis.unmapped.length;
  const mapRes = getExerciseMapData(state);
  const facets = getExerciseMapFacets(state);
  const mergeFromRef = useRef<HTMLSelectElement>(null);
  const mergeToRef = useRef<HTMLSelectElement>(null);

  return (
    <>
      {unmappedCount > 0 && (
        <div class="rounded-2xl border border-amberGold/40 bg-amberGold/5 p-4 space-y-2">
          <h3 class="font-bold text-white">Ejercicios importados sin nombre ({unmappedCount})</h3>
          <p class="text-xs text-gray-300">Algunos ejercicios importados solo tienen código numérico. Asígnales nombre (si coincide con uno existente, se unifican).</p>
          <div class="grid grid-cols-1 gap-2 xl:grid-cols-2 xl:gap-x-6">
            {[...state.analysis.unmapped].sort((a, b) => b.last.localeCompare(a.last)).map((u) => (
              <div key={u.ref} class="flex items-center gap-2 text-sm">
                <span class="w-40 shrink-0 tabular-nums text-gray-400">{u.ref} · {u.n}× · {fmtDate(u.last)}</span>
                <input class="inp" list="exnames" placeholder="Nombre del ejercicio…" data-change="refName" data-arg={u.ref} aria-label={`Nombre para ${u.ref}`} onChange={(e) => void actions.assignRefName(u.ref, e.currentTarget.value)} />
              </div>
            ))}
          </div>
          <datalist id="exnames">{allNames.map((n) => <option key={n} value={n} />)}</datalist>
        </div>
      )}

      <div class="pb-5 border-b border-white/10 space-y-3">
        <h3 class="font-bold text-white">Unificar ejercicios duplicados</h3>
        <p class="text-xs text-gray-400">Une el histórico de un ejercicio con otro si cambiaste de máquina o nombre.</p>
        <div class="flex flex-wrap items-center gap-2">
          <select id="mergeFrom" ref={mergeFromRef} class="inp w-auto" aria-label="Ejercicio origen a fusionar">
            <option value="">—</option>
            {knownNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <span aria-hidden="true">→</span>
          <select id="mergeTo" ref={mergeToRef} class="inp w-auto" aria-label="Ejercicio destino">
            <option value="">—</option>
            {knownNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <button type="button" class="btn" data-act="merge" onClick={() => void actions.mergeExercises(mergeFromRef.current?.value ?? '', mergeToRef.current?.value ?? '')}>
            Fusionar
          </button>
        </div>
        {Object.entries(state.settings.aliases).map(([a, b]) => (
          <div key={a} class="flex items-center gap-2 text-xs text-gray-400">
            <span>{a} → {b}</span>
            <button type="button" class="icon-btn text-coralRed hover:bg-coralRed/10" data-act="unmerge" data-arg={a} aria-label={`Deshacer fusión ${a}`} onClick={() => void actions.unmergeExercise(a)}>
              <Icon name="close" className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div class="min-w-0 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="font-bold text-white">Músculos por ejercicio ({allNames.length})</h3>
            <p class="text-xs text-gray-400">Músculo principal = 1 serie efectiva; secundarios (separados por coma) = 0,5 series.</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span id="exercise-map-count" class="text-xs text-gray-400 tabular-nums">{mapRes.countText}</span>
            <button type="button" class="btn-sm" data-act="toggleExerciseMapAll" onClick={actions.toggleExerciseMapAll}>
              {state.showAllExerciseMap ? 'Mostrar solo relevantes' : 'Mostrar catálogo completo'}
            </button>
            <button type="button" class="btn-sm btn-accent" data-act="openExModal" data-arg="" onClick={() => actions.openExerciseModal()}>
              + Nuevo ejercicio
            </button>
          </div>
        </div>

        <div class="sticky top-0 z-10 -mx-1 space-y-2 bg-bgDark px-1 pb-2">
          <div class="flex items-center gap-2">
            <label class="relative min-w-0 flex-1">
              <span class="sr-only">Buscar ejercicio o músculo</span>
              <input id="exerciseMapSearch" class="inp min-w-0 w-full pr-10" type="search" value={state.exerciseMapSearch ?? ''} placeholder="Buscar por nombre o músculo…" aria-label="Buscar ejercicio o músculo" data-input="exerciseMapSearch" onInput={(e) => actions.setExerciseMapSearch(e.currentTarget.value)} />
              {state.exerciseMapSearch && (
                <button type="button" class="icon-btn absolute right-1 top-1/2 -translate-y-1/2" data-act="clearExerciseMapSearch" aria-label="Limpiar búsqueda" onClick={actions.clearExerciseMapSearch}>
                  <Icon name="close" className="h-4 w-4" />
                </button>
              )}
            </label>
          </div>
          {facets.length > 0 && (
            <div class="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filtrar por músculo">
              <button type="button" class={`min-h-[44px] shrink-0 rounded-lg border px-3 text-xs font-semibold transition-colors ${!state.exerciseMapMuscle ? 'border-electricBlue bg-electricBlue/15 text-blue-200' : 'border-white/10 text-gray-400 hover:text-white'}`} data-act="exerciseMapMuscle" data-arg="" onClick={() => actions.setExerciseMapMuscle(undefined)}>
                Todos
              </button>
              {facets.map((f) => (
                <button key={f.name} type="button" class={`min-h-[44px] shrink-0 rounded-lg border px-3 text-xs font-semibold transition-colors ${state.exerciseMapMuscle === f.name ? 'border-electricBlue bg-electricBlue/15 text-blue-200' : 'border-white/10 text-gray-400 hover:text-white'}`} data-act="exerciseMapMuscle" data-arg={f.name} onClick={() => actions.setExerciseMapMuscle(f.name)}>
                  {f.name} <span class="tabular-nums text-[11px]">{f.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div id="exercise-map-results" class="grid grid-cols-1 gap-2.5 xl:grid-cols-2 xl:gap-x-6">
          <PlanExerciseMapList
            items={mapRes.items}
            onChangePrimary={(ex, p) => void actions.changePrimaryMuscle(ex, p)}
            onChangeSecondary={(ex, sec) => void actions.changeSecondaryMuscles(ex, sec)}
          />
        </div>
      </div>
    </>
  );
}
