import { createContext, type ComponentChildren } from 'preact';
import { useContext } from 'preact/hooks';
import type { DayName } from '../types';
import type { State } from '../ui/shared';
import type { LogWorkoutActions } from './logActions';
import type { PlanActions } from './planActions';
import type { WizardActions } from './wizardActions';
import type { LiveWorkoutActions } from './workoutActions';

/** Contrato de estado y acciones compartido por los componentes Preact. */
export interface AppStoreValue {
  /** Estado global actual de la aplicación. */
  state: State;
  /** Última rutina activa para el acceso directo móvil `Rutinas`. */
  lastRoutine: DayName;
  /** Última subpestaña de análisis activa en móvil. */
  lastAnalytics: string;
  /** Indica si hay cambios locales pendientes de subir a la nube. */
  unsynced: boolean;
  /** Indica si existe una actualización del Service Worker pendiente. */
  swUpdatePending: boolean;
  /** Navega a una pestaña o rutina concreta. */
  setTab: (tab: string) => void;
  /** Inicia el flujo de autenticación en la nube con Google. */
  cloudLogin: () => void;
  /** Resuelve la promesa del diálogo `#confirm-modal`. */
  resolveConfirm: (ok: boolean) => void;
  /** Cierra el modal de formulario o edición activo. */
  closeModal: () => void;
  /** Guarda o elimina la nota técnica permanente de un ejercicio. */
  saveNoteModal: (exName: string, note: string) => Promise<void>;
  /** Cierra el modal de resumen tras completar un entrenamiento. */
  closeWorkoutSummary: () => void;
  /** Oculta temporalmente el banner de nueva versión PWA. */
  dismissSwUpdate: () => void;
  /** Aplica la actualización pendiente del Service Worker. */
  reloadSwUpdate: () => void;
  /** Abre el modal de nota permanente para un ejercicio concreto. */
  openFixedNote: (exName: string) => void;
  /** Acciones de la vista piloto `En vivo`. */
  live: LiveWorkoutActions;
  /** Acciones de la vista `Registrar hecho`. */
  log: LogWorkoutActions;
  /** Acciones de `Plan`, `Resumen` y `Rutina`. */
  plan: PlanActions;
  /** Acciones del asistente inicial de bienvenida. */
  wizard: WizardActions;
  /** Genera el HTML de vistas aún no migradas para `<LegacyViewBridge />`. */
  renderLegacyViewHtml?: () => string;
  /** Contador incremental que sincroniza re-renders legados con `resetCharts()`. */
  legacyVersion?: number;
  /** Ejecuta tareas post-render de vistas legadas (`runChartJobs`, `runCalc`, `initSortableLists`). */
  onLegacyBridgeMount?: (container: HTMLElement) => void;
}

const noop = () => {};
const noopAsync = async () => {};
const noopProxy = <T extends object>() => new Proxy({} as T, { get: () => noop });

const DEFAULT_STORE: AppStoreValue = {
  state: {} as State,
  lastRoutine: 'Push',
  lastAnalytics: 'body',
  unsynced: false,
  swUpdatePending: false,
  setTab: noop,
  cloudLogin: noop,
  resolveConfirm: noop,
  closeModal: noop,
  saveNoteModal: noopAsync,
  closeWorkoutSummary: noop,
  dismissSwUpdate: noop,
  reloadSwUpdate: noop,
  openFixedNote: noop,
  live: noopProxy<LiveWorkoutActions>(),
  log: noopProxy<LogWorkoutActions>(),
  plan: noopProxy<PlanActions>(),
  wizard: noopProxy<WizardActions>(),
};

const AppStoreContext = createContext<AppStoreValue>(DEFAULT_STORE);

interface AppStoreProviderProps {
  /** Valor reactivo del store con estado actual y acciones conectadas. */
  value: AppStoreValue;
  /** Árbol de componentes Preact descendientes. */
  children: ComponentChildren;
}

/**
 * Proveedor raíz del store de GymApp para componentes `.tsx`.
 */
export function AppStoreProvider({ value, children }: AppStoreProviderProps) {
  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

/**
 * Hook de lectura del store global para vistas y componentes Preact.
 *
 * @returns El estado y las acciones activas del store (o defaults seguros en SSR).
 */
export function useAppStore(): AppStoreValue {
  return useContext(AppStoreContext);
}
