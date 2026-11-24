import type { ChartConfiguration } from 'chart.js';
import { ChartCanvas } from '../common/ChartCanvas';
import { Icon } from '../common/Icon';

interface HomeChartsSectionProps {
  /** Nombre del ejercicio actualmente seleccionado. */
  selectedEx?: string;
  /** Etiqueta legible del rango temporal activo. */
  rangeLabel: string;
  /** Veredicto de 1 línea para la tendencia del ejercicio. */
  exVerdict?: string;
  /** Veredicto de 1 línea para la tendencia de peso corporal. */
  bodyVerdict?: string;
  /** Configuración Chart.js de progresión del ejercicio (o `null`). */
  exChartCfg: ChartConfiguration | null;
  /** Configuración Chart.js de peso y % grasa (o `null`). */
  bodyChartCfg: ChartConfiguration | null;
  /** Abre el modal buscador NFD multi-músculo para elegir ejercicio. */
  onOpenPicker: () => void;
}

/**
 * Pareja de gráficas principales de `Resumen`: evolución de cargas y peso/% grasa.
 */
export function HomeChartsSection({
  selectedEx,
  rangeLabel,
  exVerdict,
  bodyVerdict,
  exChartCfg,
  bodyChartCfg,
  onOpenPicker,
}: HomeChartsSectionProps) {
  return (
    <section class="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-5 border-b border-white/10">
      <div class="min-w-0 space-y-2 pb-4 border-b border-white/10 lg:pb-0 lg:border-b-0">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-base font-bold text-white">Evolución de cargas</h2>
            <p class="text-xs text-gray-400">Toca un punto para ver las series · pulsa la leyenda para mostrar u ocultar</p>
          </div>
          <button
            type="button"
            class="inp inline-flex w-full sm:w-auto max-w-full sm:max-w-[260px] items-center justify-between gap-2 text-left"
            aria-label={`Seleccionar ejercicio para gráfica: ${selectedEx ?? 'Elegir ejercicio'}`}
            onClick={onOpenPicker}
          >
            <span class="truncate font-semibold text-white">{selectedEx ?? 'Elegir ejercicio…'}</span>
            <Icon name="caretDown" className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          </button>
        </div>
        {exVerdict && <p class="text-xs font-semibold text-gray-200 num-col">{exVerdict}</p>}
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
        {bodyVerdict && <p class="text-xs font-semibold text-gray-200 num-col">{bodyVerdict}</p>}
        {bodyChartCfg ? (
          <div class="chart-box"><ChartCanvas id="c-home-body" config={bodyChartCfg} /></div>
        ) : (
          <p class="py-12 text-center text-sm text-gray-400">Sin mediciones de peso en {rangeLabel}.</p>
        )}
      </div>
    </section>
  );
}
