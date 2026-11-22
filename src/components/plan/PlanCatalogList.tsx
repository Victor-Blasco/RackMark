import type { PlanCatalogItem } from '../../store/planSelectors';

export { PlanExerciseMapList } from './PlanExerciseMapList';

interface PlanCatalogListProps {
  /** Lista filtrada del catálogo de ejercicios. */
  items: PlanCatalogItem[];
  /** Rutina destino seleccionada para añadir en un toque. */
  targetRoutine: string;
  /** Texto buscado cuando no hay coincidencias. */
  searchQuery: string;
  /** Mapa ejercicio -> número de veces ya incluido en la rutina destino. */
  existingCounts?: Map<string, number>;
  /** Indica si hay texto o músculos filtrados en curso. */
  hasActiveFilters?: boolean;
  /** Limpia búsqueda y filtros activos. */
  onClearFilters?: () => void;
  /** Abre el modal de creación de ejercicio nuevo. */
  onCreateExercise?: () => void;
  /** Etiqueta del botón de acción positiva (`+ Añadir` por defecto). */
  addLabel?: string;
  /** Etiqueta del estado ya presente (`Añadido` por defecto). */
  addedLabel?: string;
  /** Añade un ejercicio a la rutina destino. */
  onQuickAdd?: (routine: string, name: string) => void;
  /** Quita un ejercicio ya incluido en la rutina destino. */
  onQuickRemove?: (routine: string, name: string) => void;
}

/** Lista filtrada del catálogo en Plan para añadir o quitar ejercicios en un clic. */
export function PlanCatalogList({
  items, targetRoutine, searchQuery, existingCounts, hasActiveFilters, onClearFilters, onCreateExercise, addLabel = '+ Añadir', addedLabel = 'Añadido', onQuickAdd, onQuickRemove,
}: PlanCatalogListProps) {
  const q = searchQuery.trim();
  if (!items.length) {
    return (
      <div class="py-6 text-center space-y-3">
        <p class="text-xs text-gray-400">
          {q ? `Sin resultados para «${q}».` : 'Sin resultados para los filtros seleccionados.'}
        </p>
        {(hasActiveFilters || onCreateExercise) && (
          <div class="flex flex-wrap items-center justify-center gap-2">
            {hasActiveFilters && onClearFilters && (
              <button type="button" class="btn-sm" onClick={onClearFilters}>Limpiar filtros</button>
            )}
            {onCreateExercise && (
              <button type="button" class="btn-sm btn-accent" onClick={onCreateExercise}>
                {q ? `+ Crear «${q}»` : '+ Crear ejercicio'}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }
  return (
    <>
      {items.map((item) => {
        const added = (existingCounts?.get(item.name) ?? 0) > 0;
        return (
          <div key={item.name} class="flex items-center justify-between gap-2 py-2.5">
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="truncate text-sm font-medium text-gray-100" title={item.name}>{item.name}</span>
                {added && (
                  <span class="shrink-0 rounded-full bg-emeraldGreen/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    {addedLabel}
                  </span>
                )}
              </div>
              {item.primary && (
                <div class="truncate text-[11px] text-gray-400">
                  {item.primary}{item.secondary.length > 0 ? ` · ${item.secondary.join(', ')}` : ''}
                </div>
              )}
            </div>
            {added ? (
              onQuickRemove ? (
                <button
                  type="button"
                  class="btn-sm btn-danger shrink-0"
                  disabled={!targetRoutine}
                  onClick={() => targetRoutine && onQuickRemove(targetRoutine, item.name)}
                >
                  Quitar
                </button>
              ) : (
                <button type="button" class="btn-sm shrink-0" disabled>{addedLabel}</button>
              )
            ) : (
              <button
                type="button"
                class="btn-sm shrink-0"
                disabled={!targetRoutine}
                onClick={() => targetRoutine && onQuickAdd?.(targetRoutine, item.name)}
              >
                {addLabel}
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}
