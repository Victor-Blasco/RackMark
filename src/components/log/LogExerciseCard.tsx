import { useEffect, useState } from 'preact/hooks';
import type { exerciseContext } from '../../store/exerciseCatalog';
import type { LogWorkoutActions } from '../../store/logActions';
import type { LogExDraft } from '../../types';
import { LogExerciseHeader } from './LogExerciseHeader';
import { LogSetRow } from './LogSetRow';

interface LogExerciseCardProps {
  /** Índice base 0 del ejercicio dentro del borrador. */
  ei: number;
  /** Número total de ejercicios del borrador para deshabilitar Subir/Bajar. */
  total: number;
  /** Datos del ejercicio y sus series editables. */
  exercise: LogExDraft;
  /** Contexto histórico, prescripción y notas del ejercicio. */
  ctx: ReturnType<typeof exerciseContext>;
  /** Acciones reactivas del borrador histórico. */
  actions: LogWorkoutActions;
  /** Callback opcional de reordenamiento con animación FLIP. */
  onMoveExercise?: (dir: number) => void;
}

const TOGGLE_PILL =
  'min-h-[44px] sm:min-h-[34px] inline-flex items-center rounded-xl border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue';

/**
 * Bloque compacto de ejercicio dentro de `Registrar hecho` con cabecera única de series y controles bajo demanda.
 */
export function LogExerciseCard({ ei, total, exercise: ex, ctx, actions, onMoveExercise }: LogExerciseCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [noteOpen, setNoteOpen] = useState(() => Boolean(ex.note.trim()));

  useEffect(() => {
    if (ex.note.trim()) setNoteOpen(true);
  }, [ex.note]);

  const detailsCount = ex.sets.filter((s) => s.rir != null || s.restSec != null).length;
  const borderCls = ctx.allDoneInEx ? 'border-emeraldGreen/50' : ctx.doneInEx > 0 ? 'border-electricBlue/50' : 'border-white/10';
  const hasNote = Boolean(ex.note.trim());

  return (
    <div data-sort-item data-sort-idx={ei} data-sort-key={ex.name} class={`border-t pt-4 sm:rounded-2xl sm:border sm:bg-cardDark sm:p-4 space-y-2.5 transition-colors ${borderCls}`}>
      <LogExerciseHeader
        ei={ei}
        total={total}
        exercise={ex}
        ctx={ctx}
        onToggleExercise={() => actions.toggleExercise(ei)}
        onMoveExercise={onMoveExercise ?? ((dir) => actions.moveExercise(ei, dir))}
        onOpenFixedNote={() => actions.openFixedNote(ex.name)}
        onRemoveExercise={() => actions.removeExercise(ei)}
      />

      {(ctx.prescription || ctx.fixedNote) && (
        <div class="space-y-1 border-l-2 border-emeraldGreen/70 pl-2.5 text-xs">
          {ctx.prescription && (
            <div class="flex flex-wrap items-center justify-between gap-2 text-gray-200">
              <span>{ctx.prescription}</span>
              {ctx.showApplyBtn && ctx.targetW != null && (
                <button type="button" class="btn min-h-[44px] px-3 py-1.5 text-xs text-emerald-300 border-emeraldGreen/40 hover:border-emeraldGreen" onClick={() => actions.applyTargetWeight(ei, ctx.targetW!)}>
                  Aplicar {ctx.targetW} kg
                </button>
              )}
            </div>
          )}
          {ctx.fixedNote && <p class="text-gray-300"><span class="font-semibold text-white">Nota fija:</span> {ctx.fixedNote}</p>}
        </div>
      )}

      <div>
        <div class="flex items-center gap-1.5 px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          <span class="w-5 shrink-0 text-center">#</span>
          <span class="flex-1 text-center">Peso (kg)</span>
          <span class="flex-1 text-center">Reps</span>
          <span class="hidden sm:block w-16 shrink-0 text-center">Desc (s)</span>
          <span class="hidden sm:block w-12 shrink-0 text-center cursor-help" title="Reps que te guardaste sin llegar al fallo (0 = al fallo)">RIR</span>
          <span class="w-11 shrink-0 text-center">OK</span>
        </div>

        <div class="divide-y divide-white/[0.06]">
          {ex.sets.map((s, si) => (
            <LogSetRow key={si} ei={ei} si={si} exName={ex.name} set={s} showMobileDetails={showDetails} actions={actions} />
          ))}
        </div>
      </div>

      <div class="space-y-2 pt-1">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-1.5">
            <button type="button" class="btn-sm min-h-[44px] sm:min-h-[34px]" onClick={() => actions.addSet(ei)}>+ Serie</button>
            {ex.sets.length > 1 && (
              <button type="button" class="min-h-[44px] sm:min-h-[34px] inline-flex items-center rounded-xl px-2.5 text-xs font-semibold text-gray-400 hover:text-coralRed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" aria-label={`Quitar última serie de ${ex.name}`} onClick={() => actions.delSet(ei, ex.sets.length - 1)}>
                − Serie
              </button>
            )}
          </div>

          <div class="flex items-center gap-1.5">
            <button
              type="button"
              aria-expanded={showDetails ? 'true' : 'false'}
              title="Reps que te guardaste sin llegar al fallo (0 = al fallo) y descanso entre series"
              class={`sm:hidden ${TOGGLE_PILL} tabular-nums ${showDetails ? 'border-electricBlue bg-electricBlue/15 text-blue-300' : 'border-white/10 text-gray-300 hover:text-white'}`}
              onClick={() => setShowDetails((v) => !v)}
            >
              RIR · Desc.{detailsCount > 0 ? ` · ${detailsCount}` : ''}
            </button>
            <button
              type="button"
              aria-expanded={noteOpen ? 'true' : 'false'}
              class={`${TOGGLE_PILL} ${noteOpen || hasNote ? 'border-electricBlue bg-electricBlue/15 text-blue-300' : 'border-white/10 text-gray-300 hover:text-white'}`}
              onClick={() => setNoteOpen((v) => !v)}
            >
              {hasNote ? 'Nota de hoy' : '+ Nota de hoy'}
            </button>
          </div>
        </div>

        <div class={`grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none ${noteOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div class="overflow-hidden" inert={!noteOpen} aria-hidden={noteOpen ? undefined : 'true'}>
            <div class="pt-1">
              <input class="inp min-h-[44px] py-1.5" enterKeyHint="done" value={ex.note} placeholder="Nota de la sesión (sensaciones, agarre…)" aria-label={`Nota de sesión para ${ex.name}`} onInput={(e) => actions.updateNote(ei, e.currentTarget.value)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
