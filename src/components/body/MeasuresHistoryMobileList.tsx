import { useState } from 'preact/hooks';
import { PERIM_ALL_KEYS, PERIM_GROUPS } from '../../store/bodyChartConfigs';
import { BASIC_MEASURE_KEYS, MEASURE_FIELDS, type Measure } from '../../types';
import { fmtDate, r1 } from '../../ui/shared';
import { Collapsible } from '../common/Collapsible';
import { Icon } from '../common/Icon';

interface MeasuresHistoryMobileListProps {
  /** Mediciones del rango ya ordenadas cronológicamente de más reciente a más antigua. */
  measuresDesc: Measure[];
  /** Fecha actualmente cargada en el formulario de edición para destacarla. */
  activeDate: string;
  /** Carga una medición en el formulario superior. */
  onEditMeasure: (date: string) => void;
  /** Elimina una medición previa confirmación. */
  onDeleteMeasure: (date: string) => void;
}

const BASIC_SHORT: Record<string, string> = {
  weight: 'Peso',
  bf: '% Grasa',
  muscle: 'Músculo',
  waist: 'Cintura',
};

const FIELD_BY_KEY = new Map(MEASURE_FIELDS.map((f) => [f.key, f]));

/**
 * Lista móvil legible para el historial de mediciones con métricas básicas etiquetadas
 * y acordeón expandible por fecha para los perímetros detallados.
 */
export function MeasuresHistoryMobileList({
  measuresDesc,
  activeDate,
  onEditMeasure,
  onDeleteMeasure,
}: MeasuresHistoryMobileListProps) {
  const [openDates, setOpenDates] = useState<Record<string, boolean>>({});

  const toggleDate = (date: string) =>
    setOpenDates((prev) => ({ ...prev, [date]: !prev[date] }));

  return (
    <div class="md:hidden divide-y divide-white/10">
      {measuresDesc.map((m) => {
        const basics = BASIC_MEASURE_KEYS.filter((k) => m[k] != null);
        const perimCount = PERIM_ALL_KEYS.filter((k) => m[k] != null).length;
        const isOpen = Boolean(openDates[m.date]);
        const isActive = m.date === activeDate;
        const panelId = `perim-row-${m.date}`;

        return (
          <div key={m.date} class={`py-3 space-y-2.5 ${isActive ? 'border-l-2 border-electricBlue pl-2.5' : ''}`}>
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <span class="font-semibold text-white tabular-nums">{fmtDate(m.date)}</span>
                {m.note && <p class="text-xs text-amberGold break-words">{m.note}</p>}
              </div>
              <div class="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  class="icon-btn text-blue-300 hover:bg-electricBlue/15"
                  aria-label={`Editar medición del ${fmtDate(m.date)}`}
                  onClick={() => onEditMeasure(m.date)}
                >
                  <Icon name="edit" className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  class="icon-btn text-coralRed hover:bg-coralRed/10"
                  aria-label={`Borrar medición del ${fmtDate(m.date)}`}
                  onClick={() => onDeleteMeasure(m.date)}
                >
                  <Icon name="close" className="h-4 w-4" />
                </button>
              </div>
            </div>

            {basics.length > 0 && (
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2">
                {basics.map((k) => {
                  const f = FIELD_BY_KEY.get(k);
                  const val = m[k];
                  if (!f || typeof val !== 'number') return null;
                  return (
                    <div key={k}>
                      <span class="block text-[11px] uppercase text-gray-400">{BASIC_SHORT[k] ?? f.label}</span>
                      <span class="text-sm font-bold text-gray-100 tabular-nums">{r1(val)} {f.unit}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {perimCount > 0 && (
              <div>
                <button
                  type="button"
                  aria-expanded={isOpen ? 'true' : 'false'}
                  aria-controls={panelId}
                  class="min-h-[44px] inline-flex items-center gap-1.5 text-xs font-semibold text-blue-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue rounded"
                  onClick={() => toggleDate(m.date)}
                >
                  <span>{isOpen ? 'Ocultar perímetros' : `Ver perímetros (${perimCount})`}</span>
                  <Icon name="caretDown" className={`h-3.5 w-3.5 transition-transform duration-200 motion-reduce:transition-none ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                <Collapsible id={panelId} open={isOpen} keepMounted>
                  <div class="pt-1 pb-1.5 space-y-2.5 border-t border-white/[0.06]">
                    {PERIM_GROUPS.map((g) => {
                      const items = g.keys.filter((k) => typeof m[k] === 'number');
                      if (!items.length) return null;
                      return (
                        <div key={g.title} class="space-y-1">
                          <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{g.title}</p>
                          <div class="grid grid-cols-2 gap-x-4 gap-y-1.5">
                            {items.map((k) => {
                              const f = FIELD_BY_KEY.get(k);
                              const val = m[k];
                              if (!f || typeof val !== 'number') return null;
                              return (
                                <div key={k} class="flex items-baseline justify-between gap-2 text-xs">
                                  <span class="text-gray-400">{f.label}</span>
                                  <span class="font-semibold text-gray-100 tabular-nums shrink-0">{r1(val)} {f.unit}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Collapsible>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
