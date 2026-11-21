interface LogAddExerciseSectionProps {
  /** Total de ejercicios disponibles no incluidos aún en el borrador. */
  availableCount: number;
  /** Sugerencias rápidas afines al grupo muscular del día. */
  quickSuggestions: string[];
  /** Abre el modal buscador NFD multi-músculo (que permite también crear ejercicios). */
  onOpenPicker: () => void;
  /** Añade un ejercicio sugerido directamente al borrador actual. */
  onAddExercise: (name: string) => void;
}

/**
 * Pie simplificado de `Registrar hecho` para añadir ejercicios desde el buscador o sugeridos.
 */
export function LogAddExerciseSection({
  availableCount,
  quickSuggestions,
  onOpenPicker,
  onAddExercise,
}: LogAddExerciseSectionProps) {
  return (
    <section id="log-add-section" class="space-y-3 pt-4 border-t border-white/10">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 class="text-sm font-bold text-white">Añadir ejercicio a la sesión</h2>
        <button type="button" class="btn-primary min-h-[44px] w-full sm:w-auto tabular-nums" onClick={onOpenPicker}>
          + Añadir ejercicio ({availableCount})
        </button>
      </div>

      {quickSuggestions.length > 0 && (
        <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <span class="shrink-0 text-xs text-gray-400">Sugeridos:</span>
          {quickSuggestions.slice(0, 5).map((n) => (
            <button
              key={n}
              type="button"
              class="btn shrink-0 min-h-[44px] sm:min-h-[34px] rounded-full px-3 py-1.5 text-xs font-normal text-gray-200 whitespace-nowrap"
              onClick={() => onAddExercise(n)}
            >
              + {n}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
