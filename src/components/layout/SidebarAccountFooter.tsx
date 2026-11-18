import { syncStatusInfo } from '../../store/navigation';
import type { State } from '../../ui/shared';
import { Icon } from '../common/Icon';

interface SidebarAccountFooterProps {
  /** Estado global con usuario, estado de auth y sincronización. */
  state: State;
  /** Indica si existen cambios locales pendientes de subir. */
  unsynced: boolean;
  /** Abre la vista de cuenta y ajustes. */
  onOpenSettings: () => void;
  /** Dispara el inicio de sesión con Google. */
  onCloudLogin: () => void;
}

/**
 * Pie de la barra lateral con estado de cuenta, botón de acceso y estado de sincronización.
 */
export function SidebarAccountFooter({ state, unsynced, onOpenSettings, onCloudLogin }: SidebarAccountFooterProps) {
  const userInitial = (state.user?.displayName ?? state.user?.email ?? 'U').trim().charAt(0).toUpperCase() || 'U';
  const st = syncStatusInfo(state, unsynced);

  return (
    <div class="mt-auto space-y-2 border-t border-borderDark/80 p-3">
      {state.user ? (
        <button
          type="button"
          data-act="tab"
          data-arg="settings"
          aria-current={state.tab === 'settings' ? 'page' : undefined}
          class={`flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors ${state.tab === 'settings' ? 'border-electricBlue/40 bg-electricBlue/15' : 'border-white/5 bg-gray-900/60 hover:border-white/15'}`}
          onClick={onOpenSettings}
        >
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-electricBlue text-xs font-extrabold text-white">{userInitial}</span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-xs font-bold text-white">{state.user.displayName ?? 'Usuario'}</p>
            <p data-sync-badge data-sync-base="truncate text-[10px]" class={`truncate text-[10px] ${st.cls}`}>{st.text}</p>
          </div>
          <Icon name="gear" className="h-4 w-4 text-gray-400" />
        </button>
      ) : (
        <>
          {state.authReady && (
            <button
              type="button"
              data-act="cloudLogin"
              disabled={state.syncing}
              class="flex w-full items-center gap-2.5 rounded-xl border border-electricBlue/35 bg-electricBlue/10 px-3 py-2 text-xs font-semibold text-blue-300 transition-colors hover:bg-electricBlue/20 active:scale-[0.98]"
              onClick={onCloudLogin}
            >
              <Icon name="login" className="h-4 w-4" />
              <span class="flex-1 text-left">Iniciar sesión · Google</span>
            </button>
          )}
          <button
            type="button"
            data-act="tab"
            data-arg="settings"
            aria-current={state.tab === 'settings' ? 'page' : undefined}
            class={`nav-item ${state.tab === 'settings' ? 'nav-item-on' : ''}`}
            onClick={onOpenSettings}
          >
            <Icon name="gear" className="h-4 w-4" />
            <span class="min-w-0 flex-1 text-left">
              <span class="block">Cuenta y ajustes</span>
              <span data-sync-badge data-sync-base="block truncate text-[10px] font-normal" class={`block truncate text-[10px] font-normal ${st.cls}`}>{st.text}</span>
            </span>
          </button>
        </>
      )}
    </div>
  );
}
