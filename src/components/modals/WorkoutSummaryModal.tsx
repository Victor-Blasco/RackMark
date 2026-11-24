import type { WorkoutSummary } from '../../ui/shared';
import { Icon } from '../common/Icon';
import { ModalShell } from '../common/ModalShell';

interface WorkoutSummaryModalProps {
  /** Datos agregados del entrenamiento recién guardado. */
  summary: WorkoutSummary;
  /** Cierra la ventana de resumen para volver a la navegación normal. */
  onClose: () => void;
}

/**
 * Modal de resumen post-entrenamiento con duración, volumen total y marcas personales.
 */
export function WorkoutSummaryModal({ summary, onClose }: WorkoutSummaryModalProps) {
  const tonnageLabel = summary.tonnageKg >= 1000
    ? `${(summary.tonnageKg / 1000).toFixed(1).replace('.', ',')} t`
    : `${Math.round(summary.tonnageKg)} kg`;

  return (
    <ModalShell
      id="workout-summary-modal"
      labelledBy="workoutSummaryTitle"
      panelClass="max-w-md border-emeraldGreen/35 p-5 space-y-4"
      onClose={onClose}
    >
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emeraldGreen/15 text-emeraldGreen">
            <Icon name="check" className="h-6 w-6" />
          </div>
          <div>
            <h3 id="workoutSummaryTitle" class="text-lg font-extrabold text-white">¡Entreno completado!</h3>
            <p class="text-xs text-gray-400 tabular-nums">{summary.day === 'Libre' ? 'Entreno libre' : summary.day} · {summary.durationMin} min</p>
          </div>
        </div>
        <button type="button" aria-label="Cerrar resumen" class="icon-btn" onClick={onClose}>
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>

      <div class="grid grid-cols-3 divide-x divide-white/10 rounded-xl border border-white/10 bg-white/[0.02] py-3 text-center">
        <div class="px-2">
          <span class="block text-[11px] text-gray-400">Ejercicios</span>
          <span class="tabular-nums text-lg font-extrabold text-white">{summary.exercises}</span>
        </div>
        <div class="px-2">
          <span class="block text-[11px] text-gray-400">Series</span>
          <span class="tabular-nums text-lg font-extrabold text-emeraldGreen">{summary.sets}</span>
        </div>
        <div class="px-2">
          <span class="block text-[11px] text-gray-400">Volumen</span>
          <span class="tabular-nums text-lg font-extrabold text-electricBlue">{tonnageLabel}</span>
        </div>
      </div>

      {summary.prNames.length > 0 ? (
        <div class="rounded-xl border border-emeraldGreen/30 bg-emeraldGreen/10 p-3 space-y-1">
          <p class="text-xs font-bold text-emerald-300 tabular-nums">Nuevas marcas personales ({summary.prNames.length})</p>
          <p class="text-xs text-gray-200">
            {summary.prNames.slice(0, 4).join(' · ')}
            {summary.prNames.length > 4 ? ` y ${summary.prNames.length - 4} más` : ''}
          </p>
        </div>
      ) : (
        <p class="text-xs text-gray-400">Buen trabajo: sesión guardada en tu historial y lista para analizar tu progreso.</p>
      )}

      <div class="flex justify-end pt-1">
        <button type="button" class="btn-primary w-full sm:w-auto" onClick={onClose}>
          Continuar
        </button>
      </div>
    </ModalShell>
  );
}
