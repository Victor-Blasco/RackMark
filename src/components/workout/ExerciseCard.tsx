import { useEffect, useState } from 'preact/hooks';
import { useDismissibleMenu } from '../../hooks/useDismissibleMenu';
import type { exerciseContext } from '../../store/exerciseCatalog';
import type { LiveWorkoutActions } from '../../store/workoutActions';
import type { LogExDraft } from '../../types';
import { Collapsible } from '../common/Collapsible';
import { Icon } from '../common/Icon';
import { SetRow } from './SetRow';

interface ExerciseCardProps {
  /** Índice base 0 del ejercicio activo en la sesión. */
  curIdx: number;
  /** Datos editables del ejercicio actual y sus series. */
  exercise: LogExDraft;
  /** Contexto histórico, prescripción y contadores del ejercicio. */
  ctx: ReturnType<typeof exerciseContext>;
  /** Descanso objetivo configurado para el entrenamiento en segundos. */
  targetRestSec: number;
  /** Acciones reactivas de manipulación de series y modales. */
  actions: LiveWorkoutActions;
}

const MENU_ITEM = 'min-h-[44px] sm:min-h-[36px] w-full flex items-center gap-2 rounded-lg px-2.5 text-left text-xs font-semibold text-gray-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue';
const PILL_BTN = 'min-h-[44px] sm:min-h-[34px] inline-flex items-center rounded-xl border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue';

/** Vista plana y compacta del único ejercicio activo en `En vivo` con menú `⋯`, series en 1 fila y toggles. */
export function ExerciseCard({ curIdx, exercise: ex, ctx, targetRestSec, actions }: ExerciseCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [noteOpen, setNoteOpen] = useState(() => Boolean(ex.note.trim()));
  const { open: menuOpen, setOpen: setMenuOpen, triggerRef, menuRef } = useDismissibleMenu();

  useEffect(() => {
    setShowDetails(false);
    setMenuOpen(false);
    setNoteOpen(Boolean(ex.note.trim()));
  }, [ex.name]);

  useEffect(() => {
    if (ex.note.trim()) setNoteOpen(true);
  }, [ex.note]);

  const showBanner = Boolean(ctx.prescription || ctx.fixedNote || (!ctx.hist && ex.sets.every((s) => s.w === 0)));
  const detailsCount = ex.sets.filter((s) => s.rir != null || s.restSec != null).length;
  const hasNote = Boolean(ex.note.trim());
  const act = (fn: () => void) => { setMenuOpen(false); fn(); };

  return (
    <section aria-label={`Ejercicio actual: ${ex.name}`} class="space-y-2.5 pt-1">
      <div class="space-y-1.5">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <h2 class="text-xl font-extrabold text-white leading-tight">{ex.name}</h2>
            <p class="mt-0.5 text-xs text-gray-300 tabular-nums">
              {ctx.tgt && <><span class="text-gray-400">Objetivo {ctx.tgt.sets}×{ctx.tgt.reps}</span> · </>}
              {ctx.lastRef}
            </p>
          </div>
          <div class="relative flex shrink-0 items-center gap-1">
            <span class={`text-xs font-bold tabular-nums ${ctx.allDoneInEx ? 'text-emerald-300' : 'text-gray-400'}`}>
              {ctx.doneInEx}/{ex.sets.length} {ex.sets.length === 1 ? 'serie' : 'series'}
            </span>
            <button ref={triggerRef} type="button" aria-haspopup="menu" aria-expanded={menuOpen ? 'true' : 'false'} aria-label={`Opciones de ${ex.name}`} class="flex h-11 w-9 sm:h-9 sm:w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" onClick={() => setMenuOpen((o) => !o)}>
              <Icon name="dotsVertical" className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div ref={menuRef} role="menu" aria-label={`Acciones de ${ex.name}`} class="absolute right-0 top-11 z-30 w-52 rounded-xl border border-white/10 bg-modalDark p-1.5 shadow-2xl space-y-0.5">
                <button type="button" role="menuitem" class={MENU_ITEM} onClick={() => act(() => actions.openPicker('swap'))}><Icon name="refresh" className="h-3.5 w-3.5 text-blue-300" /> Cambiar ejercicio</button>
                <button type="button" role="menuitem" class={MENU_ITEM} onClick={() => act(() => actions.openPicker('add'))}><Icon name="plus" className="h-3.5 w-3.5 text-blue-300" /> Añadir ejercicio</button>
                <button type="button" role="menuitem" class={MENU_ITEM} onClick={() => act(() => actions.openFixedNote(ex.name))}><Icon name="edit" className="h-3.5 w-3.5 text-gray-400" /> Nota fija (siempre)</button>
              </div>
            )}
          </div>
        </div>

        {showBanner && (
          <div class="space-y-1 border-l-2 border-emeraldGreen/70 pl-2.5 text-xs">
            {ctx.prescription ? (
              <div class="flex flex-wrap items-center justify-between gap-2 text-gray-200">
                <span>{ctx.prescription}</span>
                {ctx.showApplyBtn && ctx.targetW != null && (
                  <button type="button" class="inline-flex min-h-[44px] sm:min-h-[34px] items-center rounded-lg px-2 font-bold text-emerald-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" onClick={() => actions.applyTargetWeight(curIdx, ctx.targetW!)}>Aplicar {ctx.targetW} kg</button>
                )}
              </div>
            ) : (
              <p class="text-gray-300">Primera vez: empieza con un peso cómodo donde controles bien todas las repeticiones.</p>
            )}
            {ctx.fixedNote && <p class="text-gray-300"><span class="font-semibold text-white">Nota fija:</span> {ctx.fixedNote}</p>}
          </div>
        )}
      </div>

      <div>
        <div class="flex items-center gap-1.5 px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          <span class="w-5 shrink-0 text-center">#</span>
          <span class="flex-1 text-center">Peso (kg)</span>
          <span class="flex-1 text-center">Reps</span>
          <span class="w-12 sm:w-20 shrink-0 text-center">OK</span>
        </div>
        <div class="divide-y divide-white/10 border-y border-white/10">
          {ex.sets.map((s, si) => (
            <SetRow key={si} setIndex={si} set={s} targetRestSec={targetRestSec} showDetails={showDetails} onStepWeight={(d) => actions.stepWeight(curIdx, si, d)} onWeightChange={(raw, fin) => actions.updateWeight(curIdx, si, raw, fin)} onStepReps={(d) => actions.stepReps(curIdx, si, d)} onRepsChange={(raw, fin) => actions.updateReps(curIdx, si, raw, fin)} onToggleDone={() => actions.toggleSet(curIdx, si)} onRirChange={(raw) => actions.updateRir(curIdx, si, raw)} onRestChange={(raw) => actions.updateRest(curIdx, si, raw)} />
          ))}
        </div>
        <Collapsible open={showDetails} keepMounted>
          <p class="px-1 pt-1.5 text-[11px] text-gray-400">RIR: reps en reserva (0 = al fallo · 2 = te guardas 2)</p>
        </Collapsible>
      </div>

      <div class="space-y-2 pt-1">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-3">
            <button type="button" class="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-1 text-xs sm:text-sm font-bold text-blue-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" onClick={() => actions.addSet(curIdx)}>+ Añadir serie</button>
            {ex.sets.length > 1 && <button type="button" class="inline-flex min-h-[44px] items-center rounded-lg px-1 text-xs font-semibold text-rose-300 hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" onClick={() => actions.delSet(curIdx, ex.sets.length - 1)}>− Quitar serie</button>}
          </div>
          <div class="flex items-center gap-1.5">
            <button type="button" aria-expanded={showDetails ? 'true' : 'false'} class={`${PILL_BTN} tabular-nums ${showDetails ? 'border-electricBlue bg-electricBlue/15 text-blue-300' : 'border-white/10 text-gray-300 hover:text-white'}`} onClick={() => setShowDetails((v) => !v)}>RIR · Desc.{detailsCount > 0 ? ` · ${detailsCount}` : ''}</button>
            <button type="button" aria-expanded={noteOpen ? 'true' : 'false'} class={`${PILL_BTN} ${noteOpen || hasNote ? 'border-electricBlue bg-electricBlue/15 text-blue-300' : 'border-white/10 text-gray-300 hover:text-white'}`} onClick={() => setNoteOpen((v) => !v)}>{hasNote ? 'Nota de hoy' : '+ Nota de hoy'}</button>
          </div>
        </div>
        <Collapsible open={noteOpen} keepMounted>
          <input class="w-full min-h-[44px] rounded-sm border-b border-white/15 bg-transparent py-2 text-base sm:text-sm text-gray-200 placeholder-gray-400 focus:border-electricBlue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" enterKeyHint="done" value={ex.note} placeholder="Nota de hoy (sensaciones, ajustes)…" aria-label={`Nota para ${ex.name}`} onInput={(e) => actions.updateNote(curIdx, e.currentTarget.value)} />
        </Collapsible>
      </div>
    </section>
  );
}
