import type { exerciseContext } from '../../store/exerciseCatalog';
import type { LogWorkoutActions } from '../../store/logActions';
import type { LogExDraft } from '../../types';
import { Icon } from '../common/Icon';
import { StepperInput } from '../common/StepperInput';
import { LogExerciseHeader } from './LogExerciseHeader';

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
}

const LOG_STEP_BTN = 'flex h-11 w-11 shrink-0 items-center justify-center border border-gray-700 bg-gray-900 text-base font-bold text-gray-200 hover:border-electricBlue active:scale-95';

/**
 * Bloque de ejercicio dentro de `Registrar hecho` con reordenamiento y edición por series.
 */
export function LogExerciseCard({ ei, total, exercise: ex, ctx, actions }: LogExerciseCardProps) {
  const borderCls = ctx.allDoneInEx ? 'border-emeraldGreen/50' : ctx.doneInEx > 0 ? 'border-electricBlue/50' : 'border-white/10';

  return (
    <div data-sort-item data-sort-idx={ei} class={`border-t pt-4 sm:rounded-2xl sm:border sm:bg-cardDark sm:p-4 space-y-3 transition-colors ${borderCls}`}>
      <LogExerciseHeader
        ei={ei}
        total={total}
        exercise={ex}
        ctx={ctx}
        onToggleExercise={() => actions.toggleExercise(ei)}
        onMoveExercise={(dir) => actions.moveExercise(ei, dir)}
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
          {ctx.fixedNote && <p class="text-gray-300"><span class="font-semibold text-white">Fija:</span> {ctx.fixedNote}</p>}
        </div>
      )}

      <div class="divide-y divide-white/10">
        <div class="hidden sm:flex items-center gap-1.5 px-1.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          <span class="w-5 shrink-0" />
          <span class="flex-1 text-center">Peso (kg · ±2,5)</span>
          <span class="flex-1 text-center">Reps (±1)</span>
          <span class="w-20 shrink-0 text-center">Desc (s)</span>
          <span class="w-11 shrink-0 text-center">OK</span>
        </div>

        {ex.sets.map((s, si) => (
          <div key={si} class={`flex flex-wrap sm:flex-nowrap items-center gap-1.5 rounded-xl p-1.5 transition-colors ${s.done ? 'bg-emeraldGreen/10' : ''}`}>
            <span class={`w-5 shrink-0 text-center tabular-nums text-xs font-bold ${s.done ? 'text-emerald-300' : 'text-gray-400'}`}>S{si + 1}</span>
            <StepperInput
              label="Peso (kg)"
              labelClass="mb-0.5 block sm:hidden text-[11px] font-semibold uppercase tracking-wide text-gray-400"
              value={s.w}
              step="0.5"
              inputMode="decimal"
              inputAria={`Peso en kg serie ${si + 1} de ${ex.name}`}
              delta={2.5}
              decAria={`Restar 2,5 kg a serie ${si + 1} de ${ex.name}`}
              incAria={`Sumar 2,5 kg a serie ${si + 1} de ${ex.name}`}
              btnClass={LOG_STEP_BTN}
              onStep={(d) => actions.stepWeight(ei, si, d)}
              onInputValue={(raw) => actions.updateWeight(ei, si, raw, false)}
              onBlurValue={(raw) => actions.updateWeight(ei, si, raw, true)}
            />
            <StepperInput
              label="Reps"
              labelClass="mb-0.5 block sm:hidden text-[11px] font-semibold uppercase tracking-wide text-gray-400"
              value={s.r}
              step="1"
              inputMode="numeric"
              inputAria={`Repeticiones serie ${si + 1} de ${ex.name}`}
              delta={1}
              decAria={`Restar 1 repetición a serie ${si + 1} de ${ex.name}`}
              incAria={`Sumar 1 repetición a serie ${si + 1} de ${ex.name}`}
              btnClass={LOG_STEP_BTN}
              onStep={(d) => actions.stepReps(ei, si, d)}
              onInputValue={(raw) => actions.updateReps(ei, si, raw, false)}
              onBlurValue={(raw) => actions.updateReps(ei, si, raw, true)}
            />
            <div class="shrink-0">
              <span class="mb-0.5 block sm:hidden text-[11px] font-semibold uppercase tracking-wide text-gray-400">Desc (s)</span>
              <input class="inp h-11 w-20 px-2 py-0 text-center text-base sm:text-xs font-semibold tabular-nums" type="number" step="5" min="0" max="1800" inputMode="numeric" value={s.restSec ?? ''} placeholder="Desc (s)" aria-label={`Descanso en segundos serie ${si + 1} de ${ex.name}`} onInput={(e) => actions.updateRest(ei, si, e.currentTarget.value)} />
            </div>
            <div class="shrink-0">
              <span class="mb-0.5 block sm:hidden text-[11px] font-semibold uppercase tracking-wide text-gray-400">RIR</span>
              <input class="inp h-11 w-14 px-2 py-0 text-center text-base sm:text-xs font-semibold tabular-nums" type="number" step="1" min="0" max="10" inputMode="numeric" value={s.rir ?? ''} placeholder="RIR" aria-label={`RIR de serie ${si + 1} de ${ex.name}`} onInput={(e) => actions.updateRir(ei, si, e.currentTarget.value)} />
            </div>
            <button type="button" aria-pressed={s.done ? 'true' : 'false'} aria-label={`${s.done ? 'Desmarcar' : 'Completar'} serie ${si + 1} de ${ex.name}`} class={`ml-auto sm:ml-0 self-end flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors active:scale-95 ${s.done ? 'border-emeraldGreen bg-emeraldGreen text-gray-950' : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-emeraldGreen/60 hover:text-white'}`} style={{ touchAction: 'manipulation' }} onClick={() => actions.toggleSet(ei, si)}>
              <Icon name="check" className="h-5 w-5" />
            </button>
          </div>
        ))}
      </div>

      <div class="flex flex-wrap items-center gap-2 pt-1">
        <button type="button" class="btn min-h-[44px] px-3 text-xs sm:text-sm" onClick={() => actions.addSet(ei)}>+ Serie</button>
        {ex.sets.length > 1 && (
          <button type="button" class="btn min-h-[44px] px-3 text-xs sm:text-sm text-coralRed" aria-label={`Quitar última serie de ${ex.name}`} onClick={() => actions.delSet(ei, ex.sets.length - 1)}>
            − Serie
          </button>
        )}
        <input class="inp min-h-[44px] min-w-[160px] flex-1 py-1.5" value={ex.note} placeholder="Nota (RIR, sensaciones…)" aria-label={`Nota de sesión para ${ex.name}`} onInput={(e) => actions.updateNote(ei, e.currentTarget.value)} />
        <button type="button" class="btn min-h-[44px] px-2.5 text-xs" aria-label={`Editar nota biomecánica fija de ${ex.name}`} onClick={() => actions.openFixedNote(ex.name)}>
          <Icon name="edit" className="h-3.5 w-3.5" /> Fija
        </button>
      </div>
    </div>
  );
}
