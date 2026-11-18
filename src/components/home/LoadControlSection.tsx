import type { ExStats } from '../../lib/analysis';
import type { DayName } from '../../types';
import { short } from '../../ui/shared';
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
  const onRowKeyDown = (e: KeyboardEvent, day: DayName, name: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpenDetail(day, name);
    }
  };

  return (
    <section class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-base font-bold text-white">Control de cargas del bloque</h2>
        <button type="button" class="btn-primary-sm sm:text-sm" data-act="goLog" onClick={onGoLog}>+ Registrar entreno</button>
      </div>

      <div class="md:hidden divide-y divide-white/10">
        {rows.map(({ d, c, e, aiStatus }) => (
          <div
            key={`${d}|${e.name}`}
            data-act="openExDetail"
            data-arg={`${d}|${e.name}`}
            role="button"
            tabIndex={0}
            class="py-3 space-y-1.5 cursor-pointer rounded-xl px-1 -mx-1 hover:bg-white/[0.03] active:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue"
            onClick={() => onOpenDetail(d, e.name)}
            onKeyDown={(ev) => onRowKeyDown(ev, d, e.name)}
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
          </div>
        ))}
      </div>

      <div class="hidden md:block overflow-x-auto">
        <table class="table-fixed w-full text-left text-sm">
          <thead class="text-xs uppercase text-gray-400 border-b border-white/15">
            <tr>
              <th class="w-20 py-2.5 pr-3">Día</th>
              <th class="w-[28%] pr-3">Ejercicio</th>
              <th class="w-16 pr-3 text-right">Obj.</th>
              <th class="w-24 pr-3 text-right">Última</th>
              <th class="w-[26%] pr-3">Series</th>
              <th class="w-[26%]">Estado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/10">
            {rows.map(({ d, c, e, aiStatus }) => {
              const setsTxt = e.last ? e.last.sets.map((s) => `${s.w}×${s.r}`).join(' · ') : '';
              return (
                <tr
                  key={`${d}|${e.name}`}
                  data-act="openExDetail"
                  data-arg={`${d}|${e.name}`}
                  role="button"
                  tabIndex={0}
                  class="cursor-pointer hover:bg-white/[0.03] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue"
                  onClick={() => onOpenDetail(d, e.name)}
                  onKeyDown={(ev) => onRowKeyDown(ev, d, e.name)}
                >
                  <td class="py-3 pr-3 truncate"><span style={{ color: c }} class="font-bold">{d}</span></td>
                  <td class="py-3 pr-3 font-medium text-white truncate" title={e.name}>{e.name}</td>
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
    </section>
  );
}
