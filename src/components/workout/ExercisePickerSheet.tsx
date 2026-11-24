import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { musclesOf } from '../../lib/analysis';
import { norm } from '../../lib/seed';
import type { Settings } from '../../types';
import { filterSelectionOptions } from '../../ui/selection';
import { Icon } from '../common/Icon';
import { SearchInput } from '../common/SearchInput';

interface ExercisePickerSheetProps {
  mode: 'add' | 'swap'; /** Modo de apertura: añadir ejercicio adicional o sustituir el actual. */
  currentExName?: string; /** Nombre del ejercicio actual (solo en modo `swap`). */
  available: string[]; /** Ejercicios disponibles no presentes todavía en la sesión. */
  quickSuggestions: string[]; /** Sugerencias afines al grupo muscular del día o del ejercicio sustituido. */
  settings?: Settings; /** Ajustes del usuario para enriquecer búsqueda y subtítulo muscular. */
  query: string; /** Término actual del campo de búsqueda. */
  onQueryChange: (q: string) => void;
  onPick: (name: string) => void;
  onClose: () => void;
}

/** Panel transitorio de 1 toque para buscar, crear o intercambiar ejercicio en `En vivo`. */
export function ExercisePickerSheet({
  mode, currentExName, available, quickSuggestions, settings, query, onQueryChange, onPick, onClose,
}: ExercisePickerSheetProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  const hasCurrentRef = useRef(Boolean(currentExName));
  onCloseRef.current = onClose;
  hasCurrentRef.current = Boolean(currentExName);
  const [activeIdx, setActiveIdx] = useState(0);
  const trimmed = query.trim();

  const baseOptions = useMemo(
    () => available.map((name) => {
      const m = settings ? musclesOf(name, settings) : null;
      return { id: name, label: name, subtitle: m?.p, aliases: m ? [m.p, ...m.s] : undefined };
    }),
    [available, settings],
  );
  const options = useMemo(() => filterSelectionOptions(baseOptions, query), [baseOptions, query]);
  const canCreate = useMemo(() => Boolean(trimmed) && !available.some((n) => norm(n) === norm(trimmed)), [available, trimmed]);
  const title = mode === 'swap' && currentExName ? `Cambiar "${currentExName}" por otro` : 'Añadir ejercicio a este entreno';
  const activeOptionId = options[activeIdx] ? `live-pick-opt-${activeIdx}` : undefined;

  useEffect(() => { setActiveIdx(0); }, [query, mode]);

  useEffect(() => {
    const prevFocused = document.activeElement as HTMLElement | null;
    searchRef.current?.focus({ preventScroll: true });
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && hasCurrentRef.current) { e.preventDefault(); onCloseRef.current(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (prevFocused?.isConnected && prevFocused !== document.body) prevFocused.focus({ preventScroll: true });
    };
  }, []);

  const onSearchKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' && options.length) {
      e.preventDefault();
      setActiveIdx((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === 'ArrowUp' && options.length) {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      const target = options[activeIdx]?.id ?? (canCreate ? trimmed : '');
      if (target) { e.preventDefault(); onPick(target); }
    }
  };

  return (
    <section aria-label={title} class="rounded-2xl border border-electricBlue/40 bg-floatDark p-3.5 shadow-xl shadow-black/40 space-y-3">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-sm font-extrabold text-white">{title}</h3>
        {currentExName && (
          <button type="button" class="min-h-[44px] sm:min-h-[34px] rounded-lg px-2.5 text-xs font-semibold text-gray-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" onClick={onClose}>Cancelar</button>
        )}
      </div>

      {!trimmed && quickSuggestions.length > 0 && (
        <div class="space-y-1.5">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Sugeridos</p>
          <div class="flex flex-wrap gap-1.5">
            {quickSuggestions.map((n) => <button key={n} type="button" class="btn-sm rounded-full font-medium text-gray-100" onClick={() => onPick(n)}>{n}</button>)}
          </div>
        </div>
      )}

      <div class="space-y-2">
        <SearchInput
          id="livePickerSearch"
          inputRef={searchRef}
          value={query}
          placeholder="Buscar ejercicio o músculo…"
          ariaLabel="Buscar o crear ejercicio"
          inputClass="inp w-full min-h-[44px] pr-10"
          comboboxProps={{ role: 'combobox', ariaControls: 'livePickerList', ariaActiveDescendant: activeOptionId }}
          onInput={onQueryChange}
          onClear={() => onQueryChange('')}
          onKeyDown={onSearchKeyDown}
        />

        <div class="flex items-center justify-between text-[11px] text-gray-400">
          <span aria-live="polite" class="tabular-nums">{trimmed ? `Resultados (${options.length})` : `Todos los ejercicios (${available.length})`}</span>
          {options.length > 0 && <span>Toca un ejercicio para seleccionarlo</span>}
        </div>

        <div id="livePickerList" role="listbox" aria-label="Ejercicios disponibles" class="max-h-56 overflow-y-auto divide-y divide-white/5 rounded-xl border border-white/10 bg-gray-900/70">
          {options.length > 0 ? options.map((opt, idx) => (
            <button key={opt.id} id={`live-pick-opt-${idx}`} type="button" role="option" aria-selected={idx === activeIdx ? 'true' : 'false'} class={`flex min-h-[44px] w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${idx === activeIdx ? 'bg-electricBlue/15 text-white' : 'text-gray-100 hover:bg-white/[0.06]'}`} onClick={() => onPick(opt.id)}>
              <span class="min-w-0 truncate">
                <span class="font-medium">{opt.label}</span>
                {opt.subtitle && <span class="ml-1.5 text-xs text-gray-400">· {opt.subtitle}</span>}
              </span>
              <Icon name="plus" className="h-4 w-4 shrink-0 text-blue-300" />
            </button>
          )) : (
            <p class="px-3 py-3 text-xs text-gray-400">{trimmed ? `Sin ejercicios que coincidan con «${trimmed}».` : 'Sin ejercicios disponibles.'}</p>
          )}
        </div>

        {canCreate && (
          <button id="livePickerCreate" type="button" class="btn btn-accent min-h-[44px] w-full justify-start" onClick={() => onPick(trimmed)}>
            <Icon name="plus" className="h-4 w-4" /> Crear y usar «{trimmed}»
          </button>
        )}
      </div>
    </section>
  );
}
