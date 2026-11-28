interface SettingsRelatedLinksProps {
  /** Abre la sección de `Datos y copias`. */
  onOpenData: () => void;
  /** Abre `Planificación -> Catálogo y músculos`. */
  onOpenExercises: () => void;
  /** Abre `Planificación -> Fases del bloque`. */
  onOpenPhases: () => void;
}

/**
 * Lista compacta de accesos relacionados con datos, planificación y privacidad.
 */
export function SettingsRelatedLinks({ onOpenData, onOpenExercises, onOpenPhases }: SettingsRelatedLinksProps) {
  return (
    <div class="divide-y divide-white/10 border-t border-white/10">
      <div class="flex items-center justify-between gap-3 py-3">
        <div class="min-w-0">
          <p class="text-sm font-semibold text-white">Datos y copias</p>
          <p class="text-xs text-gray-400">Importar Samsung Health, copias JSON y limpiar duplicados.</p>
        </div>
        <button type="button" class="btn-sm shrink-0" onClick={onOpenData}>Abrir</button>
      </div>
      <div class="flex items-center justify-between gap-3 py-3">
        <div class="min-w-0">
          <p class="text-sm font-semibold text-white">Catálogo y músculos</p>
          <p class="text-xs text-gray-400">Editar ejercicios, alias y grupos musculares.</p>
        </div>
        <button type="button" class="btn-sm shrink-0" onClick={onOpenExercises}>Abrir</button>
      </div>
      <div class="flex items-center justify-between gap-3 py-3">
        <div class="min-w-0">
          <p class="text-sm font-semibold text-white">Fases del bloque</p>
          <p class="text-xs text-gray-400">Etapas de volumen, definición y mantenimiento.</p>
        </div>
        <button type="button" class="btn-sm shrink-0" onClick={onOpenPhases}>Abrir</button>
      </div>
      <div class="flex items-center justify-between gap-3 py-3">
        <div class="min-w-0">
          <p class="text-sm font-semibold text-white">Privacidad</p>
          <p class="text-xs text-gray-400">Cómo se almacenan tus datos locales y en la nube.</p>
        </div>
        <a href="/privacidad" target="_blank" rel="noopener noreferrer" class="btn-sm shrink-0">Leer</a>
      </div>
    </div>
  );
}
