import type { ComponentChildren } from 'preact';

/** Opción individual de un selector segmentado. */
export interface SegmentedOption<T extends string> {
  /** Valor único de la opción. */
  id: T;
  /** Contenido legible del botón. */
  label: ComponentChildren;
  /** Insignia opcional a la derecha de la etiqueta. */
  badge?: ComponentChildren;
}

interface SegmentedControlProps<T extends string> {
  /** Lista ordenada de opciones visibles en el control. */
  options: ReadonlyArray<SegmentedOption<T>>;
  /** Valor actualmente seleccionado. */
  value: T;
  /** Etiqueta accesible del grupo de botones. */
  ariaLabel: string;
  /** Rol ARIA del contenedor (`group`, `radiogroup` o `tablist`). */
  role?: 'group' | 'radiogroup' | 'tablist';
  /** Estilo de selección activa: acento principal o superficie neutra sutil. */
  variant?: 'accent' | 'subtle';
  /** Clases extra para el contenedor exterior. */
  className?: string;
  /** Clases extra para cada botón. */
  buttonClassName?: string;
  /** Callback al pulsar una opción. */
  onChange: (value: T) => void;
}

/**
 * Selector segmentado accesible para elegir entre un conjunto reducido de opciones visibles.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  ariaLabel,
  role = 'group',
  variant = 'accent',
  className = 'inline-flex rounded-xl border border-white/10 bg-gray-900/70 p-1 gap-0.5',
  buttonClassName = 'min-h-[44px] sm:min-h-[32px] px-2.5 py-1 text-xs',
  onChange,
}: SegmentedControlProps<T>) {
  const itemRole = role === 'tablist' ? 'tab' : role === 'radiogroup' ? 'radio' : undefined;

  return (
    <div role={role} aria-label={ariaLabel} class={className}>
      {options.map((opt) => {
        const active = opt.id === value;
        const activeCls = variant === 'subtle'
          ? 'bg-white/15 text-white shadow-sm ring-1 ring-white/10'
          : 'bg-electricBlue text-white';
        const idleCls = variant === 'subtle'
          ? 'text-gray-400 hover:text-gray-200'
          : 'text-gray-400 hover:text-white';
        const stateProps = itemRole === 'tab'
          ? { 'aria-selected': active ? ('true' as const) : ('false' as const) }
          : itemRole === 'radio'
            ? { 'aria-checked': active ? ('true' as const) : ('false' as const), tabIndex: active ? 0 : -1 }
            : { 'aria-pressed': active ? ('true' as const) : ('false' as const) };

        return (
          <button
            key={opt.id}
            type="button"
            role={itemRole}
            {...stateProps}
            class={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${buttonClassName} ${active ? activeCls : idleCls}`}
            onClick={() => onChange(opt.id)}
          >
            <span>{opt.label}</span>
            {opt.badge}
          </button>
        );
      })}
    </div>
  );
}
