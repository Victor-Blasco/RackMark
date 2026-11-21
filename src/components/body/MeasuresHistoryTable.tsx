import type { Measure, MEASURE_FIELDS } from '../../types';
import { fmtDate } from '../../ui/shared';
import { Icon } from '../common/Icon';

type MeasureFieldDef = (typeof MEASURE_FIELDS)[number];

const SHORT_COL_LABELS: Record<string, string> = {
  weight: 'Peso', bf: '% Grasa', muscle: 'Músc.', waist: 'Cint.', torso: 'Torso',
  shoulders: 'Homb.', glute: 'Glút.', armL: 'Br. I', armR: 'Br. D',
  thighL: 'Mu. I', thighR: 'Mu. D', kneeL: 'Rod. I', kneeR: 'Rod. D',
  calfL: 'Gem. I', calfR: 'Gem. D',
};

interface MeasuresHistoryTableProps {
  /** Mediciones del rango ya ordenadas cronológicamente de más reciente a más antigua. */
  measuresDesc: Measure[];
  /** Total histórico de mediciones sin filtrar. */
  totalMeasures: number;
  /** Indica si existe un filtro temporal distinto de `Todo`. */
  hasFilter: boolean;
  /** Etiqueta del periodo seleccionado. */
  rangeLabel: string;
  /** Columnas visibles en la tabla según los campos presentes en el rango. */
  tableCols: MeasureFieldDef[];
  /** Fecha actualmente cargada en el formulario de edición para destacarla en la tabla. */
  activeDate: string;
  /** Carga una medición en el formulario superior. */
  onEditMeasure: (date: string) => void;
  /** Elimina una medición previa confirmación. */
  onDeleteMeasure: (date: string) => void;
}

/**
 * Tabla cronológica inversa de mediciones corporales con acceso directo a edición y borrado.
 */
export function MeasuresHistoryTable({
  measuresDesc,
  totalMeasures,
  hasFilter,
  rangeLabel,
  tableCols,
  activeDate,
  onEditMeasure,
  onDeleteMeasure,
}: MeasuresHistoryTableProps) {
  return (
    <div class="space-y-2 overflow-x-auto">
      <h3 class="mb-2 font-bold text-white tabular-nums">
        Historial de mediciones ({measuresDesc.length}{hasFilter ? ` de ${totalMeasures}` : ''})
      </h3>
      {measuresDesc.length > 0 ? (
        <table class="w-full min-w-[760px] lg:min-w-0 table-fixed text-right text-xs sm:text-sm">
          <thead class="text-[11px] sm:text-xs uppercase text-gray-400">
            <tr>
              <th class="w-24 py-2 pr-2 text-left">Fecha</th>
              {tableCols.map((f) => (
                <th key={f.key} class="px-1 truncate" title={`${f.label} (${f.unit})`}>
                  {SHORT_COL_LABELS[f.key] ?? f.label}
                </th>
              ))}
              <th class="w-24 sm:w-20 pl-1"><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {measuresDesc.map((m) => (
              <tr key={m.date} class={`border-t border-gray-800 tabular-nums ${m.date === activeDate ? 'bg-electricBlue/10' : ''}`}>
                <td class="py-2 pr-2 text-left font-medium text-gray-200 whitespace-nowrap truncate">
                  {fmtDate(m.date)}
                  {m.note && <div class="text-xs font-normal text-amberGold truncate" title={m.note}>{m.note}</div>}
                </td>
                {tableCols.map((f) => (
                  <td key={f.key} class="px-1 font-medium text-gray-100 truncate">{m[f.key] ?? ''}</td>
                ))}
                <td class="pl-1 whitespace-nowrap">
                  <button
                    type="button"
                    class="icon-btn sm:h-8 sm:w-7 text-blue-300 hover:bg-electricBlue/15"
                    aria-label={`Editar medición del ${fmtDate(m.date)}`}
                    onClick={() => onEditMeasure(m.date)}
                  >
                    <Icon name="edit" className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    class="icon-btn sm:h-8 sm:w-7 text-coralRed hover:bg-coralRed/10"
                    aria-label={`Borrar medición del ${fmtDate(m.date)}`}
                    onClick={() => onDeleteMeasure(m.date)}
                  >
                    <Icon name="close" className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p class="py-6 text-center text-sm text-gray-400">
          {totalMeasures > 0 ? `No hay mediciones en ${rangeLabel}.` : 'Todavía no hay mediciones guardadas.'}
        </p>
      )}
    </div>
  );
}
