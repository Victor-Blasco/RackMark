import { useState } from 'preact/hooks';
import { STATUS_LEGEND, type ExStats } from '../../lib/analysis';
import type { DayName } from '../../types';
import { short } from '../../ui/shared';
import { Collapsible } from '../common/Collapsible';
import { Icon } from '../common/Icon';
import { StatusInline } from '../common/StatusBadge';

/** Fila preparada del bloque de control de cargas. */
export interface LoadControlRow {
  d: DayName;
  c: string;
  e: ExStats;
  aiStatus?: string;
}

interface LoadControlSectionProps {
  /** Filas de ejercicios analizados agrupados por día de rutina. */
  rows: LoadControlRow[];
  /** Abre la vista de detalle de una rutina en un ejercicio concreto. */
  onOpenDetail: (day: DayName, exName: string) => void;
  /** Abre la vista `Registrar hecho`. */
  onGoLog: () => void;
}

/**
 * Sección inferior de `Resumen` con tabla de escritorio y listado móvil de progresión.
 */
export function LoadControlSection({ rows, onOpenDetail, onGoLog }: LoadControlSectionProps) {
  const [legendOpen, setLegendOpen] = useState(false);

  return (
    <section class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-1.5">
          <h2 class="text-base font-bold text-white">Control de cargas del bloque</h2>
          <button
            type="button"
            aria-expanded={legendOpen ? 'true' : 'false'}
            aria-controls="load-status-legend"
            aria-label="Qué significa cada estado"
            title="Qué significa cada estado"
            class={`inline-flex h-11 w-11 sm:h-7 sm:w-7 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${legendOpen ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
            onClick={() => setLegendOpen((v) => !v)}
          >
            <Icon name="info" className="h-4 w-4" />
          </button>
        </div>
        <button type="button" class="btn-sm btn-accent sm:text-sm" onClick={onGoLog}>+ Registrar entreno</button>
      </div>

      <Collapsible open={legendOpen} keepMounted>
        <div id="load-status-legend" class="grid grid-cols-1 gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs sm:grid-cols-2">
          {STATUS_LEGEND.map((item) => (
            <div key={item.label} class="flex items-start gap-2">
              <span class={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.dot}`} aria-hidden="true" />
              <p class="text-gray-300 leading-relaxed">
                <strong class="text-white">{item.label}:</strong> {item.desc}
              </p>
            </div>
          ))}
        </div>
      </Collapsible>

      {rows.length === 0 ? (
        <div class="border-t border-white/10 py-6 text-center space-y-2">
          <p class="text-sm text-gray-400">Todavía no hay ejercicios en el bloque actual para seguir su progresión.</p>
          <button type="button" class="btn-sm btn-accent" onClick={onGoLog}>+ Registrar primer entreno</button>
        </div>
      ) : (
        <>
          <div class="md:hidden divide-y divide-white/10">
            {rows.map(({ d, c, e, aiStatus }) => (
              <button
                key={`${d}|${e.name}`}
                type="button"
                class="w-full text-left py-3 space-y-1.5 rounded-xl px-1 -mx-1 hover:bg-white/[0.03] active:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue"
                onClick={() => onOpenDetail(d, e.name)}
              >
                <div class="flex items-center justify-between gap-2">
                  <div class="flex min-w-0 items-center gap-2">
                    <span style={{ color: c }} class="min-w-[3rem] max-w-[6.5rem] shrink-0 truncate text-xs font-extrabold uppercase tracking-wide">{d}</span>
                    <span class="truncate text-[15px] font-semibold text-white" title={e.name}>{e.name}</span>
                  </div>
                  <span class="shrink-0 rounded-md bg-white/[0.06] px-2 py-0.5 tabular-nums text-[13px] font-semibold text-gray-200">
                    {e.target ? `${e.target.sets}×${e.target.reps}` : '—'}
                  </span>
                </div>
                <div class="pl-1 tabular-nums text-sm font-medium text-gray-200 truncate">
                  {e.last ? `${short(e.last.date)} · ${e.last.sets.map((s) => `${s.w}×${s.r}`).join(' · ')}` : 'Sin registros'}
                </div>
                <div class="pl-1 pt-0.5 truncate"><StatusInline stats={e} aiStatus={aiStatus} /></div>
              </button>
            ))}
          </div>

          <div class="hidden md:block overflow-x-auto">
            <table class="table-fixed w-full text-left text-sm">
              <thead class="text-xs uppercase text-gray-400 border-b border-white/15">
                <tr>
                  <th class="w-[10%] py-2.5 pr-3">Día</th>
                  <th class="w-[26%] pr-3">Ejercicio</th>
                  <th class="w-[9%] pr-3 text-right">Obj.</th>
                  <th class="w-[11%] pr-3 text-right">Última</th>
                  <th class="w-[22%] pr-3">Series</th>
                  <th class="w-[22%]">Estado</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/10">
                {rows.map(({ d, c, e, aiStatus }) => {
                  const setsTxt = e.last ? e.last.sets.map((s) => `${s.w}×${s.r}`).join(' · ') : '';
                  return (
                    <tr
                      key={`${d}|${e.name}`}
                      class="cursor-pointer hover:bg-white/[0.03] transition-colors"
                      onClick={() => onOpenDetail(d, e.name)}
                    >
                      <td class="py-3 pr-3 truncate"><span style={{ color: c }} class="font-bold">{d}</span></td>
                      <td class="py-3 pr-3">
                        <button
                          type="button"
                          class="block w-full truncate text-left font-medium text-white hover:text-blue-300 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue"
                          title={e.name}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            onOpenDetail(d, e.name);
                          }}
                        >
                          {e.name}
                        </button>
                      </td>
                      <td class="py-3 pr-3 text-right tabular-nums text-sm font-medium text-gray-300">{e.target ? `${e.target.sets}×${e.target.reps}` : '—'}</td>
                      <td class="py-3 pr-3 text-right tabular-nums text-sm text-gray-300">{e.last ? short(e.last.date) : '—'}</td>
                      <td class="py-3 pr-3 tabular-nums text-sm font-medium text-gray-100 truncate" title={setsTxt}>{setsTxt || '—'}</td>
                      <td class="py-3 truncate" title={aiStatus ?? e.status}><StatusInline stats={e} aiStatus={aiStatus} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
