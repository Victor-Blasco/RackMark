import type { LogExDraft } from '../../types';
import { Collapsible } from '../common/Collapsible';
import { Icon } from '../common/Icon';

/** Elemento enriquecido del menú hamburguesa de ejercicios en vivo. */
export interface LiveMenuItem {
  item: LogExDraft;
  idx: number;
  infoLine: string;
  doneInEx: number;
  allDoneInEx: boolean;
}

interface LiveExerciseMenuProps {
  /** Indica si el menú desplegable está expandido. */
  open: boolean;
  /** Índice del ejercicio activo en pantalla. */
  curIdx: number;
  /** Total de ejercicios ya completados en la sesión. */
  doneExCount: number;
  /** Lista de ejercicios con resumen objetivo/última marca. */
  items: LiveMenuItem[];
  /** Alterna apertura y cierre del menú. */
  onToggleMenu: () => void;
  /** Navega al ejercicio seleccionado por índice. */
  onSelectExercise: (idx: number) => void;
  /** Abre el selector para añadir un ejercicio nuevo al entreno. */
  onOpenAddPicker: () => void;
  /** Descarta el entrenamiento en curso previa confirmación. */
  onDiscard: () => void;
}

/**
 * Menú hamburguesa animado con altura CSS grid para saltar entre ejercicios del entreno.
 */
export function LiveExerciseMenu({
  open,
  curIdx,
  doneExCount,
  items,
  onToggleMenu,
  onSelectExercise,
  onOpenAddPicker,
  onDiscard,
}: LiveExerciseMenuProps) {
  return (
    <Collapsible
      id="live-ex-menu-wrap"
      open={open}
      keepMounted
      className={open ? 'mt-3' : 'mt-0 -translate-y-1'}
    >
      <nav id="live-ex-menu" aria-label="Ejercicios del entrenamiento" class="rounded-2xl border border-white/15 bg-floatDark p-2.5 shadow-2xl shadow-black/45 space-y-2">
          <div class="flex items-center justify-between px-1.5 pb-1">
            <span id="liveMenuSummary" class="text-xs font-bold uppercase tracking-wide text-gray-300 tabular-nums">Ejercicios ({doneExCount}/{items.length} listos)</span>
            <button type="button" class="flex min-h-[44px] sm:min-h-[34px] items-center gap-1 rounded-full bg-white/5 px-3.5 text-xs font-semibold text-gray-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" onClick={onToggleMenu}>
              <Icon name="close" className="h-3.5 w-3.5" /> Cerrar
            </button>
          </div>

          {items.length > 0 ? (
            <div class="space-y-1 max-h-[55vh] overflow-y-auto pr-0.5">
              {items.map(({ item, idx, infoLine, doneInEx, allDoneInEx }) => {
                const active = idx === curIdx;
                return (
                  <button
                    key={`${idx}-${item.name}`}
                    type="button"
                    class={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${active ? 'bg-electricBlue/20 ring-1 ring-electricBlue/40' : 'hover:bg-white/[0.05]'}`}
                    onClick={() => onSelectExercise(idx)}
                  >
                    <div class="flex min-w-0 flex-1 items-center gap-2.5">
                      <span class={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${allDoneInEx ? 'bg-emeraldGreen/20 text-emerald-300' : active ? 'bg-electricBlue text-white' : 'bg-white/10 text-gray-300'}`}>
                        {allDoneInEx ? <Icon name="check" className="h-3.5 w-3.5" /> : idx + 1}
                      </span>
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5">
                          <span class={`truncate text-sm font-bold ${active ? 'text-white' : allDoneInEx ? 'text-emerald-200' : 'text-gray-100'}`}>{item.name}</span>
                          {active && <span class="shrink-0 rounded-full bg-electricBlue/25 px-2 py-0.5 text-[10px] font-bold text-blue-200">Actual</span>}
                        </div>
                        <p class="truncate text-xs text-gray-400 tabular-nums">{infoLine}</p>
                      </div>
                    </div>
                    <span class={`shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-xs font-bold tabular-nums ${allDoneInEx ? 'text-emerald-300' : 'text-gray-400'}`}>
                      {doneInEx}/{item.sets.length}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p class="px-2.5 py-3 text-xs text-gray-400">Todavía no hay ejercicios en esta sesión.</p>
          )}

          <button type="button" class="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-md bg-electricBlue/15 text-xs font-bold text-blue-300 hover:bg-electricBlue/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" onClick={onOpenAddPicker}>
            <Icon name="plus" className="h-4 w-4" /> Añadir ejercicio al entreno
          </button>

          <div class="border-t border-white/10 pt-2">
            <button
              type="button"
              class="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-md text-xs font-semibold text-coralRed hover:bg-coralRed/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coralRed"
              onClick={onDiscard}
            >
              <Icon name="trash" className="h-3.5 w-3.5" /> Descartar entrenamiento
            </button>
          </div>
        </nav>
    </Collapsible>
  );
}
