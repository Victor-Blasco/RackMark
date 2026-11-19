import { fmtMMSS } from '../../hooks/useRestTimer';
import { ANALYTICS_IDS, isRoutineTab } from '../../store/navigation';
import type { DayName } from '../../types';
import type { State } from '../../ui/shared';
import { Icon } from '../common/Icon';

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
  /** Segundos restantes del descanso activo (0 si inactivo). */
  restRemSec?: number;
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
  restRemSec = 0,
  onSelectTab,
}: MobileBottomNavProps) {
  const inRoutine = isRoutineTab(state, state.tab);
  const inPlan = state.tab === 'plan';
  const inAnalytics = ANALYTICS_IDS.has(state.tab);
  const inTrain = state.tab === 'workout' || state.tab === 'log';
  const unmappedCount = state.analysis.unmapped.length;

  return (
    <nav aria-label="Navegación principal móvil" class="fixed inset-x-0 bottom-0 z-30 border-t border-borderDark bg-navDark px-1 pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div class="mx-auto grid max-w-lg grid-cols-5 items-center gap-0.5">
        <button type="button" aria-current={state.tab === 'home' ? 'page' : undefined} class={`bnav-item ${state.tab === 'home' ? 'bnav-item-on' : ''}`} onClick={() => onSelectTab('home')}>
          <Icon name="home" className="h-5 w-5" />
          <span>Resumen</span>
        </button>
        <button type="button" aria-current={inRoutine ? 'page' : undefined} class={`bnav-item ${inRoutine ? 'bnav-item-on' : ''}`} onClick={() => onSelectTab(lastRoutine)}>
          <Icon name="barbell" className="h-5 w-5" />
          <span>Rutinas</span>
        </button>
        <button type="button" aria-current={inTrain ? 'page' : undefined} class="bnav-item" onClick={() => onSelectTab('workout')}>
          <span class={`relative inline-flex items-center justify-center rounded-full ${restRemSec > 0 ? 'px-2.5' : 'px-3.5'} py-1 text-white shadow-sm bg-electricBlue ${inTrain ? 'ring-2 ring-blue-300/60' : ''}`}>
            <Icon name="play" className="h-4 w-4" />
            <span class={`ml-1 text-[10px] font-bold tabular-nums text-blue-100 ${restRemSec > 0 ? '' : 'hidden'}`}>
              {restRemSec > 0 ? fmtMMSS(restRemSec) : ''}
            </span>
            {(liveCount > 0 || state.liveWorkout != null || draftCount > 0) && (
              <span class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emeraldGreen ring-2 ring-navDark" />
            )}
          </span>
          <span class={inTrain ? 'text-blue-300' : 'text-gray-200'}>Entrenar</span>
        </button>
        <button type="button" aria-current={inPlan ? 'page' : undefined} class={`bnav-item ${inPlan ? 'bnav-item-on' : ''}`} onClick={() => onSelectTab('plan')}>
          <span class="relative inline-flex">
            <Icon name="edit" className="h-5 w-5" />
            {unmappedCount > 0 && <span class="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-amberGold ring-2 ring-navDark" />}
          </span>
          <span>Plan</span>
        </button>
        <button type="button" aria-current={inAnalytics ? 'page' : undefined} class={`bnav-item ${inAnalytics ? 'bnav-item-on' : ''}`} onClick={() => onSelectTab(lastAnalytics)}>
          <Icon name="chart" className="h-5 w-5" />
          <span>Análisis</span>
        </button>
      </div>
    </nav>
  );
}
