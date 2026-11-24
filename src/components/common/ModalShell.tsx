import type { ComponentChildren, RefObject } from 'preact';
import { useRef } from 'preact/hooks';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface ModalShellProps {
  /** Identificador DOM único del modal. */
  id: string;
  /** Rol ARIA del diálogo (`dialog` o `alertdialog`). */
  role?: 'dialog' | 'alertdialog';
  /** ID del título para `aria-labelledby`. */
  labelledBy: string;
  /** ID opcional de la descripción para `aria-describedby`. */
  describedBy?: string;
  /** Clases de espaciado del contenedor exterior fijo. */
  wrapperClass?: string;
  /** Clases extra para el fondo atenuado (p. ej. animación de apertura). */
  backdropClass?: string;
  /** Si el clic fuera del panel cierra el modal (por defecto `true`). */
  closeOnBackdrop?: boolean;
  /** Clases de anchura, borde y relleno del panel modal. */
  panelClass?: string;
  /** Referencia opcional al contenedor raíz para consultas DOM del llamador. */
  dialogRef?: RefObject<HTMLDivElement | null>;
  /** Se ejecuta al pulsar Escape o hacer clic en el fondo (si aplica). */
  onClose: () => void;
  /** Contenido interno del diálogo modal. */
  children: ComponentChildren;
}

/**
 * Contenedor modal accesible con foco atrapado, cierre por `Escape` y fondo atenuado.
 */
export function ModalShell({
  id,
  role = 'dialog',
  labelledBy,
  describedBy,
  wrapperClass = 'p-4',
  backdropClass = '',
  closeOnBackdrop = true,
  panelClass = 'max-w-md border-white/10 p-5 space-y-4',
  dialogRef: externalRef,
  onClose,
  children,
}: ModalShellProps) {
  const internalRef = useRef<HTMLDivElement>(null);
  const resolvedRef = externalRef ?? internalRef;
  useFocusTrap(resolvedRef, true, onClose);

  return (
    <div
      id={id}
      ref={resolvedRef}
      role={role}
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      class={`fixed inset-0 z-50 flex items-center justify-center ${wrapperClass}`}
    >
      <div
        class={`fixed inset-0 bg-black/80 ${backdropClass}`}
        aria-hidden="true"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div class={`relative z-10 w-full rounded-2xl border bg-modalDark shadow-2xl ${panelClass}`}>
        {children}
      </div>
    </div>
  );
}
