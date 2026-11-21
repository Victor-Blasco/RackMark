import {
  CARDIO_CALENDAR_COLOR,
  formatDayHeading,
  type CalendarDayActivity,
} from '../../store/adherenceCalendar';
import { r1 } from '../../ui/shared';

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
      <h3 class="text-sm font-bold text-white capitalize">{formatDayHeading(selectedIso)}</h3>
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
