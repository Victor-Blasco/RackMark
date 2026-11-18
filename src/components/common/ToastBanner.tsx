interface ToastBannerProps {
  /** Mensaje breve mostrado al usuario (o vacío si no hay aviso). */
  message?: string;
}

/**
 * Aviso flotante no intrusivo en la esquina inferior para confirmaciones y alertas.
 */
export function ToastBanner({ message }: ToastBannerProps) {
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      class="fixed inset-x-3 bottom-20 z-40 mx-auto max-w-md rounded-xl border border-electricBlue/40 bg-gray-900 p-3 text-sm text-gray-100 shadow-xl lg:bottom-6 lg:left-64"
    >
      {message}
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
      class="fixed inset-x-3 bottom-20 z-50 mx-auto flex max-w-md flex-wrap items-center justify-between gap-2 rounded-xl border border-electricBlue/50 bg-floatDark p-3 text-sm text-gray-100 shadow-2xl lg:bottom-6 lg:left-64"
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
