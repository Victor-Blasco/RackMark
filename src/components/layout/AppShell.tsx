import { useRestTimer } from '../../hooks/useRestTimer';
import { useAppStore } from '../../store/appStore';
import { activeTabTitle } from '../../store/navigation';
import { LiveWorkoutView } from '../../views/LiveWorkoutView';
import { SwUpdateBanner, ToastBanner } from '../common/ToastBanner';
import { ModalHost } from '../modals/ModalHost';
import { LegacyViewBridge } from './LegacyViewBridge';
import { MobileBottomNav, MobileHeader } from './MobileNav';
import { Sidebar } from './Sidebar';

interface AppShellProps {
  /** Se ejecuta una vez cuando el temporizador global de descanso llega a cero. */
  onRestExpire?: () => void;
}

/**
 * Contenedor raíz de la aplicación: navega entre la vista piloto Preact (`En vivo`)
 * y el puente temporal para vistas pendientes, junto con navegación, modales y avisos.
 */
export function AppShell({ onRestExpire }: AppShellProps) {
  const store = useAppStore();
  const { state } = store;

  const rest = useRestTimer(state.liveWorkout?.restUntil, state.liveWorkout?.targetRestSec, onRestExpire);
  const statsText = state.strength.length
    ? `${state.analysis.sessions.length} sesiones · ${state.measures.length} medidas`
    : 'Sin sesiones aún';
  const liveCount = state.liveWorkout?.exercises.reduce(
    (acc, e) => acc + e.sets.filter((s) => s.done && s.r > 0).length,
    0,
  ) ?? 0;
  const draftCount = state.logDraft?.exercises.filter((e) => e.sets.some((s) => s.done && s.r > 0)).length ?? 0;

  return (
    <>
      <Sidebar
        state={state}
        statsText={statsText}
        liveCount={liveCount}
        draftCount={draftCount}
        unsynced={store.unsynced}
        restRemSec={rest.remSec}
        onSelectTab={store.setTab}
        onCloudLogin={store.cloudLogin}
      />
      <MobileHeader
        state={state}
        statsText={statsText}
        unsynced={store.unsynced}
        onSelectTab={store.setTab}
        onCloudLogin={store.cloudLogin}
      />
      <div class="lg:pl-64">
        <main id="main-content" tabIndex={-1} class="w-full space-y-4 p-2.5 pb-28 sm:p-5 lg:px-7 lg:py-6 xl:px-10 lg:pb-10 focus:outline-none">
          <h1 class="sr-only hidden lg:block">{activeTabTitle(state)}</h1>
          {state.tab === 'workout' ? (
            <LiveWorkoutView />
          ) : (
            <LegacyViewBridge
              tabKey={state.tab}
              html={store.renderLegacyViewHtml?.() ?? ''}
              version={store.legacyVersion}
              onMountHtml={store.onLegacyBridgeMount}
            />
          )}
        </main>
      </div>
      <MobileBottomNav
        state={state}
        liveCount={liveCount}
        draftCount={draftCount}
        lastRoutine={store.lastRoutine}
        lastAnalytics={store.lastAnalytics}
        restRemSec={rest.remSec}
        onSelectTab={store.setTab}
      />
      <ModalHost />
      <ToastBanner message={state.toast} />
      <SwUpdateBanner
        visible={store.swUpdatePending}
        onDismiss={store.dismissSwUpdate}
        onReload={store.reloadSwUpdate}
      />
    </>
  );
}
