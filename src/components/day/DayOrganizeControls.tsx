import { Icon } from '../common/Icon';

interface DayOrganizeControlsProps {
  exName: string;
  idx: number;
  total: number;
  compact?: boolean;
  onMoveRow: (idx: number, dir: number) => void;
  onDeleteRow: (idx: number) => void;
}

/** Botones compactos `^`, `v` y `×` para reordenar o quitar un ejercicio dentro de `Organizar`. */
export function DayOrganizeControls({ exName, idx, total, compact = false, onMoveRow, onDeleteRow }: DayOrganizeControlsProps) {
  const sizeCls = compact ? 'h-11 w-11' : 'h-8 w-7';
  const iconCls = compact ? 'h-4 w-4' : 'h-3.5 w-3.5';

  return (
    <>
      <button
        type="button"
        disabled={idx === 0}
        aria-label={`Subir ${exName}`}
        class={`inline-flex ${sizeCls} items-center justify-center rounded-lg border border-white/10 text-gray-300 hover:text-white disabled:opacity-25`}
        onClick={(e) => { e.stopPropagation(); onMoveRow(idx, -1); }}
      >
        <Icon name="caretUp" className={iconCls} />
      </button>
      <button
        type="button"
        disabled={idx === total - 1}
        aria-label={`Bajar ${exName}`}
        class={`inline-flex ${sizeCls} items-center justify-center rounded-lg border border-white/10 text-gray-300 hover:text-white disabled:opacity-25`}
        onClick={(e) => { e.stopPropagation(); onMoveRow(idx, 1); }}
      >
        <Icon name="caretDown" className={iconCls} />
      </button>
      <button
        type="button"
        aria-label={`Quitar ${exName} de la rutina`}
        class={`inline-flex ${sizeCls} items-center justify-center rounded-lg text-coralRed hover:bg-coralRed/10`}
        onClick={(e) => { e.stopPropagation(); onDeleteRow(idx); }}
      >
        <Icon name="close" className={iconCls} />
      </button>
    </>
  );
}
