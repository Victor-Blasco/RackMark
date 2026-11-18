import { useLayoutEffect, useRef } from 'preact/hooks';
import { focusSelector } from '../../ui/domPatches';

interface LegacyViewBridgeProps {
  /** Identificador de la pestaña actual para aislar cada vista legada. */
  tabKey: string;
  /** Cadena HTML devuelta por las vistas aún pendientes de migración (Bloques B–C). */
  html: string;
  /** Versión del último render completo para asegurar ejecución post-`resetCharts()`. */
  version?: number;
  /** Hook post-montaje para inicializar `runChartJobs()` y `runCalc()`. */
  onMountHtml?: (container: HTMLElement) => void;
}

/**
 * Puente temporal que monta vistas HTML legadas dentro de `<AppShell />` y
 * preserva foco, cursor y scroll hasta completar los Bloques B y C.
 */
export function LegacyViewBridge({ tabKey, html, version = 0, onMountHtml }: LegacyViewBridgeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const active = document.activeElement;
    const activeSel = active && el.contains(active) ? focusSelector(active) : null;
    const selStart = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? active.selectionStart : null;
    const selEnd = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? active.selectionEnd : null;

    el.innerHTML = html;
    onMountHtml?.(el);

    if (activeSel) {
      const next = el.querySelector<HTMLElement>(activeSel);
      next?.focus({ preventScroll: true });
      if ((next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement) && selStart != null && selEnd != null) {
        try { next.setSelectionRange(selStart, selEnd); } catch { /* algunos inputs no admiten selección */ }
      }
    }
  }, [tabKey, html, version, onMountHtml]);

  return <div ref={containerRef} data-legacy-view={tabKey} />;
}
