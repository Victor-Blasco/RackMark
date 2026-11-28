import { lazy, Suspense } from 'preact/compat';
import { useAppStore } from '../../store/appStore';
import { activeTabTitle, buildShellCounters, isRoutineTab } from '../../store/navigation';
import type { State } from '../../ui/shared';
import { HomeView } from '../../views/HomeView';
import { LiveWorkoutView } from '../../views/LiveWorkoutView';
import { SwUpdateBanner, ToastBanner } from '../common/ToastBanner';
import { MobileBottomNav, MobileHeader } from './MobileNav';
import { RestTimerWatcher } from './RestTimerPill';
import { Sidebar } from './Sidebar';

const AdherenceView = lazy(() => import('../../views/AdherenceView').then((m) => ({ default: m.AdherenceView })));
const BodyView = lazy(() => import('../../views/BodyView').then((m) => ({ default: m.BodyView })));
const CalcView = lazy(() => import('../../views/CalcView').then((m) => ({ default: m.CalcView })));
const DataView = lazy(() => import('../../views/DataView').then((m) => ({ default: m.DataView })));
const DayRoutineView = lazy(() => import('../../views/DayRoutineView').then((m) => ({ default: m.DayRoutineView })));
const LogWorkoutView = lazy(() => import('../../views/LogWorkoutView').then((m) => ({ default: m.LogWorkoutView })));
const PlanView = lazy(() => import('../../views/PlanView').then((m) => ({ default: m.PlanView })));
const SettingsView = lazy(() => import('../../views/SettingsView').then((m) => ({ default: m.SettingsView })));
const VolumeView = lazy(() => import('../../views/VolumeView').then((m) => ({ default: m.VolumeView })));
const ModalHost = lazy(() => import('../modals/ModalHost').then((m) => ({ default: m.ModalHost })));

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
    case 'phases': return <PlanView forcedTab="phases" />;
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
  const restPausedRemSec = state.liveWorkout?.restPausedRemSec;
  const targetRestSec = state.liveWorkout?.targetRestSec;
  const hasAnyModal = Boolean(state.activeModal);

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
          {state.demoMode && (
            <div class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-electricBlue/35 bg-electricBlue/10 px-3 py-2 text-xs">
              <span class="text-blue-200">
                <strong class="font-bold">Modo demo interactivo</strong> · Datos de ejemplo en memoria (no modifica tu cuenta).
              </span>
              <button type="button" class="btn-sm min-h-[36px]" onClick={store.exitDemoMode}>
                Salir de demo
              </button>
            </div>
          )}
          {['home', 'calc', 'settings'].includes(state.tab) && (
            <h1 class="sr-only lg:not-sr-only lg:block text-lg font-extrabold text-white">{activeTabTitle(state)}</h1>
          )}
          <Suspense fallback={<div class="py-12 text-center text-xs text-gray-400">Cargando vista…</div>}>
            {renderActiveView(state)}
          </Suspense>
        </main>
      </div>
      <MobileBottomNav
        state={state}
        liveCount={liveCount}
        draftCount={draftCount}
        lastRoutine={store.lastRoutine}
        lastAnalytics={store.lastAnalytics}
        restUntil={restUntil}
        restPausedRemSec={restPausedRemSec}
        targetRestSec={targetRestSec}
        onSelectTab={store.setTab}
      />
      {hasAnyModal && (
        <Suspense fallback={null}>
          <ModalHost />
        </Suspense>
      )}
      <ToastBanner message={state.toast} action={state.toastAction} />
      <SwUpdateBanner
        visible={store.swUpdatePending}
        onDismiss={store.dismissSwUpdate}
        onReload={store.reloadSwUpdate}
      />
    </>
  );
}
