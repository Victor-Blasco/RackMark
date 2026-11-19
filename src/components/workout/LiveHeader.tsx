import { Icon } from '../common/Icon';

interface LiveHeaderProps {
  /** Nombre de la rutina o `'Libre'`. */
  day: string;
  /** Color identificativo de la rutina. */
  dayColor: string;
  /** Índice base 0 del ejercicio actual. */
  curIdx: number;
  /** Número total de ejercicios en la sesión. */
  total: number;
  /** Series completadas hasta el momento. */
  doneSetsCount: number;
  /** Series totales de la sesión actual. */
  totalSetsCount: number;
  /** Tiempo transcurrido formateado (`14 min`). */
  elapsedLabel: string;
  /** Indica si el menú de ejercicios está desplegado. */
  menuOpen: boolean;
  /** Alterna el menú hamburguesa de ejercicios. */
  onToggleMenu: () => void;
  /** Descarta la sesión en curso previa confirmación. */
  onDiscard: () => void;
  /** Guarda el entrenamiento en IndexedDB. */
  onSave: () => void;
}

/**
 * Cabecera compacta de la sesión en vivo con menú de ejercicios, tiempo y guardar.
 */
export function LiveHeader({
  day,
  dayColor,
  curIdx,
  total,
  doneSetsCount,
  totalSetsCount,
  elapsedLabel,
  menuOpen,
  onToggleMenu,
  onDiscard,
  onSave,
}: LiveHeaderProps) {
  return (
    <div class="flex items-center justify-between gap-1.5 sm:gap-2 pb-2.5 border-b border-white/10">
      <div class="flex min-w-0 items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          aria-expanded={menuOpen ? 'true' : 'false'}
          aria-controls="live-ex-menu"
          aria-label="Abrir lista de ejercicios"
          class={`flex h-11 shrink-0 items-center gap-1.5 rounded-xl border px-2 sm:px-2.5 text-xs font-bold transition-colors ${menuOpen ? 'border-electricBlue bg-electricBlue/20 text-white' : 'border-white/15 bg-white/5 text-gray-100 hover:bg-white/10'}`}
          onClick={onToggleMenu}
        >
          <Icon name="menu" className="h-4 w-4" />
          <span class="tabular-nums">{total ? `${curIdx + 1}/${total}` : '0'}</span>
        </button>
        <div class="min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dayColor }} aria-hidden="true" />
            <span class="truncate text-sm font-extrabold text-white">{day}</span>
          </div>
          <p class="flex flex-wrap items-center gap-x-1 text-[11px] leading-tight text-gray-400 tabular-nums">
            <span id="liveCountSummary" class="whitespace-nowrap">{doneSetsCount}/{totalSetsCount} series</span>
            <span class="whitespace-nowrap"><span aria-hidden="true">· </span><span id="live-elapsed">{elapsedLabel}</span></span>
          </p>
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <button type="button" class="flex h-11 items-center px-1.5 sm:px-2 text-xs font-semibold text-gray-400 hover:text-coralRed" onClick={onDiscard}>
          Descartar
        </button>
        <button type="button" class="btn-primary min-h-[44px] px-2.5 sm:px-3 text-xs sm:text-sm" onClick={onSave}>
          <Icon name="save" className="h-4 w-4" /> <span id="liveFinishLabel">Terminar ({doneSetsCount})</span>
        </button>
      </div>
    </div>
  );
}
