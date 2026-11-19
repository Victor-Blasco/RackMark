import { useEffect, useState } from 'preact/hooks';

/**
 * Sincroniza montaje diferido y estado expandido para animar apertura y cierre de desplegables.
 *
 * @param open - Estado lógico actual de apertura.
 * @param durationMs - Duración de la transición CSS antes de desmontar al cerrar.
 * @returns `{ mounted, expanded }` compatible con renderizado SSR y `prefers-reduced-motion`.
 */
export function useCollapsible(open: boolean, durationMs = 210) {
  const [mounted, setMounted] = useState(open);
  const [expanded, setExpanded] = useState(open);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setMounted(open);
      setExpanded(open);
      return;
    }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (open) {
      setMounted(true);
      if (reduced) {
        setExpanded(true);
        return;
      }
      const raf = window.requestAnimationFrame(() => setExpanded(true));
      return () => window.cancelAnimationFrame(raf);
    }
    setExpanded(false);
    if (reduced) {
      setMounted(false);
      return;
    }
    const timer = window.setTimeout(() => setMounted(false), durationMs);
    return () => window.clearTimeout(timer);
  }, [open, durationMs]);

  return { mounted, expanded };
}
