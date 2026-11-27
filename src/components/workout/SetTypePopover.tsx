import type { SetKind } from '../../types';

interface SetTypePopoverProps {
  /** Tipo actual de la serie (`'S'` si no está definido). */
  kind: SetKind;
  /** Número de la siguiente drop en caso de añadir una desde una fila `D`. */
  nextDropNum: number;
  /** Cambia el tipo de la serie actual (`S`, `W`, `F`). */
  onSelectKind: (kind: SetKind) => void;
  /** Añade una subfila drop (`↳ D`) inmediatamente debajo de esta serie. */
  onAddDrop: () => void;
  /** Elimina esta fila drop cuando ya no se necesita. */
  onRemoveDrop?: () => void;
}

const OPT_CLS =
  'min-h-[44px] sm:min-h-[38px] w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue';

/** Popover contextual para elegir tipo de serie (`S`, `W`, `F`) o encadenar subseries `↳ D`. */
export function SetTypePopover({ kind, nextDropNum, onSelectKind, onAddDrop, onRemoveDrop }: SetTypePopoverProps) {
  return (
    <div
      role="menu"
      aria-label="Tipo de serie"
      class="absolute left-0 top-12 z-30 w-60 rounded-xl border border-white/15 bg-modalDark p-1.5 shadow-2xl space-y-0.5"
    >
      {kind === 'D' ? (
        <>
          <button type="button" role="menuitem" class={OPT_CLS} onClick={onAddDrop}>
            <span>
              <b class="block text-white">+ Añadir otra drop (↳ D{nextDropNum})</b>
              <span class="block text-[11px] text-gray-400">Sigue sin descanso tras esta</span>
            </span>
            <span class="font-extrabold text-electricBlue">+D</span>
          </button>
          {onRemoveDrop && (
            <button type="button" role="menuitem" class={OPT_CLS} onClick={onRemoveDrop}>
              <span>
                <b class="block text-rose-300">Quitar drop</b>
                <span class="block text-[11px] text-gray-400">Elimina esta subserie</span>
              </span>
              <span class="font-extrabold text-rose-300">×</span>
            </button>
          )}
        </>
      ) : (
        <>
          <button type="button" role="menuitem" class={OPT_CLS} onClick={() => onSelectKind('S')}>
            <span>
              <b class="block text-white">Serie efectiva (S)</b>
              <span class="block text-[11px] text-gray-400">Cuenta en volumen y progresión</span>
            </span>
            <span class="font-extrabold text-gray-200">S</span>
          </button>
          <button type="button" role="menuitem" class={OPT_CLS} onClick={() => onSelectKind('W')}>
            <span>
              <b class="block text-amberGold">Calentamiento (W)</b>
              <span class="block text-[11px] text-gray-400">Excluida de volumen y e1RM</span>
            </span>
            <span class="font-extrabold text-amberGold">W</span>
          </button>
          <button type="button" role="menuitem" class={OPT_CLS} onClick={() => onSelectKind('F')}>
            <span>
              <b class="block text-rose-300">Al fallo (F)</b>
              <span class="block text-[11px] text-gray-400">Efectiva con RIR 0 técnico</span>
            </span>
            <span class="font-extrabold text-rose-300">F</span>
          </button>
          <button type="button" role="menuitem" class={OPT_CLS} onClick={onAddDrop}>
            <span>
              <b class="block text-electricBlue">+ Añadir drop (↳ D)</b>
              <span class="block text-[11px] text-gray-400">Encadena bajada sin descanso</span>
            </span>
            <span class="font-extrabold text-electricBlue">+D</span>
          </button>
        </>
      )}
    </div>
  );
}
