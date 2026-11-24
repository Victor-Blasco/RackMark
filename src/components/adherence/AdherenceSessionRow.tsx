import type { AdherenceSessionItem } from '../../store/adherenceSessions';
import type { DayName } from '../../types';
import { fmtDate, r1 } from '../../ui/shared';
import { Icon } from '../common/Icon';

interface AdherenceSessionRowProps {
  /** Sesión individual de fuerza o cardio. */
  item: AdherenceSessionItem;
  /** Abre una sesión de fuerza en la vista `Registrar hecho`. */
  onOpenStrengthSession: (sessionId: string, date: string, day: DayName | 'Libre') => void;
}

const sessionMeta = (item: AdherenceSessionItem): string => {
  const parts = item.kind === 'strength'
    ? [item.durMin ? `${Math.round(item.durMin)} min` : null, item.avgHr ? `${Math.round(item.avgHr)} lpm` : null, item.kcal ? `${Math.round(item.kcal)} kcal` : null]
    : [item.avgHr ? `${Math.round(item.avgHr)} lpm` : null, item.kcal ? `${Math.round(item.kcal)} kcal` : null, item.vo2 ? `VO2 ${r1(item.vo2)}` : null];
  return parts.filter(Boolean).join(' · ');
};

/** Fila compacta de sesión de fuerza o cardio en `Adherencia y bienestar`. */
export function AdherenceSessionRow({ item, onOpenStrengthSession }: AdherenceSessionRowProps) {
  const meta = sessionMeta(item);
  const title = item.kind === 'strength' ? item.day : 'Cardio';
  return (
    <div class="flex items-center justify-between gap-3 py-2.5 text-sm">
      <div class="min-w-0">
        <div class="flex items-center gap-2 min-w-0">
          <span class="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
          <span class="truncate font-semibold text-white">{title}</span>
          <span class="text-gray-400" aria-hidden="true">·</span>
          <span class="shrink-0 text-xs sm:text-sm text-gray-300 tabular-nums">{fmtDate(item.date)}</span>
        </div>
        {meta && (
          <p class="pl-[18px] text-xs text-gray-400 tabular-nums" title={item.kind === 'cardio' && item.vo2 ? 'VO2 máx: capacidad aeróbica estimada (más alto = mejor resistencia)' : undefined}>{meta}</p>
        )}
      </div>

      <div class="flex shrink-0 items-center gap-1.5">
        <span class="text-xs sm:text-sm font-semibold text-gray-100 tabular-nums whitespace-nowrap">
          {item.kind === 'strength'
            ? `${item.exCount} ej. · ${item.sets} ${item.sets === 1 ? 'serie' : 'series'}`
            : `${r1(item.durMin)} min · ${r1(item.distKm)} km`}
        </span>
        {item.kind === 'strength' && (
          <button
            type="button"
            class="icon-btn sm:h-8 sm:w-8 text-gray-400 hover:text-blue-300 hover:bg-electricBlue/15"
            aria-label={`Abrir sesión ${item.day} del ${fmtDate(item.date)} en Registrar hecho`}
            onClick={() => onOpenStrengthSession(item.id, item.date, item.routineKey)}
          >
            <Icon name="edit" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
