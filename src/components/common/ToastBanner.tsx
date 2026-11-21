import type { ToastAction } from '../../store/types';

interface ToastBannerProps {
  /** Mensaje breve mostrado al usuario (o vacío si no hay aviso). */
  message?: string;
  /** Botón de acción opcional (p. ej. `Deshacer`). */
  action?: ToastAction;
}

/**
 * Aviso flotante no intrusivo en la esquina inferior para confirmaciones y alertas.
 */
export function ToastBanner({ message, action }: ToastBannerProps) {
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      class="fixed inset-x-3 bottom-20 z-[60] mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border border-electricBlue/40 bg-gray-900 p-3 text-sm text-gray-100 shadow-xl lg:bottom-6 lg:left-64"
    >
      <span class="min-w-0 flex-1">{message}</span>
      {action && (
        <button
          type="button"
          class="min-h-[44px] sm:min-h-[34px] shrink-0 rounded-lg border border-electricBlue/50 bg-electricBlue/20 px-3 text-xs font-bold text-blue-200 hover:bg-electricBlue/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue"
          onClick={action.onAction}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

interface SwUpdateBannerProps {
  /** Indica si hay una nueva versión del Service Worker lista para activar. */
  visible: boolean;
  /** Cierra el aviso hasta la próxima recarga. */
  onDismiss: () => void;
  /** Recarga la aplicación aplicando el nuevo Service Worker. */
  onReload: () => void;
}

/**
 * Banner flotante que informa cuando hay una actualización PWA disponible.
 */
export function SwUpdateBanner({ visible, onDismiss, onReload }: SwUpdateBannerProps) {
  if (!visible) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      class="fixed inset-x-3 bottom-20 z-[55] mx-auto flex max-w-md flex-wrap items-center justify-between gap-2 rounded-xl border border-electricBlue/50 bg-floatDark p-3 text-sm text-gray-100 shadow-2xl lg:bottom-6 lg:left-64"
    >
      <span class="font-medium text-gray-200">Nueva versión disponible.</span>
      <div class="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          class="min-h-[44px] sm:min-h-[36px] rounded-lg px-2.5 text-xs font-semibold text-gray-300 hover:bg-white/10 hover:text-white"
          onClick={onDismiss}
        >
          Después
        </button>
        <button
          type="button"
          class="min-h-[44px] sm:min-h-[36px] rounded-lg bg-electricBlue px-3 text-xs font-bold text-white hover:bg-blue-500"
          onClick={onReload}
        >
          Actualizar
        </button>
      </div>
    </div>
  );
}
