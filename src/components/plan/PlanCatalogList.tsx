import type { ExerciseMapItem, PlanCatalogItem } from '../../store/planSelectors';
import { MUSCLES } from '../../lib/seed';

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
            data-act="rtQuickAdd"
            data-arg={`${targetRoutine}|${item.name}`}
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

interface PlanExerciseMapListProps {
  /** Ejercicios visibles en el editor de mapa muscular. */
  items: ExerciseMapItem[];
  /** Cambia el músculo principal de un ejercicio. */
  onChangePrimary?: (exName: string, primary: string) => void;
  /** Cambia la lista de músculos secundarios separados por coma. */
  onChangeSecondary?: (exName: string, rawSecondary: string) => void;
}

/** Filas editables de músculo principal y secundarios en la pestaña `Ejercicios y músculos`. */
export function PlanExerciseMapList({ items, onChangePrimary, onChangeSecondary }: PlanExerciseMapListProps) {
  if (!items.length) {
    return <p class="py-4 text-center text-xs text-gray-400">Sin ejercicios que coincidan con la búsqueda.</p>;
  }
  return (
    <>
      {items.map((item) => (
        <div key={item.name} class="flex min-w-0 items-center gap-2 text-sm">
          <span class="w-36 shrink-0 truncate xl:w-40 2xl:w-44" title={item.name}>{item.name}</span>
          <select
            class="inp w-28 shrink-0 sm:w-32"
            data-change="musP"
            data-arg={item.name}
            aria-label={`Músculo principal de ${item.name}`}
            value={item.primary}
            onChange={(e) => onChangePrimary?.(item.name, e.currentTarget.value)}
          >
            <option value="" selected={!item.primary}>—</option>
            {MUSCLES.map((m) => <option key={m} value={m} selected={m === item.primary}>{m}</option>)}
          </select>
          <input
            class="inp min-w-0 flex-1"
            placeholder="Ej. Tríceps, Hombros…"
            value={item.secondaryText}
            data-change="musS"
            data-arg={item.name}
            aria-label={`Músculos secundarios de ${item.name}`}
            onChange={(e) => onChangeSecondary?.(item.name, e.currentTarget.value)}
          />
        </div>
      ))}
    </>
  );
}
