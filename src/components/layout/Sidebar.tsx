import { ANALYTICS_TABS } from '../../store/navigation';
import { routineColor, routineNames, type PlanTab, type State } from '../../ui/shared';
import { Icon } from '../common/Icon';
import { RestTimerBadge } from './RestTimerPill';
import { SidebarAccountFooter } from './SidebarAccountFooter';

interface SidebarProps {
  /** Estado global de la aplicación. */
  state: State;
  /** Texto breve de estadísticas de sesiones y medidas en la cabecera. */
  statsText: string;
  /** Número de series completadas en la sesión en vivo actual. */
  liveCount: number;
  /** Número de ejercicios con series marcadas en `Registrar hecho`. */
  draftCount: number;
  /** Indica si existen cambios pendientes de subir a la nube. */
  unsynced: boolean;
  /** Marca temporal objetivo del descanso activo para reloj local sin re-renders globales. */
  restUntil?: number;
  /** Duración objetivo del descanso activo en segundos. */
  targetRestSec?: number;
  /** Callback al pulsar cualquier pestaña o rutina de navegación. */
  onSelectTab: (tab: string) => void;
  /** Navega a una subpestaña concreta dentro de `Planificación`. */
  onSelectPlanTab?: (tab: PlanTab) => void;
  /** Abre el modal de creación de rutina nueva. */
  onNewRoutine?: () => void;
  /** Callback para iniciar sesión con Google desde la barra lateral. */
  onCloudLogin: () => void;
}

/** Barra lateral fija para escritorio (`lg:`) con accesos a entrenar, rutinas, análisis, herramientas y cuenta. */
export function Sidebar({
  state, statsText, liveCount, draftCount, unsynced, restUntil, targetRestSec, onSelectTab, onSelectPlanTab, onNewRoutine, onCloudLogin,
}: SidebarProps) {
  const unmappedCount = state.analysis.unmapped.length;
  const activePlanTab = state.planTab ?? 'exercises';

  return (
    <aside aria-label="Navegación de escritorio" class="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col border-r border-borderDark/80 bg-navDark">
      <div class="flex items-center gap-3 border-b border-borderDark/80 px-4 py-4">
        <img src="/logo.svg" alt="" aria-hidden="true" class="h-9 w-9 shrink-0 rounded-xl border border-white/10 shadow-sm" />
        <div class="min-w-0">
          <p class="truncate text-sm font-extrabold text-white">RackMark</p>
          <p class="truncate text-[11px] text-gray-400 tabular-nums">{statsText}</p>
        </div>
      </div>

      <nav class="flex-1 space-y-3.5 overflow-y-auto px-3 py-3">
        <div>
          <p class="nav-sec-lbl">Entrenar</p>
          <div class="space-y-1">
            <button type="button" aria-current={state.tab === 'workout' ? 'page' : undefined} class={`nav-item ${state.tab === 'workout' ? 'nav-item-on' : ''}`} onClick={() => onSelectTab('workout')}>
              <Icon name="play" className="h-4 w-4" />
              <span class="flex-1 text-left">Iniciar entreno</span>
              <RestTimerBadge restUntil={restUntil} targetRestSec={targetRestSec} className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold tabular-nums text-white" />
              {liveCount > 0 && (
                <span class="inline-flex items-center gap-1 rounded-full bg-emeraldGreen/25 px-2 py-0.5 text-[10px] font-bold tabular-nums text-emerald-200">
                  <span class="h-1.5 w-1.5 rounded-full bg-emeraldGreen" />
                  {liveCount}
                </span>
              )}
            </button>
            <button type="button" aria-current={state.tab === 'log' ? 'page' : undefined} class={`nav-item ${state.tab === 'log' ? 'nav-item-on' : ''}`} onClick={() => onSelectTab('log')}>
              <Icon name="edit" className="h-4 w-4" />
              <span class="flex-1 text-left">Registrar hecho</span>
              {draftCount > 0 && <span class="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-gray-200 tabular-nums">{draftCount}</span>}
            </button>
          </div>
        </div>

        <div>
          <p class="nav-sec-lbl">General</p>
          <button type="button" aria-current={state.tab === 'home' ? 'page' : undefined} class={`nav-item ${state.tab === 'home' ? 'nav-item-on' : ''}`} onClick={() => onSelectTab('home')}>
            <Icon name="home" className="h-4 w-4" />
            <span>Resumen</span>
          </button>
        </div>

        <div>
          <p class="nav-sec-lbl">Rutinas</p>
          <div class="space-y-1">
            {routineNames(state.settings).map((id, idx) => {
              const active = state.tab === id;
              const sub = state.settings.routineMeta?.[id]?.sub;
              return (
                <button key={id} type="button" aria-current={active ? 'page' : undefined} class={`nav-item ${active ? 'nav-item-on' : ''}`} onClick={() => onSelectTab(id)}>
                  <span class="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: routineColor(id, state.settings, idx) }} />
                  <span class="flex-1 truncate text-left">
                    {id}{sub ? <span class="text-xs font-normal text-gray-400"> · {sub}</span> : null}
                  </span>
                  <span class="font-mono text-[11px] text-gray-400 tabular-nums">{(state.settings.routines[id] ?? []).length}</span>
                </button>
              );
            })}
            {onNewRoutine && (
              <button type="button" class="nav-item text-gray-300" onClick={onNewRoutine}>
                <Icon name="plus" className="h-4 w-4" />
                <span>+ Nueva rutina</span>
              </button>
            )}
            <button type="button" aria-current={state.tab === 'plan' && activePlanTab === 'exercises' ? 'page' : undefined} class={`nav-item ${state.tab === 'plan' && activePlanTab === 'exercises' ? 'nav-item-on' : ''}`} onClick={() => (onSelectPlanTab ? onSelectPlanTab('exercises') : onSelectTab('plan'))}>
              <Icon name="barbell" className="h-4 w-4" />
              <span class="flex-1 truncate text-left">Catálogo y músculos</span>
              {unmappedCount > 0 && <span class="rounded-full bg-amberGold/20 px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-amberGold">{unmappedCount}</span>}
            </button>
          </div>
        </div>

        <div>
          <p class="nav-sec-lbl">Análisis y métricas</p>
          <div class="space-y-1">
            {ANALYTICS_TABS.map((a) => {
              const active = a.id === 'phases'
                ? state.tab === 'phases' || (state.tab === 'plan' && activePlanTab === 'phases')
                : state.tab === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  class={`nav-item ${active ? 'nav-item-on' : ''}`}
                  onClick={() => (a.id === 'phases' && onSelectPlanTab ? onSelectPlanTab('phases') : onSelectTab(a.id))}
                >
                  <Icon name={a.icon} className="h-4 w-4" />
                  <span>{a.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p class="nav-sec-lbl">Datos y herramientas</p>
          <div class="space-y-1">
            <button type="button" aria-current={state.tab === 'data' ? 'page' : undefined} class={`nav-item ${state.tab === 'data' ? 'nav-item-on' : ''}`} onClick={() => onSelectTab('data')}>
              <Icon name="upload" className="h-4 w-4" />
              <span>Datos y copias</span>
            </button>
          </div>
        </div>
      </nav>

      <SidebarAccountFooter
        state={state}
        unsynced={unsynced}
        onOpenSettings={() => onSelectTab('settings')}
        onCloudLogin={onCloudLogin}
      />
    </aside>
  );
}
