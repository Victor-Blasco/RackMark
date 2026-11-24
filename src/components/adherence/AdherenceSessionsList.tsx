import { useEffect, useState } from 'preact/hooks';
import type { AdherenceSessionFilter, AdherenceSessionItem } from '../../store/adherenceSessions';
import type { DayName } from '../../types';
import { fmtDate, r1 } from '../../ui/shared';
import { Icon } from '../common/Icon';

interface AdherenceSessionsListProps {
  /** Sesiones combinadas de fuerza y cardio del periodo actual, ordenadas descendentemente. */
  sessions: AdherenceSessionItem[];
  /** Chips de filtro por rutina y cardio. */
  filters: AdherenceSessionFilter[];
  /** Etiqueta del rango temporal activo. */
  rangeLabel: string;
  /** Abre una sesión de fuerza en la vista `Registrar hecho` para revisarla o editarla. */
  onOpenStrengthSession: (sessionId: string, date: string, day: DayName | 'Libre') => void;
}

const PAGE_SIZE = 12;

function strengthMeta(item: Extract<AdherenceSessionItem, { kind: 'strength' }>): string {
  return [
    item.durMin ? `${Math.round(item.durMin)} min` : null,
    item.avgHr ? `${Math.round(item.avgHr)} lpm` : null,
    item.kcal ? `${Math.round(item.kcal)} kcal` : null,
  ].filter(Boolean).join(' · ');
}

function cardioMeta(item: Extract<AdherenceSessionItem, { kind: 'cardio' }>): string {
  return [
    item.avgHr ? `${Math.round(item.avgHr)} lpm` : null,
    item.kcal ? `${Math.round(item.kcal)} kcal` : null,
    item.vo2 ? `VO2 ${r1(item.vo2)}` : null,
  ].filter(Boolean).join(' · ');
}

/**
 * Lista filtrable y compacta de sesiones recientes (rutinas de fuerza y cardio) en `Adherencia`.
 */
export function AdherenceSessionsList({
  sessions,
  filters,
  rangeLabel,
  onOpenStrengthSession,
}: AdherenceSessionsListProps) {
  const [filterId, setFilterId] = useState('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [rangeLabel]);

  if (!sessions.length) return null;

  const activeFilter = filters.some((f) => f.id === filterId) ? filterId : 'all';
  const activeFilterLabel = filters.find((f) => f.id === activeFilter)?.label ?? 'este filtro';
  const filtered = sessions.filter((s) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'cardio') return s.kind === 'cardio';
    return s.kind === 'strength' && s.routineKey === activeFilter;
  });
  const shown = filtered.slice(0, visibleCount);
  const remaining = filtered.length - shown.length;

  return (
    <section class="space-y-3">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 class="font-bold text-white tabular-nums">Sesiones recientes ({filtered.length})</h2>
        <div role="radiogroup" aria-label="Filtrar sesiones recientes" class="flex items-center gap-1.5 overflow-x-auto no-scrollbar sm:flex-wrap pb-0.5">
          {filters.map((f) => {
            const checked = f.id === activeFilter;
            const cls = checked
              ? 'border-electricBlue bg-electricBlue/20 text-blue-200'
              : 'border-white/10 bg-gray-900/70 text-gray-300 hover:border-white/25 hover:text-white';
            return (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={checked ? 'true' : 'false'}
                tabIndex={checked ? 0 : -1}
                class={`min-h-[44px] sm:min-h-[34px] shrink-0 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${cls}`}
                onClick={() => {
                  setFilterId(f.id);
                  setVisibleCount(PAGE_SIZE);
                }}
              >
                {f.color && <span class="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: f.color }} aria-hidden="true" />}
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {shown.length > 0 ? (
        <>
          <div class="divide-y divide-white/10">
            {shown.map((item) => {
              const meta = item.kind === 'strength' ? strengthMeta(item) : cardioMeta(item);
              const title = item.kind === 'strength' ? item.day : 'Cardio';
              return (
                <div key={`${item.kind}-${item.id}`} class="flex items-center justify-between gap-3 py-2.5 text-sm">
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
            })}
          </div>
          {remaining > 0 && (
            <div class="flex justify-center pt-1">
              <button type="button" class="btn min-h-[44px] w-full sm:w-auto text-xs tabular-nums" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                Ver más ({remaining} restantes)
              </button>
            </div>
          )}
        </>
      ) : (
        <p class="py-4 text-center text-xs text-gray-400">
          No hay sesiones de {activeFilterLabel} en {rangeLabel}.
        </p>
      )}
    </section>
  );
}
