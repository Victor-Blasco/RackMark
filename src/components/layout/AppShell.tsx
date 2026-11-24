import { useAppStore } from '../../store/appStore';
import { activeTabTitle, buildShellCounters, isRoutineTab } from '../../store/navigation';
import type { State } from '../../ui/shared';
import { AdherenceView } from '../../views/AdherenceView';
import { BodyView } from '../../views/BodyView';
import { CalcView } from '../../views/CalcView';
import { DataView } from '../../views/DataView';
import { DayRoutineView } from '../../views/DayRoutineView';
import { HomeView } from '../../views/HomeView';
import { LiveWorkoutView } from '../../views/LiveWorkoutView';
import { LogWorkoutView } from '../../views/LogWorkoutView';
import { PlanView } from '../../views/PlanView';
import { SettingsView } from '../../views/SettingsView';
import { VolumeView } from '../../views/VolumeView';
import { SwUpdateBanner, ToastBanner } from '../common/ToastBanner';
import { ModalHost } from '../modals/ModalHost';
import { MobileBottomNav, MobileHeader } from './MobileNav';
import { RestTimerWatcher } from './RestTimerPill';
import { Sidebar } from './Sidebar';

interface AppShellProps {
  /** Se ejecuta una vez cuando el temporizador global de descanso llega a cero. */
  onRestExpire?: () => void;
}

function renderActiveView(state: State) {
  if (isRoutineTab(state, state.tab)) return <DayRoutineView day={state.tab} />;
  switch (state.tab) {
    case 'workout': return <LiveWorkoutView />;
    case 'log': return <LogWorkoutView />;
    case 'plan': return <PlanView />;
    case 'body': return <BodyView />;
    case 'volume': return <VolumeView />;
    case 'adherence': return <AdherenceView />;
    case 'calc': return <CalcView />;
    case 'data': return <DataView />;
    case 'settings': return <SettingsView />;
    default: return <HomeView />;
  }
}

/**
 * Contenedor raíz de la aplicación en Preact: navegación adaptable, vistas activas, modales y avisos.
 */
export function AppShell({ onRestExpire }: AppShellProps) {
  const store = useAppStore();
  const { state } = store;

  const { statsText, liveCount, draftCount } = buildShellCounters(state);
  const restUntil = state.liveWorkout?.restUntil;
  const targetRestSec = state.liveWorkout?.targetRestSec;

  return (
    <>
      <RestTimerWatcher restUntil={restUntil} onExpire={onRestExpire} />
      <Sidebar
        state={state}
        statsText={statsText}
        liveCount={liveCount}
        draftCount={draftCount}
        unsynced={store.unsynced}
        restUntil={restUntil}
        targetRestSec={targetRestSec}
        onSelectTab={store.setTab}
        onSelectPlanTab={store.plan.openPlanTab}
        onNewRoutine={store.plan.openRoutineModalNew}
        onCloudLogin={store.cloudLogin}
      />
      <MobileHeader
        state={state}
        statsText={statsText}
        unsynced={store.unsynced}
        onSelectTab={store.setTab}
        onSelectPlanTab={store.plan.openPlanTab}
        onCloudLogin={store.cloudLogin}
      />
      <div class="lg:pl-64">
        <main id="main-content" tabIndex={-1} class="w-full space-y-4 p-2.5 pb-28 sm:p-5 lg:px-7 lg:py-6 xl:px-10 lg:pb-10 focus:outline-none">
          {['home', 'calc', 'settings'].includes(state.tab) && (
            <h1 class="sr-only lg:not-sr-only lg:block text-lg font-extrabold text-white">{activeTabTitle(state)}</h1>
          )}
          {renderActiveView(state)}
        </main>
      </div>
      <MobileBottomNav
        state={state}
        liveCount={liveCount}
        draftCount={draftCount}
        lastRoutine={store.lastRoutine}
        lastAnalytics={store.lastAnalytics}
        restUntil={restUntil}
        targetRestSec={targetRestSec}
        onSelectTab={store.setTab}
      />
      <ModalHost />
      <ToastBanner message={state.toast} action={state.toastAction} />
      <SwUpdateBanner
        visible={store.swUpdatePending}
        onDismiss={store.dismissSwUpdate}
        onReload={store.reloadSwUpdate}
      />
    </>
  );
}
