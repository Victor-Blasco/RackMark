import { useEffect, useRef } from 'preact/hooks';
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
  const searchRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const customRef = useRef<HTMLInputElement>(null);
  const options = filterSelectionOptions(available.map((name) => ({ id: name, label: name })), query);
  const title = mode === 'swap' && currentExName ? `Cambiar "${currentExName}" por otro` : 'Añadir ejercicio a este entreno';

  useEffect(() => {
    const prevFocused = document.activeElement as HTMLElement | null;
    (searchRef.current ?? selectRef.current ?? customRef.current)?.focus({ preventScroll: true });
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && currentExName) {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (prevFocused?.isConnected && prevFocused !== document.body) prevFocused.focus({ preventScroll: true });
    };
  }, [currentExName, onClose]);

  return (
    <section aria-label={title} class="rounded-2xl border border-electricBlue/40 bg-floatDark p-3.5 shadow-xl shadow-black/40 space-y-3">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-sm font-extrabold text-white">{title}</h3>
        {currentExName && (
          <button type="button" class="min-h-[44px] sm:min-h-[34px] rounded-lg px-2.5 text-xs font-semibold text-gray-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" onClick={onClose}>
            Cancelar
          </button>
        )}
      </div>

      {quickSuggestions.length > 0 && (
        <div class="space-y-1.5">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Sugeridos</p>
          <div class="flex flex-wrap gap-1.5">
            {quickSuggestions.map((n) => (
              <button key={n} type="button" class="btn-sm rounded-full font-medium text-gray-100" onClick={() => onPick(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      <div class="space-y-2">
        {available.length > 12 && (
          <div class="space-y-1">
            <input
              id="livePickerSearch"
              ref={searchRef}
              type="search"
              inputMode="search"
              enterKeyHint="search"
              class="inp w-full min-h-[44px]"
              value={query}
              placeholder="Buscar ejercicio…"
              aria-label="Buscar ejercicio"
              onInput={(e) => onQueryChange(e.currentTarget.value)}
            />
            {!options.length && (
              <p aria-live="polite" class="text-xs text-gray-400">Sin ejercicios que coincidan con la búsqueda.</p>
            )}
          </div>
        )}
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div class="flex gap-2">
            <select id="livePickerSelect" ref={selectRef} class="inp min-h-[44px] min-w-0 flex-1" aria-label="Elegir ejercicio de la lista">
              <option value="">{query.trim() ? `Resultados (${options.length})…` : `Todos los ejercicios (${available.length})…`}</option>
              {options.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
            </select>
            <button type="button" class="btn btn-accent min-h-[44px] shrink-0" onClick={() => onPick(selectRef.current?.value ?? '')}>
              Elegir
            </button>
          </div>
          <div class="flex gap-2">
            <input id="livePickerCustom" ref={customRef} enterKeyHint="done" class="inp min-h-[44px] min-w-0 flex-1" placeholder="O escribe uno nuevo…" aria-label="Nombre de ejercicio personalizado" />
            <button type="button" class="btn min-h-[44px] shrink-0" onClick={() => onPick(customRef.current?.value ?? '')}>
              Usar
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
