import {
  CARDIO_CALENDAR_COLOR,
  formatDayHeading,
  type CalendarDayActivity,
} from '../../store/adherenceCalendar';
import type { CardioRow } from '../../types';
import { fmtDate, r1 } from '../../ui/shared';

export { AdherenceCalendar } from './AdherenceCalendar';

interface AdherenceDayDetailProps {
  /** Fecha ISO seleccionada actualmente en el calendario. */
  selectedIso: string;
  /** Actividad agrupada de fuerza y cardio para esa fecha (o `undefined`). */
  dayAct?: CalendarDayActivity;
}

/** Panel lateral/inferior con el desglose de sesiones de fuerza y cardio del día seleccionado. */
export function AdherenceDayDetail({ selectedIso, dayAct }: AdherenceDayDetailProps) {
  return (
    <div class="lg:col-span-5 border-t border-white/10 pt-3 lg:border-t-0 lg:border-l lg:border-white/10 lg:pl-5 lg:pt-0 space-y-2.5">
      <h4 class="text-sm font-bold text-white capitalize">{formatDayHeading(selectedIso)}</h4>
      {dayAct ? (
        <div class="divide-y divide-white/10">
          {dayAct.strength.map((s, idx) => (
            <div key={`${s.day}-${idx}`} class="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div class="flex min-w-0 items-center gap-2.5">
                <span class="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden="true" />
                <div class="min-w-0">
                  <p class="truncate font-semibold text-white">{s.day}</p>
                  <p class="text-xs text-gray-400 tabular-nums">
                    {s.sets} {s.sets === 1 ? 'serie' : 'series'}{s.avgHr ? ` · ${Math.round(s.avgHr)} lpm` : ''}
                  </p>
                </div>
              </div>
              <div class="shrink-0 text-right tabular-nums text-xs text-gray-300">
                {s.durMin ? <p class="font-semibold">{Math.round(s.durMin)} min</p> : null}
                {s.kcal ? <p class="text-gray-400">{Math.round(s.kcal)} kcal</p> : null}
              </div>
            </div>
          ))}
          {dayAct.cardio.map((c, idx) => (
            <div key={`cardio-${idx}`} class="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div class="flex min-w-0 items-center gap-2.5">
                <span class="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: CARDIO_CALENDAR_COLOR }} aria-hidden="true" />
                <div class="min-w-0">
                  <p class="font-semibold text-white">Cardio</p>
                  <p class="text-xs text-gray-400 tabular-nums">
                    {r1(c.distKm)} km{c.avgHr ? ` · ${Math.round(c.avgHr)} lpm` : ''}
                  </p>
                </div>
              </div>
              <div class="shrink-0 text-right tabular-nums text-xs text-gray-300">
                <p class="font-semibold">{Math.round(c.durMin)} min</p>
                {c.kcal ? <p class="text-gray-400">{Math.round(c.kcal)} kcal</p> : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p class="py-3 text-xs text-gray-400">Sin entrenamientos registrados este día.</p>
      )}
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
      <h3 class="mb-2 font-bold text-white tabular-nums">Sesiones de cardio ({totalCount})</h3>
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
