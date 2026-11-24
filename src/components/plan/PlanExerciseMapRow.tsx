import type { ExerciseMapItem } from '../../store/planSelectors';
import { Collapsible } from '../common/Collapsible';
import { Icon } from '../common/Icon';
import { PlanExerciseMapEditor } from './PlanExerciseMapEditor';

interface PlanExerciseMapRowProps {
  /** Ejercicio con su músculo principal y secundarios. */
  item: ExerciseMapItem;
  /** Índice visual para enlazar `aria-controls`. */
  idx: number;
  /** Indica si el desplegable está abierto. */
  open: boolean;
  /** Alterna apertura del desplegable. */
  onToggle: () => void;
  /** Actualiza `expandedEx` tras renombrar para mantener el panel abierto. */
  onRenamed?: (newName: string) => void;
  /** Renombra el ejercicio en catálogo, rutinas e historial. */
  onRename?: (oldName: string, newName: string) => Promise<string | undefined>;
  /** Elimina por completo el ejercicio tras confirmación. */
  onDelete?: (exName: string) => Promise<boolean> | void;
  /** Cambia el músculo principal del ejercicio. */
  onChangePrimary?: (exName: string, primary: string) => void;
  /** Alterna un músculo secundario del ejercicio. */
  onToggleSecondary?: (exName: string, muscle: string) => void;
}

/** Fila desplegable de ejercicio con resumen muscular y panel de edición colapsable. */
export function PlanExerciseMapRow({
  item, idx, open, onToggle, onRenamed, onRename, onDelete, onChangePrimary, onToggleSecondary,
}: PlanExerciseMapRowProps) {
  return (
    <div class="border-b border-white/10">
      <button
        type="button"
        aria-expanded={open ? 'true' : 'false'}
        aria-controls={`ex-map-panel-${idx}`}
        class="flex min-h-[56px] w-full items-start justify-between gap-3 px-1 py-3 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue rounded-lg"
        onClick={onToggle}
      >
        <div class="min-w-0 space-y-1.5">
          <p class="text-sm font-semibold text-white leading-snug">{item.name}</p>
          <div class="flex flex-wrap items-center gap-1.5 text-[11px]">
            {item.primary ? (
              <span class="rounded-md border border-electricBlue/35 bg-electricBlue/15 px-2 py-0.5 font-bold text-blue-200">{item.primary}</span>
            ) : (
              <span class="rounded-md border border-amberGold/40 bg-amberGold/10 px-2 py-0.5 font-semibold text-amberGold">Sin músculo principal</span>
            )}
            {item.secondary.map((sec) => (
              <span key={sec} class="rounded-md bg-white/[0.06] px-2 py-0.5 text-gray-300">{sec}</span>
            ))}
          </div>
        </div>
        <Icon name="caretDown" className={`mt-1 h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180 text-white' : ''}`} />
      </button>

      <Collapsible open={open}>
        <PlanExerciseMapEditor
          item={item}
          idx={idx}
          open={open}
          onRenamed={onRenamed}
          onRename={onRename}
          onDelete={onDelete}
          onChangePrimary={onChangePrimary}
          onToggleSecondary={onToggleSecondary}
        />
      </Collapsible>
    </div>
  );
}
