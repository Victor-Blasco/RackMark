import { useEffect, useState } from 'preact/hooks';
import type { AdherenceSessionFilter, AdherenceSessionItem } from '../../store/adherenceSessions';
import type { DayName } from '../../types';
import { AdherenceSessionRow } from './AdherenceSessionRow';

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
            {shown.map((item) => (
              <AdherenceSessionRow key={`${item.kind}-${item.id}`} item={item} onOpenStrengthSession={onOpenStrengthSession} />
            ))}
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
