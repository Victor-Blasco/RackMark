import { useRef } from 'preact/hooks';

interface LogAddExerciseSectionProps {
  /** Total de ejercicios disponibles no incluidos aún en el borrador. */
  availableCount: number;
  /** Sugerencias rápidas afines al grupo muscular del día. */
  quickSuggestions: string[];
  /** Abre el modal buscador NFD multi-músculo. */
  onOpenPicker: () => void;
  /** Abre el modal de creación de ejercicio nuevo. */
  onOpenNewModal: () => void;
  /** Añade un ejercicio por nombre al borrador actual. */
  onAddExercise: (name: string) => void;
}

/**
 * Pie de `Registrar hecho` para añadir ejercicios de la biblioteca o personalizados al borrador.
 */
export function LogAddExerciseSection({
  availableCount,
  quickSuggestions,
  onOpenPicker,
  onOpenNewModal,
  onAddExercise,
}: LogAddExerciseSectionProps) {
  const customRef = useRef<HTMLInputElement>(null);
  const submitCustom = () => {
    const val = customRef.current?.value ?? '';
    if (!val.trim()) return;
    onAddExercise(val);
    if (customRef.current) customRef.current.value = '';
  };

  return (
    <section id="log-add-section" class="space-y-2.5 pt-4 border-t border-white/10">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-bold text-white">Añadir ejercicio a la sesión</h2>
        <button type="button" class="btn btn-accent min-h-[44px] py-1.5 text-xs sm:text-sm" onClick={onOpenNewModal}>
          + Crear ejercicio nuevo
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="btn-primary min-h-[44px] flex-1 sm:flex-initial tabular-nums" onClick={onOpenPicker}>
          + Buscar en catálogo ({availableCount})
        </button>
        <div class="flex min-w-[240px] flex-1 gap-2">
          <input
            id="logNewExName"
            ref={customRef}
            enterKeyHint="done"
            class="inp min-h-[44px] flex-1"
            placeholder="Añadir rápido por nombre…"
            aria-label="Nombre de ejercicio nuevo"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitCustom();
              }
            }}
          />
          <button type="button" class="btn min-h-[44px] shrink-0" onClick={submitCustom}>
            + Añadir rápido
          </button>
        </div>
      </div>

      {quickSuggestions.length > 0 && (
        <div class="flex flex-wrap items-center gap-1.5 pt-1">
          <span class="text-xs text-gray-400">Sugeridos:</span>
          {quickSuggestions.map((n) => (
            <button key={n} type="button" class="btn min-h-[44px] rounded-full px-3.5 py-1.5 text-xs font-normal text-gray-200" onClick={() => onAddExercise(n)}>
              + {n}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
