import {
  ANALYTICS_IDS,
  ANALYTICS_TABS,
  PLAN_TABS,
  SYSTEM_IDS,
  SYSTEM_TABS,
  TRAIN_TABS,
  activeTabTitle,
  isRoutineTab,
  syncStatusInfo,
} from '../../store/navigation';
import { routineColor, routineNames, type PlanTab, type State } from '../../ui/shared';
import { Icon } from '../common/Icon';

interface MobileHeaderProps {
  /** Estado global de la aplicación. */
  state: State;
  /** Resumen compacto de sesiones y medidas. */
  statsText: string;
  /** Indica si hay cambios locales sin sincronizar. */
  unsynced: boolean;
  /** Navega a la subpestaña o sección elegida. */
  onSelectTab: (tab: string) => void;
  /** Cambia directamente de subpestaña dentro de `Planificación`. */
  onSelectPlanTab?: (tab: PlanTab) => void;
  /** Inicia sesión en la nube con Google. */
  onCloudLogin: () => void;
}

/** Cabecera fija superior en móvil con título, estado de sync y subpestañas contextuales. */
export function MobileHeader({ state, statsText, unsynced, onSelectTab, onSelectPlanTab, onCloudLogin }: MobileHeaderProps) {
  const inRoutine = isRoutineTab(state, state.tab);
  const inPlan = state.tab === 'plan';
  const activePlanTab = state.planTab ?? 'routines';
  const unmappedCount = state.analysis.unmapped.length;
  const inAnalytics = ANALYTICS_IDS.has(state.tab);
  const inSystem = SYSTEM_IDS.has(state.tab);
  const inTrain = state.tab === 'workout' || state.tab === 'log';
  const rNames = routineNames(state.settings);
  const st = syncStatusInfo(state, unsynced);
  const compactStats = statsText.replace(/ sesiones?\b/, ' ses.').replace(/ medidas?\b/, ' med.');

  const subTabs = inAnalytics
    ? ANALYTICS_TABS.map((a) => ({ id: a.id, label: a.label === 'Calculadoras' ? 'Calc.' : a.label }))
    : inTrain
      ? TRAIN_TABS
      : inSystem
        ? SYSTEM_TABS
        : null;
  const subLabel = inAnalytics ? 'Vistas de análisis' : inTrain ? 'Modo de entrenamiento' : 'Cuenta y datos';

  return (
    <header class="sticky top-0 z-30 border-b border-borderDark bg-navDark px-3 py-2 pt-[max(env(safe-area-inset-top),0.5rem)] lg:hidden">
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-2.5">
        <div class="flex min-w-0 items-center gap-2.5">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-electricBlue text-white shadow-sm">
            <Icon name="barbell" className="h-5 w-5" />
          </div>
          <div class="min-w-0">
            <p class="truncate text-sm font-extrabold leading-tight text-white">{activeTabTitle(state)}</p>
            <p class="flex flex-wrap items-center gap-x-1 text-[11px] leading-tight text-gray-400 tabular-nums">
              <span class={`font-medium ${st.cls}`}>{st.text}</span>
              <span aria-hidden="true">·</span>
              <span class="truncate">{compactStats}</span>
            </p>
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          {state.authReady && !state.user && (
            <button type="button" disabled={state.syncing} aria-label="Iniciar sesión con Google" title="Iniciar sesión con Google" class="flex h-11 items-center gap-1.5 rounded-xl border border-electricBlue/40 bg-electricBlue/15 px-3 text-xs font-bold text-blue-300 transition-colors hover:bg-electricBlue/25 active:scale-[0.98] motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" onClick={onCloudLogin}>
              <Icon name="login" className="h-3.5 w-3.5" />
              <span>Entrar</span>
            </button>
          )}
          <button type="button" aria-label="Cuenta y ajustes" aria-current={inSystem ? 'page' : undefined} class={`flex h-11 w-11 items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${inSystem ? 'border-electricBlue bg-electricBlue/15 text-blue-300' : 'border-borderDark bg-gray-900/80 text-gray-400 hover:text-white'}`} onClick={() => onSelectTab('settings')}>
            <Icon name="gear" className="h-5 w-5" />
          </button>
        </div>
      </div>

      {inRoutine && (
        <div role="tablist" aria-label="Rutinas" class="mt-2 flex gap-1 overflow-x-auto no-scrollbar rounded-xl border border-borderDark/80 bg-navDark p-1">
          {rNames.map((id, idx) => (
            <button key={id} type="button" role="tab" aria-selected={state.tab === id} class={`flex min-h-[44px] flex-1 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${state.tab === id ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`} onClick={() => onSelectTab(id)}>
              <span class="h-2 w-2 rounded-full" style={{ backgroundColor: routineColor(id, state.settings, idx) }} />
              <span>{id}</span>
            </button>
          ))}
        </div>
      )}

      {inPlan && (
        <div role="tablist" aria-label="Secciones de planificación" class="mt-2 grid grid-cols-3 gap-1 rounded-xl border border-borderDark/80 bg-navDark p-1">
          {PLAN_TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={activePlanTab === t.id} class={`flex min-h-[44px] min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${activePlanTab === t.id ? 'bg-electricBlue/20 text-blue-300' : 'text-gray-400 hover:text-gray-200'}`} onClick={() => (onSelectPlanTab ? onSelectPlanTab(t.id) : onSelectTab('plan'))}>
              <span class="truncate">{t.shortLabel}</span>
              {t.id === 'exercises' && unmappedCount > 0 && (
                <span class="rounded-full bg-amberGold/20 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-amberGold">{unmappedCount}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {subTabs && (
        <div role="tablist" aria-label={subLabel} class={`mt-2 grid gap-1 rounded-xl border border-borderDark/80 bg-navDark p-1 ${inAnalytics ? 'grid-cols-4' : 'grid-cols-2'}`}>
          {subTabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={state.tab === t.id} class={`flex min-h-[44px] min-w-0 items-center justify-center rounded-lg px-2 py-1.5 text-center ${inAnalytics ? 'text-[11px] px-1.5' : 'text-xs'} font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${state.tab === t.id ? 'bg-electricBlue/20 text-blue-300' : 'text-gray-400 hover:text-gray-200'}`} onClick={() => onSelectTab(t.id)}>
              <span class="truncate">{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
