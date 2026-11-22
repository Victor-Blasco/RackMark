import { useState } from 'preact/hooks';
import type { ExerciseMapItem } from '../../store/planSelectors';
import { PlanExerciseMapRow } from './PlanExerciseMapRow';

interface PlanExerciseMapListProps {
  /** Ejercicios visibles en el editor de mapa muscular. */
  items: ExerciseMapItem[];
  /** Renombra un ejercicio en catálogo, rutinas e historial. */
  onRename?: (oldName: string, newName: string) => Promise<string | undefined>;
  /** Elimina por completo un ejercicio tras confirmación. */
  onDelete?: (exName: string) => Promise<boolean> | void;
  /** Cambia el músculo principal de un ejercicio. */
  onChangePrimary?: (exName: string, primary: string) => void;
  /** Alterna un músculo secundario de un ejercicio en un toque. */
  onToggleSecondary?: (exName: string, muscle: string) => void;
}

/** Lista desplegable táctil por ejercicio para editar nombre, músculos y eliminar ejercicios. */
export function PlanExerciseMapList({ items, onRename, onDelete, onChangePrimary, onToggleSecondary }: PlanExerciseMapListProps) {
  const [expandedEx, setExpandedEx] = useState<string | null>(null);

  if (!items.length) {
    return <p class="py-4 text-center text-xs text-gray-400">Sin ejercicios que coincidan con la búsqueda.</p>;
  }

  return (
    <div class="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-8 items-start border-t border-white/10">
      {items.map((item, idx) => (
        <PlanExerciseMapRow
          key={item.name}
          item={item}
          idx={idx}
          open={expandedEx === item.name}
          onToggle={() => setExpandedEx((cur) => (cur === item.name ? null : item.name))}
          onRenamed={(newName) => setExpandedEx(newName)}
          onRename={onRename}
          onDelete={onDelete}
          onChangePrimary={onChangePrimary}
          onToggleSecondary={onToggleSecondary}
        />
      ))}
    </div>
  );
}
