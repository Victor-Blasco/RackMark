import { useState } from 'preact/hooks';
import { MUSCLES } from '../../lib/seed';
import { getPlanCatalogData } from '../../store/planSelectors';
import type { State } from '../../ui/shared';
import { Icon } from '../common/Icon';
import { ModalShell } from '../common/ModalShell';
import { SearchInput } from '../common/SearchInput';
import { PlanCatalogList } from '../plan/PlanCatalogList';

interface AddRoutineExerciseModalProps {
  state: State; /** Estado global con catálogo, rutinas y mapa muscular. */
  routine: string; /** Rutina o ámbito destino seleccionado. */
  title?: string; /** Título personalizado del modal. */
  countLabel?: string; /** Subtítulo contador personalizado. */
  candidates?: string[]; /** Subconjunto opcional de ejercicios filtrables. */
  existingNames?: string[]; /** Nombres ya seleccionados si difieren de `settings.routines`. */
  addLabel?: string; /** Etiqueta positiva (`+ Añadir` / `Elegir`). */
  addedLabel?: string; /** Etiqueta de estado presente (`Añadido` / `Actual`). */
  onAdd: (routine: string, name: string) => void | Promise<void>;
  onRemove?: (routine: string, name: string) => void | Promise<void>;
  onCreateExercise?: (routine: string, initialName?: string) => void;
  onClose: () => void;
}

/** Modal buscador multi-músculo para añadir o elegir ejercicios del catálogo. */
export function AddRoutineExerciseModal({
  state, routine, title, countLabel, candidates, existingNames, addLabel, addedLabel, onAdd, onRemove, onCreateExercise, onClose,
}: AddRoutineExerciseModalProps) {
  const [query, setQuery] = useState('');
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);

  const toggleMuscle = (m: string) =>
    setSelectedMuscles((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  const sourceNames = existingNames ?? (state.settings.routines[routine] ?? []).map((r) => r.name);
  const existingCounts = new Map<string, number>();
  for (const name of sourceNames) {
    if (name) existingCounts.set(name, (existingCounts.get(name) ?? 0) + 1);
  }
  const catalog = getPlanCatalogData(state, { query, muscles: selectedMuscles, routine, candidates, limit: 80 });
  const hasFilters = Boolean(query.trim() || selectedMuscles.length);

  return (
    <ModalShell
      id="add-routine-ex-modal"
      labelledBy="addRoutineExTitle"
      wrapperClass="p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-4"
      panelClass="max-w-xl border-white/10 flex flex-col overflow-hidden max-h-[82dvh] sm:max-h-[85dvh]"
      onClose={onClose}
    >
      <div class="shrink-0 space-y-3 border-b border-white/10 px-4 pt-4 pb-3 sm:px-5">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h3 id="addRoutineExTitle" class="text-base font-extrabold text-white truncate">{title ?? `Añadir ejercicio a ${routine}`}</h3>
            <p class="text-xs text-gray-400">
              <span class="tabular-nums">{countLabel ?? `${sourceNames.length} ${sourceNames.length === 1 ? 'ejercicio' : 'ejercicios'} en rutina`}</span>
              {' · '}
              <span id="planCatalogCount" aria-live="polite" class="tabular-nums">{catalog.countText}</span>
            </p>
          </div>
          <button type="button" aria-label="Cerrar modal" class="icon-btn" onClick={onClose}>
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        <SearchInput
          id="planExSearch"
          value={query}
          placeholder="Buscar ejercicio o músculo (ej. press, biceps)…"
          ariaLabel="Buscar ejercicio o músculo"
          clearBtnClass="icon-btn absolute right-1 top-1/2 -translate-y-1/2 sm:h-9 sm:w-9"
          clearIconClass="h-3.5 w-3.5"
          onInput={setQuery}
          onClear={() => setQuery('')}
        />

        <div role="group" aria-label="Filtrar por grupos musculares" class="flex gap-1.5 overflow-x-auto no-scrollbar sm:flex-wrap">
          <button
            type="button"
            aria-pressed={selectedMuscles.length === 0}
            class={`min-h-[44px] sm:min-h-[32px] shrink-0 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${selectedMuscles.length === 0 ? 'border-electricBlue bg-electricBlue/20 text-blue-200' : 'border-white/10 bg-gray-900/70 text-gray-400 hover:text-white'}`}
            onClick={() => setSelectedMuscles([])}
          >
            Todos
          </button>
          {MUSCLES.map((m) => {
            const active = selectedMuscles.includes(m);
            return (
              <button
                key={m}
                type="button"
                aria-pressed={active}
                class={`min-h-[44px] sm:min-h-[32px] shrink-0 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${active ? 'border-electricBlue bg-electricBlue/20 text-blue-200' : 'border-white/10 bg-gray-900/70 text-gray-300 hover:border-white/25'}`}
                onClick={() => toggleMuscle(m)}
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>

      <div id="planCatalogList" class="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 divide-y divide-white/[0.06]">
        <PlanCatalogList
          items={catalog.items}
          targetRoutine={routine}
          searchQuery={query}
          existingCounts={existingCounts}
          hasActiveFilters={hasFilters}
          onClearFilters={() => { setQuery(''); setSelectedMuscles([]); }}
          onCreateExercise={onCreateExercise ? () => onCreateExercise(routine, query.trim() || undefined) : undefined}
          addLabel={addLabel}
          addedLabel={addedLabel}
          onQuickAdd={(r, name) => void onAdd(r, name)}
          onQuickRemove={onRemove ? (r, name) => void onRemove(r, name) : undefined}
        />
      </div>

      <div class="shrink-0 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-modalDark px-4 py-3.5 sm:px-5">
        {onCreateExercise && (
          <div class="flex flex-wrap items-center gap-2">
            <span class="hidden sm:inline text-xs text-gray-400">¿No encuentras el ejercicio?</span>
            <button type="button" class="btn-sm btn-accent" onClick={() => onCreateExercise(routine, query.trim() || undefined)}>+ Crear ejercicio</button>
          </div>
        )}
        <button type="button" class="btn-sm ml-auto shrink-0" onClick={onClose}>Listo</button>
      </div>
    </ModalShell>
  );
}
