import { humanizeError, type State } from '../../ui/shared';
import { Icon } from '../common/Icon';

interface AccountSyncSectionProps {
  /** Estado global con sesión Firebase, estado de cola y hora de última sincronización. */
  state: State;
  /** Abre el modal de acceso/registro. */
  onOpenAuth?: (mode?: 'login' | 'signup') => void;
  /** Fallback directo para tests aislados sin `onOpenAuth`. */
  onLogin?: () => void;
  /** Reenvía el correo de verificación de la cuenta activa. */
  onResendVerification?: () => void;
  /** Comprueba si el usuario ya completó la verificación de su correo. */
  onCheckVerified?: () => void;
  /** Fuerza una sincronización inmediata con Cloud Firestore. */
  onSync: () => void;
  /** Cierra la sesión activa tras comprobar cambios locales pendientes. */
  onLogout: () => void;
  /** Elimina permanentemente la cuenta y sus datos tras confirmación. */
  onDeleteAccount?: () => void;
}

function resolveSyncStatusText(state: State): string {
  if (state.syncing) return 'Sincronizando…';
  if (state.syncJob?.status === 'error') {
    const retry = state.syncJob.nextAttemptAt
      ? ` · reintento ${new Date(state.syncJob.nextAttemptAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
      : '';
    return `Pendiente: ${humanizeError(state.syncJob.error, 'error recuperable')}${retry}`;
  }
  if (state.syncJob?.status === 'pending') return 'Guardado localmente · pendiente de sincronizar';
  if (state.lastSync) {
    return `Última sincronización: ${new Date(state.lastSync).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return 'Conectado';
}

/**
 * Sección de estado de cuenta (Google o correo) y sincronización en la nube.
 */
export function AccountSyncSection({
  state,
  onOpenAuth,
  onLogin,
  onResendVerification,
  onCheckVerified,
  onSync,
  onLogout,
  onDeleteAccount,
}: AccountSyncSectionProps) {
  const initial = (state.user?.displayName ?? state.user?.email ?? 'U').trim().charAt(0).toUpperCase() || 'U';
  const syncStatus = resolveSyncStatusText(state);
  const openLogin = () => (onOpenAuth ? onOpenAuth('login') : onLogin?.());

  if (!state.user) {
    return (
      <div class="flex flex-col justify-between gap-4 pb-5 border-b border-white/10 xl:pb-0 xl:border-b-0 xl:border-r xl:border-white/10 xl:pr-6">
        <div class="space-y-1.5">
          <h2 class="font-bold text-white">Cuenta y sincronización</h2>
          <p class="text-xs text-gray-400 leading-relaxed">
            Inicia sesión con Google o con tu correo para sincronizar entrenamientos, medidas, sueño/FC y preferencias entre dispositivos, además de activar los informes de IA.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn-primary min-h-[44px]" disabled={state.syncing} onClick={openLogin}>
            <Icon name="login" className="h-4 w-4" /> Iniciar sesión
          </button>
          <button type="button" class="btn min-h-[44px]" disabled={state.syncing} onClick={() => onOpenAuth?.('signup')}>
            Crear cuenta
          </button>
        </div>
      </div>
    );
  }

  if (!state.user.emailVerified) {
    return (
      <div class="space-y-4 pb-5 border-b border-white/10 xl:pb-0 xl:border-b-0 xl:border-r xl:border-white/10 xl:pr-6">
        <div class="flex items-start gap-3">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amberGold/20 border border-amberGold/40 text-sm font-extrabold text-amber-300">
            {initial}
          </div>
          <div class="min-w-0 flex-1">
            <h2 class="font-bold text-white">Cuenta y sincronización</h2>
            <p class="text-sm text-gray-200 truncate mt-0.5">{state.user.displayName ?? 'Cuenta por correo'}</p>
            <p class="text-xs text-gray-400 truncate">{state.user.email ?? ''}</p>
            <p class="text-xs mt-1 text-amberGold">Correo pendiente de verificar</p>
          </div>
        </div>
        <p class="rounded-xl border border-amberGold/30 bg-amberGold/10 px-3 py-2.5 text-xs text-amber-200 leading-relaxed">
          Revisa tu bandeja de entrada y abre el enlace de verificación para activar la sincronización en la nube y el Coach IA.
        </p>
        <div class="flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
          <button type="button" class="btn-primary min-h-[44px]" disabled={state.syncing} onClick={onCheckVerified}>
            Ya lo verifiqué
          </button>
          <button type="button" class="btn min-h-[44px]" disabled={state.syncing} onClick={onResendVerification}>
            Reenviar correo
          </button>
          <button type="button" class="btn btn-danger min-h-[44px]" disabled={state.syncing} onClick={onLogout}>
            Cerrar sesión
          </button>
          <button type="button" class="min-h-[44px] sm:min-h-[36px] text-xs text-rose-300 hover:text-rose-200 underline underline-offset-4 ml-auto" disabled={state.syncing} onClick={onDeleteAccount}>
            Eliminar cuenta
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
          <p class="text-sm text-gray-200 truncate mt-0.5">{state.user.displayName ?? 'Cuenta por correo'}</p>
          <p class="text-xs text-gray-400 truncate">{state.user.email ?? ''}</p>
          <p class={`text-xs mt-1 ${state.syncJob?.status === 'error' ? 'text-rose-300' : 'text-emerald-400'}`}>
            {syncStatus}
          </p>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
        <button type="button" class="btn min-h-[44px]" disabled={state.syncing} onClick={onSync}>
          <Icon name="refresh" className="h-4 w-4" /> Sincronizar ahora
        </button>
        <button type="button" class="btn btn-danger min-h-[44px]" disabled={state.syncing} onClick={onLogout}>
          Cerrar sesión
        </button>
        <button type="button" class="min-h-[44px] sm:min-h-[36px] text-xs text-rose-300 hover:text-rose-200 underline underline-offset-4 ml-auto" disabled={state.syncing} onClick={onDeleteAccount}>
          Eliminar cuenta
        </button>
      </div>
    </div>
  );
}
