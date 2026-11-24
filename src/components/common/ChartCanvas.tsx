import { Chart, type ChartConfiguration } from 'chart.js';
import { useEffect, useRef, useState } from 'preact/hooks';
import { normalizeChartConfig } from '../../ui/charts';

interface ChartCanvasProps {
  /** Configuración de Chart.js a normalizar y dibujar en el lienzo. */
  config: ChartConfiguration;
  /** Identificador DOM opcional del `<canvas>`. */
  id?: string;
  /** Clases Tailwind adicionales para el `<canvas>`. */
  className?: string;
  /** Etiqueta accesible opcional para lectores de pantalla. */
  ariaLabel?: string;
}

/**
 * Encapsula el ciclo de vida de Chart.js con creación única, actualización suave y destrucción al desmontar.
 */
export function ChartCanvas({ config, id, className, ariaLabel }: ChartCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const typeRef = useRef<string | undefined>(undefined);
  const lastThemeRevRef = useRef(0);
  const [themeRev, setThemeRev] = useState(0);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
    const obs = new MutationObserver(() => setThemeRev((n) => n + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el || el.getBoundingClientRect().width === 0) return;
    const normalized = normalizeChartConfig(config);
    const cur = chartRef.current;
    const themeChanged = lastThemeRevRef.current !== themeRev;
    lastThemeRevRef.current = themeRev;
    if (cur && !themeChanged && cur.canvas === el && typeRef.current === normalized.type) {
      cur.data = normalized.data;
      if (normalized.options) cur.options = normalized.options as never;
      cur.update('none');
      return;
    }
    cur?.destroy();
    typeRef.current = normalized.type;
    chartRef.current = new Chart(el, normalized) as unknown as Chart;
  }, [config, themeRev]);

  useEffect(() => () => {
    chartRef.current?.destroy();
    chartRef.current = null;
  }, []);

  const dsLabels = (config.data?.datasets ?? []).map((d) => d.label).filter(Boolean).join(', ');
  const resolvedLabel = ariaLabel ?? (dsLabels ? `Gráfica de ${dsLabels}` : 'Gráfica de evolución');

  return <canvas ref={canvasRef} id={id} class={className} role="img" aria-label={resolvedLabel} />;
}
