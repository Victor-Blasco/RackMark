import { useState } from 'preact/hooks';
import type { Measure, MEASURE_FIELDS } from '../../types';
import { fmtDate, r1 } from '../../ui/shared';
import { Icon } from '../common/Icon';
import { SegmentedControl } from '../common/SegmentedControl';
import { MeasuresHistoryMobileList } from './MeasuresHistoryMobileList';

type MeasureFieldDef = (typeof MEASURE_FIELDS)[number];
type MeasureGroupId = 'basic' | 'upper' | 'lower' | 'all';

const DESKTOP_COL_LABELS: Record<string, string> = {
  weight: 'Peso (kg)', bf: '% Grasa', muscle: 'Músculo (kg)', waist: 'Cintura',
  torso: 'Torso', shoulders: 'Hombros', glute: 'Glúteo',
  armL: 'Brazo izq.', armR: 'Brazo der.', thighL: 'Muslo izq.', thighR: 'Muslo der.',
  kneeL: 'Rodilla izq.', kneeR: 'Rodilla der.', calfL: 'Gemelo izq.', calfR: 'Gemelo der.',
};

const GROUPS: { id: MeasureGroupId; label: string; keys: (keyof Measure)[] }[] = [
  { id: 'basic', label: 'Básicos', keys: ['weight', 'bf', 'muscle', 'waist'] },
  { id: 'upper', label: 'Tren superior', keys: ['torso', 'shoulders', 'armL', 'armR'] },
  { id: 'lower', label: 'Tren inferior', keys: ['glute', 'thighL', 'thighR', 'kneeL', 'kneeR', 'calfL', 'calfR'] },
];

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
 * Historial cronológico inverso de mediciones corporales: lista desplegable en móvil
 * y tabla por grupos sin truncar con columna `Fecha` fija en escritorio.
 */
export function MeasuresHistoryTable({
  measuresDesc, totalMeasures, hasFilter, rangeLabel, tableCols, activeDate, onEditMeasure, onDeleteMeasure,
}: MeasuresHistoryTableProps) {
  const [group, setGroup] = useState<MeasureGroupId>('basic');

  const availableGroups = GROUPS.filter((g) => tableCols.some((c) => g.keys.includes(c.key)));
  const tabs: { id: MeasureGroupId; label: string }[] = availableGroups.length > 1
    ? [...availableGroups.map(({ id, label }) => ({ id, label })), { id: 'all', label: 'Todo' }]
    : availableGroups.map(({ id, label }) => ({ id, label }));

  const activeTab = tabs.some((t) => t.id === group) ? group : (tabs[0]?.id ?? 'all');
  const activeGroupDef = GROUPS.find((g) => g.id === activeTab);
  const desktopCols = activeTab === 'all' || !activeGroupDef
    ? tableCols
    : tableCols.filter((c) => activeGroupDef.keys.includes(c.key));

  return (
    <div class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-bold text-white tabular-nums">
          Historial de mediciones ({measuresDesc.length}{hasFilter ? ` de ${totalMeasures}` : ''})
        </h2>
        {measuresDesc.length > 0 && tabs.length > 1 && (
          <SegmentedControl
            role="radiogroup"
            options={tabs}
            value={activeTab}
            ariaLabel="Columnas del historial de mediciones"
            className="hidden md:inline-flex items-center gap-1 rounded-xl border border-white/10 bg-gray-900/70 p-1"
            buttonClassName="px-2.5 py-1 text-xs"
            onChange={setGroup}
          />
        )}
      </div>

      {measuresDesc.length > 0 ? (
        <>
          <MeasuresHistoryMobileList
            measuresDesc={measuresDesc}
            activeDate={activeDate}
            onEditMeasure={onEditMeasure}
            onDeleteMeasure={onDeleteMeasure}
          />
          <div class="relative hidden md:block overflow-x-auto">
            <table class="w-full text-right text-sm border-collapse">
              <thead class="text-xs uppercase text-gray-400">
                <tr>
                  <th scope="col" class="sticky left-0 z-10 bg-bgDark py-2 pr-3 text-left whitespace-nowrap border-r border-white/10">Fecha</th>
                  {desktopCols.map((f) => (
                    <th key={f.key} scope="col" class="px-2.5 py-2 whitespace-nowrap font-semibold" title={`${f.label} (${f.unit})`}>
                      {DESKTOP_COL_LABELS[f.key] ?? f.label}
                    </th>
                  ))}
                  <th scope="col" class="w-20 pl-2 whitespace-nowrap"><span class="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {measuresDesc.map((m) => {
                  const isActive = m.date === activeDate;
                  const stickyCls = isActive ? 'bg-cardDark border-l-2 border-l-electricBlue pl-2' : 'bg-bgDark';
                  return (
                    <tr key={m.date} class={`border-t border-gray-800 tabular-nums ${isActive ? 'bg-cardDark' : ''}`}>
                      <td class={`sticky left-0 z-10 py-2 pr-3 text-left font-medium text-gray-200 whitespace-nowrap border-r border-white/10 ${stickyCls}`}>
                        {fmtDate(m.date)}
                        {m.note && <div class="max-w-[14rem] truncate text-xs font-normal text-amberGold" title={m.note}>{m.note}</div>}
                      </td>
                      {desktopCols.map((f) => (
                        <td key={f.key} class="px-2.5 py-2 whitespace-nowrap font-medium text-gray-100 tabular-nums">
                          {typeof m[f.key] === 'number' ? r1(m[f.key] as number) : '—'}
                        </td>
                      ))}
                      <td class="pl-2 whitespace-nowrap">
                        <button type="button" class="icon-btn sm:h-8 sm:w-8 text-blue-300 hover:bg-electricBlue/15" aria-label={`Editar medición del ${fmtDate(m.date)}`} onClick={() => onEditMeasure(m.date)}><Icon name="edit" className="h-3.5 w-3.5" /></button>
                        <button type="button" class="icon-btn sm:h-8 sm:w-8 text-coralRed hover:bg-coralRed/10" aria-label={`Borrar medición del ${fmtDate(m.date)}`} onClick={() => onDeleteMeasure(m.date)}><Icon name="close" className="h-3.5 w-3.5" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p class="py-6 text-center text-sm text-gray-400">
          {totalMeasures > 0 ? `No hay mediciones en ${rangeLabel}.` : 'Todavía no hay mediciones guardadas.'}
        </p>
      )}
    </div>
  );
}
