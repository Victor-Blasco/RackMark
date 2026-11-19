import type { ChartConfiguration } from 'chart.js';
import { ChartCanvas } from '../common/ChartCanvas';

interface HomeChartsSectionProps {
  /** Total de ejercicios disponibles para mostrar buscador si supera 12. */
  exCount: number;
  /** Nombre del ejercicio actualmente seleccionado. */
  selectedEx?: string;
  /** Opciones filtradas para el desplegable. */
  options: { id: string; label: string }[];
  /** Término actual del buscador de ejercicio. */
  query: string;
  /** Etiqueta legible del rango temporal activo. */
  rangeLabel: string;
  /** Configuración Chart.js de progresión del ejercicio (o `null`). */
  exChartCfg: ChartConfiguration | null;
  /** Configuración Chart.js de peso y % grasa (o `null`). */
  bodyChartCfg: ChartConfiguration | null;
  /** Actualiza la búsqueda de ejercicios. */
  onSearchChange: (q: string) => void;
  /** Selecciona el ejercicio para graficar. */
  onSelectEx: (name: string) => void;
}

/**
 * Pareja de gráficas principales de `Resumen`: evolución de cargas y peso/% grasa.
 */
export function HomeChartsSection({
  exCount,
  selectedEx,
  options,
  query,
  rangeLabel,
  exChartCfg,
  bodyChartCfg,
  onSearchChange,
  onSelectEx,
}: HomeChartsSectionProps) {
  return (
    <section class="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-5 border-b border-white/10">
      <div class="min-w-0 space-y-2 pb-4 border-b border-white/10 lg:pb-0 lg:border-b-0">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-base font-bold text-white">Evolución de cargas</h2>
            <p class="text-xs text-gray-400">Toca un punto para ver las series · pulsa la leyenda para mostrar u ocultar</p>
          </div>
          <div class="flex flex-wrap items-center gap-2 max-w-full">
            {exCount > 12 && (
              <input
                class="inp min-w-[180px] max-w-full sm:max-w-[220px]"
                type="search"
                enterKeyHint="search"
                value={query}
                placeholder="Buscar ejercicio"
                aria-label="Buscar ejercicio para gráfica"
                onInput={(e) => onSearchChange(e.currentTarget.value)}
              />
            )}
            <select
              class="inp w-auto max-w-full sm:max-w-[220px]"
              aria-label="Seleccionar ejercicio para gráfica"
              value={selectedEx ?? ''}
              onChange={(e) => onSelectEx(e.currentTarget.value)}
            >
              {options.map((e) => (
                <option key={e.id} value={e.id} selected={e.id === selectedEx}>{e.label}</option>
              ))}
            </select>
            {exCount > 12 && !options.length && (
              <p aria-live="polite" class="w-full text-xs text-gray-400">Sin ejercicios que coincidan con la búsqueda.</p>
            )}
          </div>
        </div>
        {exChartCfg ? (
          <div class="chart-box"><ChartCanvas id="c-home-ex" config={exChartCfg} /></div>
        ) : (
          <p class="py-12 text-center text-sm text-gray-400">Sin sesiones para este ejercicio en {rangeLabel}.</p>
        )}
      </div>

      <div class="min-w-0 space-y-2">
        <div>
          <h2 class="text-base font-bold text-white">Peso y % de grasa</h2>
          <p class="text-xs text-gray-400">Tendencia media 7 días + registros ({rangeLabel})</p>
        </div>
        {bodyChartCfg ? (
          <div class="chart-box"><ChartCanvas id="c-home-body" config={bodyChartCfg} /></div>
        ) : (
          <p class="py-12 text-center text-sm text-gray-400">Sin mediciones de peso en {rangeLabel}.</p>
        )}
      </div>
    </section>
  );
}
