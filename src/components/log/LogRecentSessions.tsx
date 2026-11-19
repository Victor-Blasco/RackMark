import type { Session } from '../../lib/analysis';
import type { DayName } from '../../types';
import { fmtDate, routineColor, type State } from '../../ui/shared';
import { Icon } from '../common/Icon';

interface LogRecentSessionsProps {
  /** Estado global con colores de rutina. */
  state: State;
  /** Lista ordenada de rutinas para resolver colores. */
  routines: string[];
  /** Últimas sesiones ya guardadas para cargar o borrar. */
  sessions: Session[];
  /** Carga una sesión existente en el editor actual. */
  onEditSession: (sessionId: string, date: string, day: DayName | 'Libre') => void;
  /** Elimina una sesión guardada previa confirmación. */
  onDeleteSession: (sessionId: string, date: string) => void;
}

/**
 * Listado histórico reciente para reabrir o eliminar sesiones desde `Registrar hecho`.
 */
export function LogRecentSessions({ state, routines, sessions, onEditSession, onDeleteSession }: LogRecentSessionsProps) {
  if (!sessions.length) return null;

  return (
    <div class="pt-5 border-t border-white/10 space-y-2">
      <h3 class="font-bold text-white">Últimas sesiones registradas</h3>
      <div class="grid grid-cols-1 gap-x-6 xl:grid-cols-2 divide-y divide-white/10 xl:divide-y-0">
        {sessions.map((s) => {
          const col = s.day ? routineColor(s.day, state.settings, Math.max(0, routines.indexOf(s.day))) : '#9CA3AF';
          const exSummary = s.exercises.join(', ');
          const day = (s.day ?? 'Libre') as DayName | 'Libre';
          return (
            <div key={s.id} class="flex items-center justify-between gap-3 py-2.5 xl:border-t xl:border-white/10 text-sm">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-baseline gap-x-1.5">
                  <span class="tabular-nums font-semibold text-white">{fmtDate(s.date)}</span>
                  <span class="font-bold" style={{ color: col }}>{s.day ?? 'Otro'}</span>
                  <span class="text-xs text-gray-400 tabular-nums">· {s.exercises.length} ej. · {s.sets} series</span>
                </div>
                <div class="text-xs text-gray-400 truncate" title={exSummary}>{exSummary}</div>
              </div>
              <div class="flex shrink-0 items-center gap-1.5">
                <button type="button" class="btn min-h-[44px] px-3 py-2 text-xs" onClick={() => onEditSession(s.id, s.date, day)}>
                  <Icon name="edit" className="h-3.5 w-3.5" />
                  <span class="hidden sm:inline">Cargar / Editar</span>
                  <span class="sm:hidden">Editar</span>
                </button>
                <button type="button" class="btn btn-danger min-h-[44px] min-w-[44px] px-2.5 py-2 text-xs" aria-label={`Borrar sesión del ${fmtDate(s.date)}`} title="Borrar sesión" onClick={() => onDeleteSession(s.id, s.date)}>
                  <Icon name="trash" className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
