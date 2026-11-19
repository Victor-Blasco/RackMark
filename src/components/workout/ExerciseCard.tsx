import type { LiveWorkoutActions } from '../../store/workoutActions';
import type { LogExDraft } from '../../types';
import type { exerciseContext } from '../../store/exerciseCatalog';
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

/**
 * Vista plana del único ejercicio activo en `En vivo` con prescripción, series y notas.
 */
export function ExerciseCard({ curIdx, exercise: ex, ctx, targetRestSec, actions }: ExerciseCardProps) {
  const showBanner = Boolean(ctx.prescription || ctx.fixedNote || (!ctx.hist && ex.sets.every((s) => s.w === 0)));

  return (
    <section aria-label={`Ejercicio actual: ${ex.name}`} class="space-y-3 pt-1">
      <div class="space-y-1.5">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <h2 class="text-xl font-extrabold text-white leading-tight">{ex.name}</h2>
            <p class="mt-0.5 text-xs text-gray-300 tabular-nums">
              {ctx.tgt && <><span class="text-gray-400">Objetivo {ctx.tgt.sets}×{ctx.tgt.reps}</span> · </>}
              {ctx.lastRef}
            </p>
          </div>
          <span class={`shrink-0 pt-1 text-xs font-bold tabular-nums ${ctx.allDoneInEx ? 'text-emerald-300' : 'text-gray-400'}`}>
            {ctx.doneInEx}/{ex.sets.length} {ex.sets.length === 1 ? 'serie' : 'series'}
          </span>
        </div>

        {showBanner && (
          <div class="space-y-1 border-l-2 border-emeraldGreen/70 pl-2.5 text-xs">
            {ctx.prescription ? (
              <div class="flex flex-wrap items-center justify-between gap-2 text-gray-200">
                <span>{ctx.prescription}</span>
                {ctx.showApplyBtn && ctx.targetW != null && (
                  <button
                    type="button"
                    class="inline-flex min-h-[44px] sm:min-h-[34px] items-center rounded-lg px-2 font-bold text-emerald-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue"
                    onClick={() => actions.applyTargetWeight(curIdx, ctx.targetW!)}
                  >
                    Aplicar {ctx.targetW} kg
                  </button>
                )}
              </div>
            ) : (
              <p class="text-gray-300">Primera vez: empieza con un peso cómodo donde controles bien todas las repeticiones.</p>
            )}
            {ctx.fixedNote && <p class="text-gray-300"><span class="font-semibold text-white">Nota fija:</span> {ctx.fixedNote}</p>}
          </div>
        )}

        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-xs font-semibold text-gray-300">
          <button type="button" class="inline-flex min-h-[44px] sm:min-h-[36px] items-center gap-1 rounded-lg px-1 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" onClick={() => actions.openPicker('swap')}>
            <Icon name="refresh" className="h-3.5 w-3.5 text-blue-300" /> Cambiar ejercicio
          </button>
          <button type="button" class="inline-flex min-h-[44px] sm:min-h-[36px] items-center gap-1 rounded-lg px-1 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" onClick={() => actions.openPicker('add')}>
            <Icon name="plus" className="h-3.5 w-3.5 text-blue-300" /> Añadir ejercicio
          </button>
          <button type="button" class="inline-flex min-h-[44px] sm:min-h-[36px] items-center gap-1 rounded-lg px-1 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" onClick={() => actions.openFixedNote(ex.name)}>
            <Icon name="edit" className="h-3.5 w-3.5 text-gray-400" /> Nota permanente
          </button>
        </div>
      </div>

      <div class="divide-y divide-white/10 border-y border-white/10">
        {ex.sets.map((s, si) => (
          <SetRow
            key={si}
            setIndex={si}
            set={s}
            targetRestSec={targetRestSec}
            onStepWeight={(d) => actions.stepWeight(curIdx, si, d)}
            onWeightChange={(raw, fin) => actions.updateWeight(curIdx, si, raw, fin)}
            onStepReps={(d) => actions.stepReps(curIdx, si, d)}
            onRepsChange={(raw, fin) => actions.updateReps(curIdx, si, raw, fin)}
            onToggleDone={() => actions.toggleSet(curIdx, si)}
            onRirChange={(raw) => actions.updateRir(curIdx, si, raw)}
            onRestChange={(raw) => actions.updateRest(curIdx, si, raw)}
          />
        ))}
      </div>

      <div class="space-y-2.5 pt-1">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-3">
            <button type="button" class="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-1 text-xs sm:text-sm font-bold text-blue-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" onClick={() => actions.addSet(curIdx)}>
              + Añadir serie
            </button>
            {ex.sets.length > 1 && (
              <button type="button" class="inline-flex min-h-[44px] items-center rounded-lg px-1 text-xs font-semibold text-rose-300 hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" onClick={() => actions.delSet(curIdx, ex.sets.length - 1)}>
                − Quitar serie
              </button>
            )}
          </div>
        </div>
        <input
          class="w-full rounded-sm border-b border-white/15 bg-transparent py-2 text-base sm:text-sm text-gray-200 placeholder-gray-400 focus:border-electricBlue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue"
          enterKeyHint="done"
          value={ex.note}
          placeholder="Nota de hoy (sensaciones, ajustes)…"
          aria-label={`Nota para ${ex.name}`}
          onInput={(e) => actions.updateNote(curIdx, e.currentTarget.value)}
        />
      </div>
    </section>
  );
}
