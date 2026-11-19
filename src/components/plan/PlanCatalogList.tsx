import type { PlanCatalogItem } from '../../store/planSelectors';

export { PlanExerciseMapList } from './PlanExerciseMapList';

interface PlanCatalogListProps {
  /** Lista filtrada (máximo 12) del catálogo rápido. */
  items: PlanCatalogItem[];
  /** Rutina destino seleccionada para añadir en un toque. */
  targetRoutine: string;
  /** Texto buscado cuando no hay coincidencias. */
  searchQuery: string;
  /** Añade un ejercicio a la rutina destino. */
  onQuickAdd?: (routine: string, name: string) => void;
}

/** Lista filtrada del catálogo rápido en Plan para añadir ejercicios en un clic. */
export function PlanCatalogList({ items, targetRoutine, searchQuery, onQuickAdd }: PlanCatalogListProps) {
  if (!items.length) {
    return <p class="py-3 text-center text-xs text-gray-400">Sin resultados para «{searchQuery}».</p>;
  }
  return (
    <>
      {items.map((item) => (
        <div key={item.name} class="flex items-center justify-between gap-2 py-2">
          <div class="min-w-0">
            <div class="truncate text-sm font-medium text-gray-100" title={item.name}>{item.name}</div>
            {item.primary && (
              <div class="truncate text-[11px] text-gray-400">
                {item.primary}{item.secondary.length > 0 ? ` · ${item.secondary.join(', ')}` : ''}
              </div>
            )}
          </div>
          <button
            type="button"
            class="btn-sm shrink-0"
            disabled={!targetRoutine}
            onClick={() => targetRoutine && onQuickAdd?.(targetRoutine, item.name)}
          >
            + Añadir
          </button>
        </div>
      ))}
    </>
  );
}
