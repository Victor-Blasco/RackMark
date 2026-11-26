import { useState } from 'preact/hooks';
import { ROUTINE_TEMPLATES } from '../../lib/seed';
import { Collapsible } from '../common/Collapsible';
import { Icon } from '../common/Icon';

interface DayOrganizeBarProps {
  /** Nombre de la rutina actual. */
  day: string;
  /** Total de rutinas activas para permitir borrar si hay más de una. */
  routineCount: number;
  /** Abre el selector buscador de ejercicios para añadir a esta rutina. */
  onAddExercise: () => void;
  /** Aplica una plantilla base previa confirmación. */
  onApplyTemplate: (key: string) => void;
  /** Abre el modal de creación de rutina nueva. */
  onNewRoutine: () => void;
  /** Abre el modal de edición del día actual. */
  onEditRoutine: () => void;
  /** Elimina el día actual previa confirmación. */
  onDeleteRoutine: () => void;
  /** Abre la herramienta avanzada de catálogo y fusiones. */
  onOpenCatalog: () => void;
}

/**
 * Barra compacta para organizar ejercicios, añadir, cambiar plantilla o crear días desde `Rutinas`.
 */
export function DayOrganizeBar({
  day,
  routineCount,
  onAddExercise,
  onApplyTemplate,
  onNewRoutine,
  onEditRoutine,
  onDeleteRoutine,
  onOpenCatalog,
}: DayOrganizeBarProps) {
  const [tplOpen, setTplOpen] = useState(false);

  return (
    <div class="rounded-2xl border border-white/10 bg-cardDark p-3.5 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="btn-primary-sm min-h-[44px] sm:min-h-[34px]" onClick={onAddExercise}>
            + Añadir ejercicio
          </button>
          <button
            type="button"
            aria-expanded={tplOpen ? 'true' : 'false'}
            class="btn-sm min-h-[44px] sm:min-h-[34px] inline-flex items-center gap-1"
            onClick={() => setTplOpen((v) => !v)}
          >
            <span>Plantillas</span>
            <Icon name="caretDown" className={`h-3.5 w-3.5 transition-transform ${tplOpen ? 'rotate-180' : ''}`} />
          </button>
          <button type="button" class="btn-sm min-h-[44px] sm:min-h-[34px]" onClick={onNewRoutine}>
            + Nueva rutina
          </button>
          <button type="button" class="btn-sm min-h-[44px] sm:min-h-[34px]" onClick={onEditRoutine}>
            <Icon name="edit" className="h-3.5 w-3.5" /> Editar rutina
          </button>
          {routineCount > 1 && (
            <button type="button" class="btn-danger btn-sm min-h-[44px] sm:min-h-[34px]" onClick={onDeleteRoutine}>
              <Icon name="trash" className="h-3.5 w-3.5" /> Borrar {day}
            </button>
          )}
        </div>
        <button
          type="button"
          class="text-xs font-semibold text-gray-400 hover:text-white underline-offset-4 hover:underline min-h-[44px] sm:min-h-0 px-1"
          onClick={onOpenCatalog}
        >
          Catálogo y músculos →
        </button>
      </div>

      <Collapsible open={tplOpen}>
        <div class="grid grid-cols-1 gap-2 border-t border-white/10 pt-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(ROUTINE_TEMPLATES).map(([key, tpl]) => (
            <button
              key={key}
              type="button"
              class="rounded-xl border border-white/10 bg-white/[0.02] p-2.5 text-left hover:border-electricBlue/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue"
              onClick={() => {
                setTplOpen(false);
                onApplyTemplate(key);
              }}
            >
              <div class="text-xs font-bold text-white">{tpl.label}</div>
              <p class="mt-0.5 text-[11px] text-gray-400 leading-snug">{tpl.desc}</p>
            </button>
          ))}
        </div>
      </Collapsible>

      <p class="text-[11px] text-gray-400">
        Usa las flechas <span class="text-gray-200 font-semibold">^ / v</span> para reordenar o toca <span class="text-gray-200 font-semibold">3×8 ✎</span> en cualquier fila para cambiar series y reps.
      </p>
    </div>
  );
}
