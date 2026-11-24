import type { RefObject } from 'preact';
import { Icon } from './Icon';

interface SearchInputProps {
  /** Identificador DOM del campo de texto. */
  id: string;
  /** Valor controlado actual de la búsqueda. */
  value: string;
  /** Texto orientativo cuando el campo está vacío. */
  placeholder: string;
  /** Etiqueta accesible del input. */
  ariaLabel: string;
  /** Clases opcionales para el elemento `<input>`. */
  inputClass?: string;
  /** Clases opcionales para el botón de limpiar. */
  clearBtnClass?: string;
  /** Tamaño del icono de limpiar (`h-4 w-4` o `h-3.5 w-3.5`). */
  clearIconClass?: string;
  /** Referencia opcional al elemento `<input>`. */
  inputRef?: RefObject<HTMLInputElement | null>;
  /** Atributos ARIA/combobox opcionales. */
  comboboxProps?: {
    role?: 'combobox';
    ariaControls?: string;
    ariaActiveDescendant?: string;
  };
  /** Actualiza el texto al escribir. */
  onInput: (value: string) => void;
  /** Limpia el campo de búsqueda. */
  onClear: () => void;
  /** Manejador opcional de teclado (p. ej. flechas / Enter en combobox). */
  onKeyDown?: (e: KeyboardEvent) => void;
}

/** Campo de búsqueda con botón integrado para limpiar el texto actual. */
export function SearchInput({
  id,
  value,
  placeholder,
  ariaLabel,
  inputClass = 'inp w-full pr-10',
  clearBtnClass = 'icon-btn absolute right-1 top-1/2 -translate-y-1/2',
  clearIconClass = 'h-4 w-4',
  inputRef,
  comboboxProps,
  onInput,
  onClear,
  onKeyDown,
}: SearchInputProps) {
  return (
    <div class="relative min-w-0 flex-1">
      <input
        id={id}
        ref={inputRef}
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        list={undefined}
        role={comboboxProps?.role}
        aria-autocomplete={comboboxProps?.role ? 'list' : undefined}
        aria-expanded={comboboxProps?.role ? 'true' : undefined}
        aria-controls={comboboxProps?.ariaControls}
        aria-activedescendant={comboboxProps?.ariaActiveDescendant}
        class={inputClass}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onInput={(e) => onInput(e.currentTarget.value)}
        onKeyDown={onKeyDown}
      />
      {value && (
        <button type="button" aria-label="Limpiar búsqueda" class={clearBtnClass} onClick={onClear}>
          <Icon name="close" className={clearIconClass} />
        </button>
      )}
    </div>
  );
}
