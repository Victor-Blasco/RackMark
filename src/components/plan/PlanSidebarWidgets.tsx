import { MUSCLES } from '../../lib/seed';
import { getPlanCatalogData, plannedWeeklyVolume } from '../../store/planSelectors';
import { routineNames, type State } from '../../ui/shared';
import { PlanCatalogList } from './PlanCatalogList';

interface PlanSidebarWidgetsProps {
  /** Estado global con rutinas, músculos y búsqueda del catálogo. */
  state: State;
  /** Cambia la rutina destino de inserción rápida. */
  onChangeTargetRoutine: (routine: string) => void;
  /** Filtra el catálogo rápido en tiempo real. */
  onSearchChange: (query: string) => void;
  /** Añade un ejercicio del catálogo rápido a la rutina destino. */
  onQuickAdd: (routine: string, name: string) => void;
  /** Abre el modal de creación de ejercicio nuevo. */
  onOpenNewExercise: (targetRoutine: string) => void;
}

/**
 * Barra lateral derecha de `Plan y rutinas`: simulador de volumen semanal y catálogo rápido.
 */
export function PlanSidebarWidgets({
  state,
  onChangeTargetRoutine,
  onSearchChange,
  onQuickAdd,
  onOpenNewExercise,
}: PlanSidebarWidgetsProps) {
  const s = state.settings;
  const routines = routineNames(s);
  const volMap = plannedWeeklyVolume(s);
  const totalPlannedSets = routines.reduce(
    (acc, d) => acc + (s.routines[d] ?? []).reduce((sum, item) => sum + (item.name ? item.sets : 0), 0),
    0,
  );
  const catalog = getPlanCatalogData(state);

  return (
    <aside class="lg:col-span-4 lg:sticky lg:top-6 space-y-5">
      <div class="rounded-2xl border border-white/10 bg-cardDark p-4 space-y-3">
        <div class="flex items-baseline justify-between gap-2">
          <h3 class="text-sm font-bold text-white">Simulador de volumen semanal</h3>
          <span class="tabular-nums text-xs font-semibold text-gray-400">
            {totalPlannedSets} {totalPlannedSets === 1 ? 'serie' : 'series'}
          </span>
        </div>
        <p class="text-[11px] text-gray-400">
          Principal = 1, secundario = 0,5 · <span class="text-coralRed">↓ &lt;8</span> · <span class="text-emeraldGreen">✓ 8–20</span> · <span class="text-amberGold">↑ &gt;20</span>
        </p>
        <div class="space-y-1.5">
          {MUSCLES.map((m) => {
            const v = volMap.get(m) ?? 0;
            const labelV = v % 1 === 0 ? String(v) : v.toFixed(1).replace('.', ',');
            const textCol = v === 0 ? 'text-gray-400' : v < 8 ? 'text-coralRed' : v <= 20 ? 'text-emeraldGreen' : 'text-amberGold';
            const barCol = v === 0 ? 'bg-white/10' : v < 8 ? 'bg-coralRed' : v <= 20 ? 'bg-emeraldGreen' : 'bg-amberGold';
            const cue = v === 0 ? '' : v < 8 ? '↓ ' : v <= 20 ? '✓ ' : '↑ ';
            const srLabel = v === 0 ? ' sin series' : v < 8 ? ' volumen bajo' : v <= 20 ? ' volumen óptimo' : ' volumen alto';
            const pct = Math.min(100, Math.round((v / 22) * 100));
            return (
              <div key={m} class="grid grid-cols-[96px_1fr_54px] items-center gap-2 text-xs">
                <span class="truncate text-gray-200">{m}</span>
                <div class="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <div class={`h-full rounded-full ${barCol}`} style={{ width: `${pct}%` }} />
                </div>
                <span class={`text-right tabular-nums font-bold ${textCol}`}>
                  {cue}{labelV}<span class="sr-only">{srLabel}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div class="rounded-2xl border border-white/10 bg-cardDark p-4 space-y-3">
        <div class="flex items-baseline justify-between gap-2">
          <h3 class="text-sm font-bold text-white">Catálogo rápido</h3>
          <span id="planCatalogCount" aria-live="polite" class="tabular-nums text-xs text-gray-400">{catalog.countText}</span>
        </div>
        <label class="block">
          <span class="lbl">Rutina destino</span>
          <select class="inp" aria-label="Rutina destino" value={catalog.targetRoutine} onChange={(e) => onChangeTargetRoutine(e.currentTarget.value)}>
            {routines.map((d) => <option key={d} value={d} selected={d === catalog.targetRoutine}>{d}</option>)}
          </select>
        </label>
        <label class="block">
          <span class="lbl">Buscar ejercicio o músculo</span>
          <input id="planExSearch" type="search" enterKeyHint="search" class="inp" value={state.planSearch ?? ''} placeholder="Ej. Press, Espalda, Bíceps…" aria-label="Buscar ejercicio o músculo" onInput={(e) => onSearchChange(e.currentTarget.value)} />
        </label>
        <div id="planCatalogList" class="max-h-72 overflow-y-auto divide-y divide-white/[0.06]">
          <PlanCatalogList
            items={catalog.items}
            targetRoutine={catalog.targetRoutine}
            searchQuery={state.planSearch ?? ''}
            onQuickAdd={onQuickAdd}
          />
        </div>
        <button type="button" class="btn-sm btn-accent w-full justify-center" onClick={() => onOpenNewExercise(catalog.targetRoutine)}>
          + Crear nuevo ejercicio
        </button>
      </div>
    </aside>
  );
}
