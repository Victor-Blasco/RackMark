import type { State } from '../../ui/shared';
import { Icon } from '../common/Icon';

interface AccountSyncSectionProps {
  /** Estado global con sesión Firebase, estado de cola y hora de última sincronización. */
  state: State;
  /** Inicia sesión con Google. */
  onLogin: () => void;
  /** Fuerza una sincronización inmediata con Cloud Firestore. */
  onSync: () => void;
  /** Cierra la sesión activa tras comprobar cambios locales pendientes. */
  onLogout: () => void;
}

function resolveSyncStatusText(state: State): string {
  if (state.syncing) return 'Sincronizando…';
  if (state.syncJob?.status === 'error') {
    const retry = state.syncJob.nextAttemptAt
      ? ` · reintento ${new Date(state.syncJob.nextAttemptAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
      : '';
    return `Pendiente: ${state.syncJob.error ?? 'error recuperable'}${retry}`;
  }
  if (state.syncJob?.status === 'pending') return 'Guardado localmente · pendiente de sincronizar';
  if (state.lastSync) {
    return `Última sincronización: ${new Date(state.lastSync).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return 'Conectado';
}

/**
 * Sección de estado de cuenta Google y sincronización en la nube.
 */
export function AccountSyncSection({ state, onLogin, onSync, onLogout }: AccountSyncSectionProps) {
  const initial = (state.user?.displayName ?? state.user?.email ?? 'U').trim().charAt(0).toUpperCase() || 'U';
  const syncStatus = resolveSyncStatusText(state);

  if (!state.user) {
    return (
      <div class="flex flex-col justify-between gap-4 pb-5 border-b border-white/10 xl:pb-0 xl:border-b-0 xl:border-r xl:border-white/10 xl:pr-6">
        <div class="space-y-1.5">
          <h2 class="font-bold text-white">Cuenta y sincronización</h2>
          <p class="text-xs text-gray-400 leading-relaxed">
            Inicia sesión con Google para sincronizar tus entrenamientos, medidas, sueño/FC y preferencias entre dispositivos, además de activar los informes de IA.
          </p>
        </div>
        <div>
          <button
            type="button"
            class="btn-primary"
            disabled={state.syncing}
            onClick={onLogin}
          >
            <Icon name="login" className="h-4 w-4" /> Iniciar sesión con Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div class="space-y-4 pb-5 border-b border-white/10 xl:pb-0 xl:border-b-0 xl:border-r xl:border-white/10 xl:pr-6">
      <div class="flex items-start gap-3">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-electricBlue text-sm font-extrabold text-white shadow-sm">
          {initial}
        </div>
        <div class="min-w-0 flex-1">
          <h2 class="font-bold text-white">Cuenta y sincronización</h2>
          <p class="text-sm text-gray-200 truncate mt-0.5">{state.user.displayName ?? 'Usuario'}</p>
          <p class="text-xs text-gray-400 truncate">{state.user.email ?? ''}</p>
          <p class={`text-xs mt-1 ${state.syncJob?.status === 'error' ? 'text-rose-300' : 'text-emerald-400'}`}>
            {syncStatus}
          </p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2 border-t border-white/5 pt-3">
        <button type="button" class="btn" disabled={state.syncing} onClick={onSync}>
          <Icon name="refresh" className="h-4 w-4" /> Sincronizar ahora
        </button>
        <button type="button" class="btn btn-danger" disabled={state.syncing} onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
