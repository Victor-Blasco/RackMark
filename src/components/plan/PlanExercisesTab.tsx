import type { PlanActions } from '../../store/planActions';
import { getExerciseMapData, getExerciseMapFacets } from '../../store/planSelectors';
import { fmtDate, type State } from '../../ui/shared';
import { SearchInput } from '../common/SearchInput';
import { PlanExerciseMapList } from './PlanExerciseMapList';
import { PlanMergeSection } from './PlanMergeSection';

interface PlanExercisesTabProps {
  /** Estado global con ejercicios, alias y mapa muscular. */
  state: State;
  /** Lista completa de nombres conocidos para contador del catálogo. */
  allNames: string[];
  /** Acciones tipadas de edición de ejercicios y músculos. */
  actions: PlanActions;
}

/**
 * Pestaña `Ejercicios y músculos` dentro de Plan: mapeo de importados, fusiones y grupos musculares.
 */
export function PlanExercisesTab({ state, allNames, actions }: PlanExercisesTabProps) {
  const unmappedCount = state.analysis.unmapped.length;
  const hiddenCount = state.settings.hiddenExercises?.length ?? 0;
  const mapRes = getExerciseMapData(state);
  const facets = getExerciseMapFacets(state);

  return (
    <>
      {unmappedCount > 0 && (
        <div class="rounded-2xl border border-amberGold/40 bg-amberGold/5 p-4 space-y-2">
          <h2 class="font-bold text-white tabular-nums">Ejercicios importados sin nombre ({unmappedCount})</h2>
          <p class="text-xs text-gray-300">Algunos ejercicios importados solo tienen código numérico. Asígnales nombre (si coincide con uno existente, se unifican).</p>
          <div class="grid grid-cols-1 gap-2 xl:grid-cols-2 xl:gap-x-6">
            {[...state.analysis.unmapped].sort((a, b) => b.last.localeCompare(a.last)).map((u) => (
              <div key={u.ref} class="flex items-center gap-2 text-sm">
                <span class="w-40 shrink-0 tabular-nums text-gray-400">{u.ref} · {u.n}× · {fmtDate(u.last)}</span>
                <input class="inp" list="exnames" enterKeyHint="done" placeholder="Nombre del ejercicio…" aria-label={`Nombre para ${u.ref}`} onChange={(e) => void actions.assignRefName(u.ref, e.currentTarget.value)} />
              </div>
            ))}
          </div>
          <datalist id="exnames">{allNames.map((n) => <option key={n} value={n} />)}</datalist>
        </div>
      )}

      <PlanMergeSection
        mergeFrom={state.mergeFrom ?? ''}
        mergeTo={state.mergeTo ?? ''}
        aliases={state.settings.aliases}
        onOpenPicker={actions.openMergeExercisePicker}
        onMerge={(from, to) => void actions.mergeExercises(from, to)}
        onUnmerge={(a) => void actions.unmergeExercise(a)}
      />

      <div class="min-w-0 space-y-3">
        <div class="space-y-2">
          <div>
            <h2 class="font-bold text-white tabular-nums">Músculos por ejercicio ({allNames.length})</h2>
            <p class="text-xs text-gray-400">Toca un ejercicio para elegir su músculo principal (1 serie) y secundarios (0,5 series c/u).</p>
          </div>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span id="exercise-map-count" aria-live="polite" class="text-xs text-gray-400 tabular-nums">{mapRes.countText}</span>
            <div class="flex flex-wrap items-center gap-2">
              {hiddenCount > 0 && (
                <button type="button" class="btn-sm" onClick={() => void actions.restoreDefaultExercises()}>
                  Restaurar predeterminados ({hiddenCount})
                </button>
              )}
              <button type="button" class="btn-sm" onClick={actions.toggleExerciseMapAll}>
                {state.showAllExerciseMap ? 'Solo en uso' : 'Ver catálogo completo'}
              </button>
              <button type="button" class="btn-sm btn-accent" onClick={() => actions.openExerciseModal()}>
                + Nuevo ejercicio
              </button>
            </div>
          </div>
        </div>

        <div class="lg:sticky lg:top-0 lg:z-10 -mx-1 space-y-2 bg-bgDark px-1 pb-2">
          <div class="flex items-center gap-2">
            <SearchInput
              id="exerciseMapSearch"
              value={state.exerciseMapSearch ?? ''}
              placeholder="Buscar por nombre o músculo…"
              ariaLabel="Buscar ejercicio o músculo"
              inputClass="inp min-w-0 w-full pr-10"
              onInput={actions.setExerciseMapSearch}
              onClear={actions.clearExerciseMapSearch}
            />
          </div>
          {facets.length > 0 && (
            <div class="flex gap-1.5 overflow-x-auto no-scrollbar sm:flex-wrap pb-1" role="group" aria-label="Filtrar por músculo">
              <button type="button" aria-pressed={!state.exerciseMapMuscle ? 'true' : 'false'} class={`min-h-[44px] sm:min-h-[34px] shrink-0 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${!state.exerciseMapMuscle ? 'border-electricBlue bg-electricBlue/15 text-blue-200' : 'border-white/10 text-gray-400 hover:text-white'}`} onClick={() => actions.setExerciseMapMuscle(undefined)}>
                Todos
              </button>
              {facets.map((f) => (
                <button key={f.name} type="button" aria-pressed={state.exerciseMapMuscle === f.name ? 'true' : 'false'} class={`min-h-[44px] sm:min-h-[34px] shrink-0 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${state.exerciseMapMuscle === f.name ? 'border-electricBlue bg-electricBlue/15 text-blue-200' : 'border-white/10 text-gray-400 hover:text-white'}`} onClick={() => actions.setExerciseMapMuscle(f.name)}>
                  {f.name} <span class="tabular-nums text-[11px]">{f.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div id="exercise-map-results">
          <PlanExerciseMapList
            items={mapRes.items}
            onRename={(oldName, newName) => actions.renameExercise(oldName, newName)}
            onDelete={(ex) => actions.deleteExercise(ex)}
            onChangePrimary={(ex, p) => void actions.changePrimaryMuscle(ex, p)}
            onToggleSecondary={(ex, sec) => void actions.toggleSecondaryMuscle(ex, sec)}
          />
        </div>
      </div>
    </>
  );
}
