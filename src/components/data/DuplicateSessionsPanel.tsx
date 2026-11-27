import type { DuplicateSessionGroup, DuplicateSessionItem } from '../../lib/dedupSessions';
import { fmtDate } from '../../ui/shared';

interface DuplicateSessionsPanelProps {
  /** Grupos de días con 2 o más sesiones de la misma rutina. */
  groups: DuplicateSessionGroup[];
  /** Conserva la sesión elegida y elimina las copias duplicadas de ese día. */
  onKeepSession: (sessions: DuplicateSessionItem[], keepId: string) => void;
}

/**
 * Panel puntual en `Datos` para resolver días con sesiones duplicadas en 1 toque.
 */
export function DuplicateSessionsPanel({ groups, onKeepSession }: DuplicateSessionsPanelProps) {
  if (!groups.length) return null;

  return (
    <section class="rounded-2xl border border-amberGold/40 bg-amberGold/5 p-4 space-y-3" aria-label="Sesiones duplicadas detectadas">
      <div>
        <h2 class="text-sm font-bold text-amberGold">
          {groups.length === 1
            ? '1 día con sesiones duplicadas'
            : `${groups.length} días con sesiones duplicadas`}
        </h2>
        <p class="text-xs text-gray-300 mt-0.5">
          Elige qué sesión quieres conservar en cada fecha (las copias sobrantes se borrarán conservando el pulso del reloj si hace falta).
        </p>
      </div>

      <div class="divide-y divide-white/10">
        {groups.map((g) => (
          <div key={g.key} class="py-3 space-y-2">
            <div class="text-xs font-bold text-white">
              {g.day} · <span class="tabular-nums text-gray-300">{fmtDate(g.date)}</span>
            </div>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {g.sessions.map((s) => {
                const meta = [
                  s.durMin != null ? `${Math.round(s.durMin)} min` : null,
                  s.avgHr != null ? `${s.avgHr} lpm` : null,
                  s.kcal != null ? `${s.kcal} kcal` : null,
                ].filter(Boolean).join(' · ');
                return (
                  <div key={s.id} class="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-bgDark/60 px-3 py-2">
                    <div class="min-w-0">
                      <div class="text-xs font-bold text-white tabular-nums">
                        {s.exerciseCount} ej. · {s.sets} series
                      </div>
                      <div class="text-[11px] text-gray-400 tabular-nums truncate">
                        {meta || 'Sin telemetría de reloj'}
                      </div>
                    </div>
                    <button
                      type="button"
                      class="btn-sm min-h-[44px] sm:min-h-[34px] shrink-0 border-electricBlue/50 text-blue-300 hover:border-electricBlue"
                      onClick={() => onKeepSession(g.sessions, s.id)}
                    >
                      Conservar esta
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
