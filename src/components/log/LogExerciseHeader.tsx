import { useEffect, useRef, useState } from 'preact/hooks';
import type { exerciseContext } from '../../store/exerciseCatalog';
import type { LogExDraft } from '../../types';
import { Icon } from '../common/Icon';

interface LogExerciseHeaderProps {
  /** Índice base 0 del ejercicio dentro del borrador. */
  ei: number;
  /** Número total de ejercicios en el borrador. */
  total: number;
  /** Datos del ejercicio editable. */
  exercise: LogExDraft;
  /** Contexto histórico, prescripción y contadores. */
  ctx: ReturnType<typeof exerciseContext>;
  /** Marca o desmarca todas las series válidas del ejercicio. */
  onToggleExercise: () => void;
  /** Sube o baja el ejercicio en la lista. */
  onMoveExercise: (dir: number) => void;
  /** Abre el modal de nota biomecánica fija del ejercicio. */
  onOpenFixedNote: () => void;
  /** Quita el ejercicio del borrador. */
  onRemoveExercise: () => void;
}

const HEADER_ICON_BTN =
  'flex h-11 w-9 sm:h-9 sm:w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-25 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue';
const MENU_ITEM =
  'min-h-[44px] sm:min-h-[36px] w-full flex items-center gap-2 rounded-lg px-2.5 text-left text-xs font-semibold text-gray-200 hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue';

/** Cabecera interactiva compacta con flechas inline `^ / v`, asa en escritorio y menú secundario `⋯`. */
export function LogExerciseHeader({
  ei,
  total,
  exercise: ex,
  ctx,
  onToggleExercise,
  onMoveExercise,
  onOpenFixedNote,
  onRemoveExercise,
}: LogExerciseHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      setMenuOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const act = (fn: () => void) => {
    setMenuOpen(false);
    fn();
  };

  return (
    <div class="flex items-start justify-between gap-1.5">
      <button type="button" aria-pressed={ctx.allDoneInEx ? 'true' : 'false'} class="flex flex-1 min-w-0 min-h-[44px] items-start gap-2.5 text-left rounded-lg py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" onClick={onToggleExercise}>
        <span class={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${ctx.allDoneInEx ? 'border-emeraldGreen bg-emeraldGreen/20 text-emeraldGreen' : ctx.doneInEx > 0 ? 'border-electricBlue bg-electricBlue/20 text-blue-300' : 'border-gray-600 text-transparent'}`}>
          <Icon name="check" className="h-4 w-4" />
        </span>
        <div class="min-w-0">
          <div class="font-bold text-white leading-snug">
            {ex.name}{' '}
            {ctx.tgt && <span class="ml-1 tabular-nums text-[13px] font-normal text-gray-400">({ctx.tgt.sets}×{ctx.tgt.reps})</span>}{' '}
            <span class={`ml-1 tabular-nums text-xs font-semibold ${ctx.allDoneInEx ? 'text-emerald-300' : 'text-gray-400'}`}>
              {ctx.doneInEx}/{ex.sets.length}
            </span>
          </div>
          <div class="tabular-nums text-xs sm:text-[13px] text-gray-400">{ctx.lastRef}</div>
        </div>
      </button>

      <div class="relative flex shrink-0 items-center gap-0.5">
        <button type="button" data-sort-handle class="hidden sm:flex h-9 w-9 shrink-0 touch-none cursor-grab active:cursor-grabbing select-none items-center justify-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" aria-label={`Arrastrar para reordenar ${ex.name}`} title="Arrastrar para reordenar">
          <Icon name="grip" className="h-4 w-4" />
        </button>
        <button type="button" class={HEADER_ICON_BTN} disabled={ei === 0} aria-label={`Subir ${ex.name}`} title="Subir" onClick={() => onMoveExercise(-1)}>
          <Icon name="caretUp" className="h-3.5 w-3.5" />
        </button>
        <button type="button" class={HEADER_ICON_BTN} disabled={ei === total - 1} aria-label={`Bajar ${ex.name}`} title="Bajar" onClick={() => onMoveExercise(1)}>
          <Icon name="caretDown" className="h-3.5 w-3.5" />
        </button>
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen ? 'true' : 'false'}
          aria-label={`Opciones de ${ex.name}`}
          class={HEADER_ICON_BTN}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <Icon name="dotsVertical" className="h-4 w-4" />
        </button>

        {menuOpen && (
          <div ref={menuRef} role="menu" aria-label={`Acciones de ${ex.name}`} class="absolute right-0 top-12 sm:top-10 z-30 w-52 rounded-xl border border-white/10 bg-modalDark p-1.5 shadow-2xl space-y-0.5">
            <button type="button" role="menuitem" class={MENU_ITEM} onClick={() => act(onOpenFixedNote)}>
              <Icon name="edit" className="h-3.5 w-3.5" /> Nota fija (siempre)
            </button>
            <div class="my-1 border-t border-white/10" role="separator" />
            <button type="button" role="menuitem" class={`${MENU_ITEM} text-coralRed hover:bg-coralRed/10`} onClick={() => act(onRemoveExercise)}>
              <Icon name="close" className="h-3.5 w-3.5" /> Quitar ejercicio
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
