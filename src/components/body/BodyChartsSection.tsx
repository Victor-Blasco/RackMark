import type { ChartConfiguration } from 'chart.js';
import { PERIM } from '../../store/bodySelectors';
import { ChartCanvas } from '../common/ChartCanvas';
import { SegmentedControl } from '../common/SegmentedControl';

interface BodyChartsSectionProps {
  /** Total de registros de composición corporal en el rango activo. */
  compCount: number;
  /** Indica si existen mediciones de peso dentro del rango. */
  hasCompWeight: boolean;
  /** Indica si existen mediciones de masa muscular dentro del rango. */
  hasCompMuscle: boolean;
  /** Métrica principal seleccionada en la gráfica de composición. */
  activeCompMode: 'weight' | 'muscle';
  /** Veredicto de 1 línea para composición corporal. */
  compVerdict?: string;
  /** Indica si existe al menos un registro de perímetros con cinta en el historial. */
  hasAnyPerim: boolean;
  /** Configuración de Chart.js para composición corporal o `null`. */
  compCfg: ChartConfiguration<'line'> | null;
  /** Configuración de Chart.js para el grupo de perímetros activo o `null`. */
  perimCfg: ChartConfiguration<'line'> | null;
  /** Clave del grupo de perímetros seleccionado (`arms`, `thighs`…). */
  activePerimeter: string;
  /** Etiqueta legible del grupo de perímetros activo. */
  perimeterLabel: string;
  /** Total histórico de medidas guardadas. */
  totalMeasures: number;
  /** Indica si hay un filtro temporal distinto de `Todo`. */
  hasFilter: boolean;
  /** Etiqueta del periodo seleccionado. */
  rangeLabel: string;
  /** Alterna entre peso y masa muscular en composición corporal. */
  onChangeCompMode: (mode: 'weight' | 'muscle') => void;
  /** Cambia el grupo de perímetros mostrado. */
  onChangePerimeter: (perim: string) => void;
}

const COMP_OPTIONS: ReadonlyArray<{ id: 'weight' | 'muscle'; label: string }> = [
  { id: 'weight', label: 'Peso' },
  { id: 'muscle', label: 'Masa muscular' },
];

/**
 * Gráficas de composición corporal y perímetros con cinta en `Cuerpo y medidas`.
 */
export function BodyChartsSection({
  compCount,
  hasCompWeight,
  hasCompMuscle,
  activeCompMode,
  compVerdict,
  hasAnyPerim,
  compCfg,
  perimCfg,
  activePerimeter,
  perimeterLabel,
  totalMeasures,
  hasFilter,
  rangeLabel,
  onChangeCompMode,
  onChangePerimeter,
}: BodyChartsSectionProps) {
  return (
    <div class={`grid grid-cols-1 gap-6 ${hasAnyPerim ? 'lg:grid-cols-2' : ''} pb-5 border-b border-white/10`}>
      <div class="min-w-0 space-y-2">
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 class="font-bold text-white tabular-nums">Composición corporal ({compCount} registros)</h2>
          {hasCompWeight && hasCompMuscle && (
            <SegmentedControl
              options={COMP_OPTIONS}
              value={activeCompMode}
              ariaLabel="Métrica principal de composición"
              className="inline-flex rounded-xl border border-white/10 bg-gray-900/70 p-1 text-[11px]"
              buttonClassName="min-h-[44px] sm:min-h-[30px] px-2.5 py-1"
              onChange={onChangeCompMode}
            />
          )}
        </div>
        {compVerdict && <p class="text-xs font-semibold text-gray-200 num-col">{compVerdict}</p>}
        {compCount > 0 && compCfg ? (
          <div class="chart-box"><ChartCanvas id="c-comp" config={compCfg} /></div>
        ) : (
          <p class="py-12 text-center text-sm text-gray-400">
            {totalMeasures > 0
              ? `Sin mediciones en ${rangeLabel}.`
              : 'Añade tu peso o % de grasa arriba para ver la evolución.'}
          </p>
        )}
      </div>

      {hasAnyPerim && (
        <div class="min-w-0 space-y-2">
          <div class="mb-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <h2 class="font-bold text-white">Medidas con cinta (cm)</h2>
            <select
              class="inp max-w-full sm:w-auto"
              aria-label="Grupo de perímetros"
              value={activePerimeter}
              onChange={(e) => onChangePerimeter(e.currentTarget.value)}
            >
              {Object.entries(PERIM).map(([k, v]) => (
                <option key={k} value={k} selected={k === activePerimeter}>{v.label}</option>
              ))}
            </select>
          </div>
          {perimCfg ? (
            <div class="chart-box"><ChartCanvas id="c-perim" config={perimCfg} /></div>
          ) : (
            <p class="py-12 text-center text-sm text-gray-400">
              Sin registros en {perimeterLabel.toLowerCase()}
              {hasFilter ? ` (${rangeLabel})` : ''}. Puedes añadir medidas con cinta arriba si las controlas.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
