import { useRef } from 'preact/hooks';
import type { Settings } from '../../types';
import { fmtDate } from '../../ui/shared';
import { Icon } from '../common/Icon';

interface PlanPhasesSectionProps {
  /** Lista de fases registradas en los ajustes del usuario. */
  phases: Settings['phases'];
  /** Añade una nueva fase nutricional o de entrenamiento. */
  onAddPhase: (name: string, start: string) => void | Promise<void>;
  /** Elimina la fase correspondiente al índice ordenado. */
  onDeletePhase: (sortedIdx: number) => void | Promise<void>;
}

/** Sección de configuración y borrado de fases del bloque de entrenamiento. */
export function PlanPhasesSection({ phases, onAddPhase, onDeletePhase }: PlanPhasesSectionProps) {
  const phaseNameRef = useRef<HTMLInputElement>(null);
  const phaseStartRef = useRef<HTMLInputElement>(null);

  return (
    <div class="pt-5 border-t border-white/10 space-y-3">
      <div>
        <h3 class="font-bold text-white">Fases nutricionales y de entrenamiento</h3>
        <p class="text-xs text-gray-400">Permite contextualizar la evolución del peso y el informe de IA según la etapa (definición, mantenimiento, volumen…).</p>
      </div>
      {phases.length > 0 && (
        <div class="space-y-1.5">
          {[...phases].sort((a, b) => a.start.localeCompare(b.start)).map((p, i) => (
            <div key={`${p.name}-${p.start}`} class="flex items-center gap-2 text-sm">
              <b>{p.name}</b> <span class="tabular-nums text-gray-400">desde {fmtDate(p.start)}</span>
              <button type="button" class="icon-btn text-coralRed hover:bg-coralRed/10" aria-label={`Borrar fase ${p.name}`} onClick={() => void onDeletePhase(i)}>
                <Icon name="close" className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <form
        id="f-phase"
        class="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void onAddPhase(phaseNameRef.current?.value ?? '', phaseStartRef.current?.value ?? '');
        }}
      >
        <input ref={phaseNameRef} class="inp w-44" name="name" placeholder="Ej. Volumen, Definición, Mantenimiento…" aria-label="Nombre de la fase" required />
        <input ref={phaseStartRef} class="inp w-40" type="date" name="start" aria-label="Fecha de inicio de la fase" required />
        <button class="btn" type="submit">Añadir fase</button>
      </form>
    </div>
  );
}
