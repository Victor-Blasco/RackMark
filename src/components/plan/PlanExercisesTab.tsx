import type { PlanActions } from '../../store/planActions';
import { getExerciseMapData, getExerciseMapFacets } from '../../store/planSelectors';
import { fmtDate, type State } from '../../ui/shared';
import { Icon } from '../common/Icon';
import { PlanExerciseMapList } from './PlanExerciseMapList';

interface PlanExercisesTabProps {
  /** Estado global con ejercicios, alias y mapa muscular. */
  state: State;
  /** Lista completa de nombres conocidos para contador del catálogo. */
  allNames: string[];
  /** Lista combinada opcional (conservada por compatibilidad). */
  knownNames?: string[];
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
  const mergeFrom = state.mergeFrom ?? '';
  const mergeTo = state.mergeTo ?? '';

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

      <div class="pb-5 border-b border-white/10 space-y-3">
        <h2 class="font-bold text-white">Unificar ejercicios duplicados</h2>
        <p class="text-xs text-gray-400">Une el histórico de un ejercicio con otro si cambiaste de máquina o nombre.</p>
        <div class="flex flex-wrap items-center gap-2">
          <button
            id="mergeFrom"
            type="button"
            class="inp inline-flex w-full sm:w-auto sm:min-w-[210px] max-w-full items-center justify-between gap-2 text-left"
            aria-label={`Ejercicio origen a fusionar${mergeFrom ? `: ${mergeFrom}` : ''}`}
            onClick={() => actions.openMergeExercisePicker('from')}
          >
            <span class={`truncate ${mergeFrom ? 'font-semibold text-white' : 'text-gray-400'}`}>
              {mergeFrom || 'Duplicado a eliminar…'}
            </span>
            <Icon name="caretDown" className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          </button>
          <span aria-hidden="true" class="text-gray-400">→</span>
          <button
            id="mergeTo"
            type="button"
            class="inp inline-flex w-full sm:w-auto sm:min-w-[210px] max-w-full items-center justify-between gap-2 text-left"
            aria-label={`Ejercicio destino${mergeTo ? `: ${mergeTo}` : ''}`}
            onClick={() => actions.openMergeExercisePicker('to')}
          >
            <span class={`truncate ${mergeTo ? 'font-semibold text-white' : 'text-gray-400'}`}>
              {mergeTo || 'Ejercicio que se conserva…'}
            </span>
            <Icon name="caretDown" className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          </button>
          <button
            type="button"
            class="btn"
            disabled={!mergeFrom || !mergeTo || mergeFrom === mergeTo}
            onClick={() => void actions.mergeExercises(mergeFrom, mergeTo)}
          >
            Fusionar
          </button>
        </div>
        {mergeFrom && mergeTo && mergeFrom !== mergeTo && (
          <p class="text-xs text-gray-300">
            Todo el historial de <b class="text-white">{mergeFrom}</b> pasará a <b class="text-white">{mergeTo}</b> y{' '}
            <b class="text-coralRed">{mergeFrom}</b> se eliminará.
          </p>
        )}
        {Object.entries(state.settings.aliases).map(([a, b]) => (
          <div key={a} class="flex items-center gap-2 text-xs text-gray-400">
            <span>{a} → {b}</span>
            <button type="button" class="icon-btn text-coralRed hover:bg-coralRed/10" aria-label={`Deshacer fusión ${a}`} onClick={() => void actions.unmergeExercise(a)}>
              <Icon name="close" className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

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
            <label class="relative min-w-0 flex-1">
              <span class="sr-only">Buscar ejercicio o músculo</span>
              <input id="exerciseMapSearch" class="inp min-w-0 w-full pr-10" type="search" enterKeyHint="search" value={state.exerciseMapSearch ?? ''} placeholder="Buscar por nombre o músculo…" aria-label="Buscar ejercicio o músculo" onInput={(e) => actions.setExerciseMapSearch(e.currentTarget.value)} />
              {state.exerciseMapSearch && (
                <button type="button" class="icon-btn absolute right-1 top-1/2 -translate-y-1/2" aria-label="Limpiar búsqueda" onClick={actions.clearExerciseMapSearch}>
                  <Icon name="close" className="h-4 w-4" />
                </button>
              )}
            </label>
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
