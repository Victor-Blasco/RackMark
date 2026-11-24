import type { ComponentChildren } from 'preact';
import { useCollapsible } from '../../hooks/useCollapsible';

interface CollapsibleProps {
  /** Identificador DOM opcional para enlazar con `aria-controls`. */
  id?: string;
  /** Estado lógico actual del desplegable. */
  open: boolean;
  /** Clases CSS opcionales para el contenedor animado. */
  className?: string;
  /** Mantiene el árbol DOM montado cuando está cerrado (útil para formularios con estado). */
  keepMounted?: boolean;
  /** Contenido interno a expandir o contraer suavemente. */
  children: ComponentChildren;
}

/** Contenedor reutilizable con animación CSS `grid-rows-[0fr <-> 1fr]` y respeto a `prefers-reduced-motion`. */
export function Collapsible({ id, open, className = '', keepMounted = false, children }: CollapsibleProps) {
  const { mounted, expanded } = useCollapsible(open);
  const show = keepMounted || mounted;
  const isOpen = keepMounted ? open : expanded;
  if (!show) return null;

  return (
    <div
      id={id}
      data-open={String(open)}
      aria-hidden={isOpen ? undefined : 'true'}
      class={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'} ${className}`}
    >
      <div class="overflow-hidden" inert={!open}>
        {children}
      </div>
    </div>
  );
}
