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
  /** Degrada el botón Terminar a acento secundario cuando otro CTA domina la vista. */
  secondarySave?: boolean;
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
  secondarySave = false,
  onSave,
}: LiveHeaderProps) {
  return (
    <div class="flex items-center justify-between gap-1.5 sm:gap-2 pb-2.5 border-b border-white/10">
      <div class="flex min-w-0 items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          aria-expanded={menuOpen ? 'true' : 'false'}
          aria-controls="live-ex-menu"
          aria-label={menuOpen ? 'Cerrar lista de ejercicios' : 'Abrir lista de ejercicios'}
          class={`flex h-11 shrink-0 items-center gap-1.5 rounded-xl border px-2 sm:px-2.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${menuOpen ? 'border-electricBlue bg-electricBlue/20 text-white' : 'border-white/15 bg-white/5 text-gray-100 hover:bg-white/10'}`}
          onClick={onToggleMenu}
        >
          <Icon name="menu" className="h-4 w-4" />
          <span class="tabular-nums">{total ? `${curIdx + 1}/${total}` : '0'}</span>
        </button>
        <div class="min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dayColor }} aria-hidden="true" />
            <h1 class="truncate text-sm font-extrabold text-white">{day}</h1>
          </div>
          <p class="flex flex-wrap items-center gap-x-1 text-[11px] leading-tight text-gray-400 tabular-nums">
            <span id="liveCountSummary" class="whitespace-nowrap">{doneSetsCount}/{totalSetsCount} {totalSetsCount === 1 ? 'serie' : 'series'}</span>
            <span class="whitespace-nowrap"><span aria-hidden="true">· </span><span id="live-elapsed">{elapsedLabel}</span></span>
          </p>
        </div>
      </div>
      <div class="flex shrink-0 items-center">
        <button type="button" class={`${secondarySave ? 'btn btn-accent' : 'btn-primary'} min-h-[44px] px-2.5 sm:px-3 text-xs sm:text-sm`} onClick={onSave}>
          <Icon name="save" className="h-4 w-4" /> <span id="liveFinishLabel" class="tabular-nums">Terminar ({doneSetsCount})</span>
        </button>
      </div>
    </div>
  );
}
