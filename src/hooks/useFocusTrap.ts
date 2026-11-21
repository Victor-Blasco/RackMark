import type { RefObject } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

/** Selector CSS de elementos enfocados válidos dentro de un modal accesible. */
export const MODAL_FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Captura el foco previo, atrapa `Tab` / `Shift+Tab` dentro del modal abierto,
 * ejecuta `onEscape` al pulsar Escape y devuelve el foco al cerrarse.
 *
 * @param containerRef - Referencia al contenedor raíz del diálogo activo.
 * @param active - Indica si el modal está montado y visible.
 * @param onEscape - Callback que cierra el modal actual.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape: () => void,
): void {
  const prevTrigger = useRef<HTMLElement | null>(null);
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!active) return;
    const activeEl = document.activeElement;
    if (activeEl instanceof HTMLElement && activeEl !== document.body && !containerRef.current?.contains(activeEl)) {
      prevTrigger.current = activeEl;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const parent = containerRef.current?.parentElement;
    const inerted: HTMLElement[] = [];
    if (parent) {
      for (const child of Array.from(parent.children)) {
        if (
          child instanceof HTMLElement &&
          child !== containerRef.current &&
          child.getAttribute('role') !== 'status' &&
          !child.inert
        ) {
          child.inert = true;
          inerted.push(child);
        }
      }
    }

    const focusTimer = window.requestAnimationFrame(() => {
      const dialog = containerRef.current;
      if (!dialog) return;
      const firstInput = dialog.querySelector<HTMLElement>('input:not([type="hidden"]):not([disabled]), textarea:not([disabled])');
      const firstFocus = firstInput ?? dialog.querySelector<HTMLElement>(MODAL_FOCUSABLE_SELECTOR);
      firstFocus?.focus({ preventScroll: true });
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscapeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const dialog = containerRef.current;
      if (!dialog) return;
      const focusables = [...dialog.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE_SELECTOR)].filter(
        (el) => !el.closest('[hidden], [inert]'),
      );
      if (!focusables.length) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement as HTMLElement | null;
      if (!current || !dialog.contains(current)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && current === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      for (const el of inerted) el.inert = false;
      window.cancelAnimationFrame(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      const trigger = prevTrigger.current;
      prevTrigger.current = null;
      if (trigger && trigger.isConnected) {
        trigger.focus({ preventScroll: true });
      } else {
        document.getElementById('main-content')?.focus({ preventScroll: true });
      }
    };
  }, [active, containerRef]);
}
