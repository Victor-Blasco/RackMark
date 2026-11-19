import { useRef } from 'preact/hooks';

interface LogAddExerciseSectionProps {
  /** Total de ejercicios disponibles no incluidos aún en el borrador. */
  availableCount: number;
  /** Opciones filtradas según `query`. */
  filteredOptions: { id: string; label: string }[];
  /** Sugerencias rápidas afines al grupo muscular del día. */
  quickSuggestions: string[];
  /** Texto actual del campo de búsqueda. */
  query: string;
  /** Abre el modal de creación de ejercicio nuevo. */
  onOpenNewModal: () => void;
  /** Actualiza la consulta de filtrado. */
  onSearchChange: (q: string) => void;
  /** Añade un ejercicio por nombre al borrador actual. */
  onAddExercise: (name: string) => void;
}

/**
 * Pie de `Registrar hecho` para añadir ejercicios de la biblioteca o personalizados al borrador.
 */
export function LogAddExerciseSection({
  availableCount,
  filteredOptions,
  quickSuggestions,
  query,
  onOpenNewModal,
  onSearchChange,
  onAddExercise,
}: LogAddExerciseSectionProps) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const customRef = useRef<HTMLInputElement>(null);

  return (
    <section id="log-add-section" class="space-y-2.5 pt-4 border-t border-white/10">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-bold text-white">Añadir ejercicio a la sesión</h3>
        <button type="button" class="btn btn-accent min-h-[44px] py-1.5 text-xs sm:text-sm" onClick={onOpenNewModal}>
          + Crear ejercicio nuevo
        </button>
      </div>

      <div class="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        <div class="flex flex-wrap gap-2">
          {availableCount > 12 && (
            <input class="inp min-h-[44px] min-w-[180px] flex-1" type="search" enterKeyHint="search" value={query} placeholder="Buscar ejercicio…" aria-label="Buscar ejercicio para añadir" onInput={(e) => onSearchChange(e.currentTarget.value)} />
          )}
          <select id="logAddSelect" ref={selectRef} class="inp min-h-[44px] min-w-[200px] flex-1" aria-label="Seleccionar ejercicio para añadir">
            <option value="">Selecciona cualquier ejercicio ({availableCount})…</option>
            {filteredOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
          </select>
          <button type="button" class="btn min-h-[44px]" onClick={() => selectRef.current?.value && onAddExercise(selectRef.current.value)}>
            + Añadir de la lista
          </button>
        </div>

        {availableCount > 12 && !filteredOptions.length && (
          <p aria-live="polite" class="text-xs text-gray-400">Sin ejercicios que coincidan con la búsqueda.</p>
        )}

        <div class="flex flex-wrap gap-2">
          <input id="logNewExName" ref={customRef} enterKeyHint="done" class="inp min-h-[44px] min-w-[180px] flex-1" placeholder="Añadir rápido por nombre…" aria-label="Nombre de ejercicio nuevo" />
          <button type="button" class="btn min-h-[44px]" onClick={() => {
            const val = customRef.current?.value ?? '';
            if (val.trim()) onAddExercise(val);
          }}>
            + Añadir rápido
          </button>
        </div>
      </div>

      {quickSuggestions.length > 0 && (
        <div class="flex flex-wrap items-center gap-1.5 pt-1">
          <span class="text-xs text-gray-400">Sugeridos:</span>
          {quickSuggestions.map((n) => (
            <button key={n} type="button" class="btn min-h-[44px] rounded-full px-3.5 py-1.5 text-xs font-normal text-gray-200" onClick={() => onAddExercise(n)}>
              + {n}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
