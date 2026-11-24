import { useRef } from 'preact/hooks';
import type { Settings } from '../../types';
import { fmtDate, todayIso } from '../../ui/shared';
import { Icon } from '../common/Icon';

const QUICK_PHASES = ['Volumen limpio', 'Definición', 'Mantenimiento', 'Fuerza'];

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
  const sorted = [...phases].sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div class="max-w-2xl space-y-5">
      <div>
        <h2 class="text-base font-bold text-white">Fases nutricionales y de entrenamiento</h2>
        <p class="text-xs text-gray-400">Permite contextualizar la evolución del peso y el informe de IA según la etapa (definición, mantenimiento, volumen…).</p>
      </div>
      {sorted.length === 0 ? (
        <p class="text-xs text-gray-400">Todavía no hay fases configuradas. Añade una etapa para etiquetar tu progreso por bloque.</p>
      ) : (
        <div class="divide-y divide-white/10 border-y border-white/10">
          {sorted.map((p, i) => (
            <div key={`${p.name}-${p.start}`} class="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div class="min-w-0">
                <b class="text-white">{p.name}</b>{' '}
                <span class="tabular-nums text-gray-400">desde {fmtDate(p.start)}</span>
              </div>
              <button type="button" class="icon-btn text-coralRed hover:bg-coralRed/10" aria-label={`Borrar fase ${p.name}`} onClick={() => void onDeletePhase(i)}>
                <Icon name="close" className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div class="space-y-2.5">
        <div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Etapas rápidas">
          <span class="text-xs text-gray-400 mr-1">Etapas rápidas:</span>
          {QUICK_PHASES.map((label) => (
            <button
              key={label}
              type="button"
              class="btn-sm min-h-[44px] sm:min-h-[32px]"
              onClick={() => {
                if (phaseNameRef.current) phaseNameRef.current.value = label;
                if (phaseStartRef.current && !phaseStartRef.current.value) phaseStartRef.current.value = todayIso();
                phaseNameRef.current?.focus();
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <form
          id="f-phase"
          class="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const name = phaseNameRef.current?.value ?? '';
            const start = phaseStartRef.current?.value ?? '';
            void Promise.resolve(onAddPhase(name, start))
              .then(() => { if (name.trim() && start.trim()) form.reset(); })
              .catch(() => {});
          }}
        >
          <input ref={phaseNameRef} class="inp w-full sm:w-56" name="name" enterKeyHint="next" placeholder="Ej. Volumen, Definición, Mantenimiento…" aria-label="Nombre de la fase" required />
          <input ref={phaseStartRef} class="inp w-full sm:w-44" type="date" name="start" aria-label="Fecha de inicio de la fase" required />
          <button class="btn-primary-sm" type="submit">Añadir fase</button>
        </form>
      </div>
    </div>
  );
}
