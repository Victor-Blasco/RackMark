import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { MobileHeader } from '../components/layout/MobileHeader';
import { MobileBottomNav } from '../components/layout/MobileNav';
import { Sidebar } from '../components/layout/Sidebar';
import { calcRestTimerState } from '../hooks/useRestTimer';
import {
  ANALYTICS_IDS,
  ANALYTICS_TABS,
  FIXED_TAB_IDS,
  RESERVED_ROUTINE_NORMS,
  SYSTEM_IDS,
  SYSTEM_TABS,
  TAB_TITLES,
  TRAIN_TABS,
  activeTabTitle,
  isRoutineTab,
  isValidTab,
  syncStatusInfo,
} from '../store/navigation';
import type { DayName } from '../types';
import type { State } from './shared';

export {
  ANALYTICS_IDS,
  ANALYTICS_TABS,
  FIXED_TAB_IDS,
  RESERVED_ROUTINE_NORMS,
  SYSTEM_IDS,
  SYSTEM_TABS,
  TAB_TITLES,
  TRAIN_TABS,
  activeTabTitle,
  isRoutineTab,
  isValidTab,
  syncStatusInfo,
};

const noop = () => {};

/**
 * Renderiza la barra lateral de escritorio delegando en `<Sidebar />`.
 */
export function renderSidebar(
  S: State,
  statsText: string,
  liveCount: number,
  draftCount: number,
  unsynced: boolean,
): string {
  const restRemSec = calcRestTimerState(S.liveWorkout?.restUntil, S.liveWorkout?.targetRestSec).remSec;
  return renderToString(
    h(Sidebar, {
      state: S,
      statsText,
      liveCount,
      draftCount,
      unsynced,
      restRemSec,
      onSelectTab: noop,
      onCloudLogin: noop,
    }),
  );
}

/**
 * Renderiza la cabecera móvil superior delegando en `<MobileHeader />`.
 */
export function renderMobileHeader(S: State, statsText: string, unsynced: boolean): string {
  return renderToString(
    h(MobileHeader, {
      state: S,
      statsText,
      unsynced,
      onSelectTab: noop,
      onCloudLogin: noop,
    }),
  );
}

/**
 * Renderiza la barra inferior móvil delegando en `<MobileBottomNav />`.
 */
export function renderMobileNav(
  S: State,
  liveCount: number,
  draftCount: number,
  lastRoutine: DayName,
  lastAnalytics: string,
): string {
  const restRemSec = calcRestTimerState(S.liveWorkout?.restUntil, S.liveWorkout?.targetRestSec).remSec;
  return renderToString(
    h(MobileBottomNav, {
      state: S,
      liveCount,
      draftCount,
      lastRoutine,
      lastAnalytics,
      restRemSec,
      onSelectTab: noop,
    }),
  );
}
