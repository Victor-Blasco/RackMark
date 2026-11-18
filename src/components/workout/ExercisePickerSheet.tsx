import { useRef } from 'preact/hooks';
import { filterSelectionOptions } from '../../ui/selection';

interface ExercisePickerSheetProps {
  /** Modo de apertura: añadir ejercicio adicional o sustituir el actual. */
  mode: 'add' | 'swap';
  /** Nombre del ejercicio actual (solo en modo `swap`). */
  currentExName?: string;
  /** Ejercicios disponibles no presentes todavía en la sesión. */
  available: string[];
  /** Sugerencias principales afines a los grupos musculares del día. */
  quickSuggestions: string[];
  /** Término actual del campo de búsqueda. */
  query: string;
  /** Actualiza la búsqueda mientras escribe el usuario. */
  onQueryChange: (q: string) => void;
  /** Selecciona o crea el ejercicio elegido. */
  onPick: (name: string) => void;
  /** Cierra el panel selector. */
  onClose: () => void;
}

/**
 * Panel transitorio para añadir o intercambiar un ejercicio sobre la marcha en `En vivo`.
 */
export function ExercisePickerSheet({
  mode,
  currentExName,
  available,
  quickSuggestions,
  query,
  onQueryChange,
  onPick,
  onClose,
}: ExercisePickerSheetProps) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const customRef = useRef<HTMLInputElement>(null);
  const options = filterSelectionOptions(available.map((name) => ({ id: name, label: name })), query);
  const title = mode === 'swap' && currentExName ? `Cambiar "${currentExName}" por otro` : 'Añadir ejercicio a este entreno';

  return (
    <section aria-label={title} class="rounded-2xl border border-electricBlue/40 bg-floatDark p-3.5 shadow-xl shadow-black/40 space-y-3">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-sm font-extrabold text-white">{title}</h3>
        {currentExName && (
          <button type="button" class="min-h-[44px] sm:min-h-[34px] px-2.5 text-xs font-semibold text-gray-400 hover:text-white" data-act="liveClosePicker" onClick={onClose}>
            Cancelar
          </button>
        )}
      </div>

      {quickSuggestions.length > 0 && (
        <div class="space-y-1.5">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Sugeridos</p>
          <div class="flex flex-wrap gap-1.5">
            {quickSuggestions.map((n) => (
              <button key={n} type="button" data-act="livePickEx" data-arg={n} class="btn-sm rounded-full font-medium text-gray-100" onClick={() => onPick(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div class="flex gap-2">
          {available.length > 12 && (
            <input
              id="livePickerSearch"
              class="inp min-h-[44px] flex-1"
              value={query}
              placeholder="Buscar ejercicio…"
              data-live-picker-search
              aria-label="Buscar ejercicio"
              onInput={(e) => onQueryChange(e.currentTarget.value)}
            />
          )}
          <select id="livePickerSelect" ref={selectRef} class="inp min-h-[44px] flex-1" aria-label="Elegir ejercicio de la lista">
            <option value="">{query.trim() ? `Resultados (${options.length})…` : `Todos los ejercicios (${available.length})…`}</option>
            {options.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
          </select>
          <button type="button" class="btn-primary min-h-[44px] shrink-0" data-act="livePickFromSelect" onClick={() => onPick(selectRef.current?.value ?? '')}>
            Elegir
          </button>
        </div>
        <div class="flex gap-2">
          <input id="livePickerCustom" ref={customRef} class="inp min-h-[44px] flex-1" placeholder="O escribe uno nuevo…" aria-label="Nombre de ejercicio personalizado" />
          <button type="button" class="btn min-h-[44px] shrink-0" data-act="livePickCustom" onClick={() => onPick(customRef.current?.value ?? '')}>
            Usar
          </button>
        </div>
      </div>
    </section>
  );
}
