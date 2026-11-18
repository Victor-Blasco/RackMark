import type { CardioRow, Settings } from '../../types';
import { fmtDate, r1, routineColor, routineShort } from '../../ui/shared';

interface AdherenceCell {
  iso: string;
  bg: string;
  label: string;
  code: string;
}

interface AdherenceCalendarProps {
  /** Semanas ISO completas visibles en escritorio. */
  cols: string[];
  /** Últimas 8 semanas visibles en móvil. */
  mobCols: string[];
  /** Rutinas activas para la leyenda de color. */
  routines: string[];
  /** Ajustes con metadatos de color de rutinas. */
  settings: Settings;
  /** Genera los datos de celda para una semana e índice de día (0–6). */
  buildCell: (weekIso: string, dayIdx: number) => AdherenceCell;
}

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/**
 * Matriz heatmap semanal de entrenamientos con leyenda por rutina.
 */
export function AdherenceCalendar({ cols, mobCols, routines, settings, buildCell }: AdherenceCalendarProps) {
  const renderColumns = (list: string[]) => (
    <>
      <div class="flex flex-col gap-1.5 pr-1 text-[10px] text-gray-400">
        {WEEKDAYS.map((d) => <div key={d} class="flex h-5 items-center">{d}</div>)}
      </div>
      {list.map((w) => (
        <div key={w} class="flex flex-col gap-1.5">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => {
            const c = buildCell(w, i);
            return (
              <div
                key={c.iso}
                role="img"
                aria-label={c.label}
                title={c.label}
                class="flex h-5 min-w-[20px] px-0.5 items-center justify-center rounded-[4px] text-[9px] font-extrabold text-white/95"
                style={{ background: c.bg }}
              >
                {c.code}
              </div>
            );
          })}
        </div>
      ))}
    </>
  );

  return (
    <div class="pb-5 border-b border-white/10 space-y-2">
      <h3 class="mb-2 font-bold text-white">
        Calendario (<span class="hidden md:inline">últimas {cols.length}</span>
        <span class="md:hidden">últimas {mobCols.length}</span> semanas)
      </h3>
      <div class="hidden md:flex gap-1.5 overflow-x-auto">{renderColumns(cols)}</div>
      <div class="flex md:hidden gap-1.5">{renderColumns(mobCols)}</div>
      <div class="mt-3 flex flex-wrap gap-3 text-xs text-gray-400">
        {routines.map((d, idx) => (
          <span key={d} class="inline-flex items-center gap-1">
            <span
              class="inline-flex h-4 min-w-[16px] px-0.5 items-center justify-center rounded text-[9px] font-extrabold text-white"
              style={{ background: routineColor(d, settings, idx) }}
            >
              {routineShort(d)}
            </span>
            {d}
          </span>
        ))}
        <span class="inline-flex items-center gap-1">
          <span class="inline-flex h-4 w-4 items-center justify-center rounded bg-gray-500 text-[9px] font-extrabold text-white">·</span>
          Otro
        </span>
      </div>
    </div>
  );
}

interface CardioSessionsTableProps {
  /** Total de sesiones de cardio registradas en el periodo. */
  totalCount: number;
  /** Últimas 12 sesiones ordenadas cronológicamente inversa. */
  recentCardio: CardioRow[];
}

/**
 * Tabla resumida de las sesiones de cardio más recientes del rango seleccionado.
 */
export function CardioSessionsTable({ totalCount, recentCardio }: CardioSessionsTableProps) {
  if (!totalCount) return null;

  return (
    <div class="space-y-2 overflow-x-auto">
      <h3 class="mb-2 font-bold text-white">Sesiones de cardio ({totalCount})</h3>
      <table class="w-full text-left text-sm">
        <thead class="text-xs uppercase text-gray-400">
          <tr>
            <th class="py-2 pr-3">Fecha</th>
            <th class="pr-3 text-right">Duración</th>
            <th class="pr-3 text-right">Distancia</th>
            <th class="pr-3 text-right">FC media</th>
            <th class="pr-3 text-right">Kcal</th>
            <th class="text-right">VO2 máx</th>
          </tr>
        </thead>
        <tbody>
          {recentCardio.map((c) => (
            <tr key={c.id} class="border-t border-gray-800 tabular-nums font-medium">
              <td class="py-2 pr-3 text-gray-200">{fmtDate(c.date)}</td>
              <td class="pr-3 text-right text-gray-100">{r1(c.durMin)} min</td>
              <td class="pr-3 text-right text-gray-100">{r1(c.distKm)} km</td>
              <td class="pr-3 text-right text-cyan-300">{c.avgHr ? `${Math.round(c.avgHr)} lpm` : '—'}</td>
              <td class="pr-3 text-right text-gray-100">{c.kcal || '—'}</td>
              <td class="text-right text-emeraldGreen">{c.vo2 ? r1(c.vo2) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
