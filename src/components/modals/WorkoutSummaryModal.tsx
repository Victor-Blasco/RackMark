import { norm } from '../../lib/seed';
import type { WorkoutSummary } from '../../ui/shared';
import { Icon } from '../common/Icon';
import { ModalShell } from '../common/ModalShell';

interface WorkoutSummaryModalProps {
  /** Datos agregados del entrenamiento recién guardado. */
  summary: WorkoutSummary;
  /** Ejercicios ya presentes en la rutina del día para marcar estado. */
  routineExNames?: string[];
  /** Fija un ejercicio extra en la rutina del día. */
  onAddExtraToRoutine?: (day: string, name: string, sets: number, reps: number) => void;
  /** Cierra la ventana de resumen para volver a la navegación normal. */
  onClose: () => void;
}

/**
 * Modal de resumen post-entrenamiento con duración, volumen total, marcas personales y extras opcionales.
 */
export function WorkoutSummaryModal({ summary, routineExNames = [], onAddExtraToRoutine, onClose }: WorkoutSummaryModalProps) {
  const tonnageLabel = summary.tonnageKg >= 1000
    ? `${(summary.tonnageKg / 1000).toFixed(1).replace('.', ',')} t`
    : `${Math.round(summary.tonnageKg)} kg`;
  const routineSet = new Set(routineExNames.map((n) => norm(n)));
  const extras = summary.day !== 'Libre' ? (summary.extraExercises ?? []) : [];

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
          <span class="block text-[11px] text-gray-400">Kilos movidos</span>
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

      {extras.length > 0 && (
        <div class="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
          <div>
            <p class="text-xs font-bold text-white">Fuera de la rutina {summary.day}</p>
            <p class="text-[11px] text-gray-400">Guardado solo en el historial de hoy (tu rutina no ha cambiado).</p>
          </div>
          <div class="space-y-1.5">
            {extras.map((ex) => {
              const inRoutine = routineSet.has(norm(ex.name));
              return (
                <div key={ex.name} class="flex items-center justify-between gap-2 text-xs">
                  <span class="min-w-0 truncate text-gray-200">{ex.name} <span class="text-gray-400 tabular-nums">({ex.sets}×{ex.reps})</span></span>
                  {inRoutine ? (
                    <span class="shrink-0 font-semibold text-emeraldGreen">En rutina ✓</span>
                  ) : onAddExtraToRoutine ? (
                    <button type="button" class="btn-sm text-xs shrink-0" onClick={() => onAddExtraToRoutine(summary.day, ex.name, ex.sets, ex.reps)}>
                      + Fijar en {summary.day}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div class="flex justify-end pt-1">
        <button type="button" class="btn-primary w-full sm:w-auto" onClick={onClose}>
          Continuar
        </button>
      </div>
    </ModalShell>
  );
}
