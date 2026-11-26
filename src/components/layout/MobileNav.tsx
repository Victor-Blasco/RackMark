import { ANALYTICS_IDS, isRoutineTab } from '../../store/navigation';
import type { DayName } from '../../types';
import type { State } from '../../ui/shared';
import { Icon } from '../common/Icon';
import { RestTimerBadge } from './RestTimerPill';

export { MobileHeader } from './MobileHeader';

interface MobileBottomNavProps {
  /** Estado global de la aplicación. */
  state: State;
  /** Series completadas en la sesión en vivo. */
  liveCount: number;
  /** Ejercicios con series marcadas en `Registrar hecho`. */
  draftCount: number;
  /** Última rutina visitada para el acceso rápido `Rutinas`. */
  lastRoutine: DayName;
  /** Última subpestaña de análisis visitada. */
  lastAnalytics: string;
  /** Marca temporal objetivo del descanso activo para reloj local sin re-renders globales. */
  restUntil?: number;
  /** Duración objetivo del descanso activo en segundos. */
  targetRestSec?: number;
  /** Callback al seleccionar una pestaña en la barra inferior. */
  onSelectTab: (tab: string) => void;
}

/**
 * Barra inferior fija de navegación en móvil orientada al alcance del pulgar.
 */
export function MobileBottomNav({
  state,
  liveCount,
  draftCount,
  lastRoutine,
  lastAnalytics,
  restUntil,
  targetRestSec,
  onSelectTab,
}: MobileBottomNavProps) {
  const inRoutine = isRoutineTab(state, state.tab) || state.tab === 'plan';
  const inAnalytics = ANALYTICS_IDS.has(state.tab);
  const inTrain = state.tab === 'workout' || state.tab === 'log';
  const unmappedCount = state.analysis.unmapped.length;

  return (
    <nav aria-label="Navegación principal móvil" class="fixed inset-x-0 bottom-0 z-30 border-t border-borderDark bg-navDark px-1 pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div class="mx-auto grid max-w-lg grid-cols-4 items-center gap-0.5">
        <button type="button" aria-current={state.tab === 'home' ? 'page' : undefined} class={`bnav-item ${state.tab === 'home' ? 'bnav-item-on' : ''}`} onClick={() => onSelectTab('home')}>
          <Icon name="home" className="h-5 w-5" />
          <span>Resumen</span>
        </button>
        <button type="button" aria-current={inRoutine ? 'page' : undefined} class={`bnav-item ${inRoutine ? 'bnav-item-on' : ''}`} onClick={() => onSelectTab(lastRoutine)}>
          <span class="relative inline-flex">
            <Icon name="barbell" className="h-5 w-5" />
            {unmappedCount > 0 && <span class="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-amberGold ring-2 ring-navDark" />}
          </span>
          <span>Rutinas</span>
        </button>
        <button type="button" aria-current={inTrain ? 'page' : undefined} class="bnav-item" onClick={() => onSelectTab('workout')}>
          <span class={`relative inline-flex items-center justify-center rounded-full px-3 py-1 text-white shadow-sm bg-electricBlue ${inTrain ? 'ring-2 ring-blue-300/60' : ''}`}>
            <Icon name="play" className="h-4 w-4" />
            <RestTimerBadge restUntil={restUntil} targetRestSec={targetRestSec} className="ml-1 text-[10px] font-bold tabular-nums" />
            {(liveCount > 0 || state.liveWorkout != null || draftCount > 0) && (
              <span class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emeraldGreen ring-2 ring-navDark" />
            )}
          </span>
          <span class={inTrain ? 'text-blue-300' : 'text-gray-200'}>Entrenar</span>
        </button>
        <button type="button" aria-current={inAnalytics ? 'page' : undefined} class={`bnav-item ${inAnalytics ? 'bnav-item-on' : ''}`} onClick={() => onSelectTab(lastAnalytics)}>
          <Icon name="chart" className="h-5 w-5" />
          <span>Análisis</span>
        </button>
      </div>
    </nav>
  );
}
