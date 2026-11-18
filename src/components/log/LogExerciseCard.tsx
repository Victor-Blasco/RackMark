import type { LogWorkoutActions } from '../../store/logActions';
import type { exerciseContext } from '../../store/exerciseCatalog';
import type { LogExDraft } from '../../types';
import { Icon } from '../common/Icon';
import { StepperInput } from '../common/StepperInput';

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
    <div data-sort-item data-sort-idx={ei} data-ex-idx={ei} class={`border-t pt-4 sm:rounded-2xl sm:border sm:bg-cardDark sm:p-4 space-y-3 transition-colors ${borderCls}`}>
      <div class="flex flex-wrap sm:flex-nowrap items-start justify-between gap-2">
        <div class="flex flex-1 min-w-[190px] items-start gap-2">
          <button type="button" data-sort-handle class="flex h-11 w-11 shrink-0 touch-none cursor-grab active:cursor-grabbing select-none items-center justify-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" aria-label={`Arrastrar para reordenar ${ex.name}`} title="Arrastrar para reordenar">
            <Icon name="grip" className="h-4 w-4" />
          </button>
          <button type="button" data-act="logToggleEx" data-arg={String(ei)} aria-pressed={ctx.allDoneInEx ? 'true' : 'false'} class="flex flex-1 min-w-0 min-h-[44px] items-start gap-2.5 text-left rounded-lg py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" onClick={() => actions.toggleExercise(ei)}>
            <span class={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${ctx.allDoneInEx ? 'border-emeraldGreen bg-emeraldGreen/20 text-emeraldGreen' : ctx.doneInEx > 0 ? 'border-electricBlue bg-electricBlue/20 text-blue-300' : 'border-gray-600 text-transparent'}`}>
              <Icon name="check" className="h-4 w-4" />
            </span>
            <div class="min-w-0">
              <div class="font-bold text-white leading-snug">
                {ex.name}{' '}
                {ctx.tgt && <span class="ml-1 tabular-nums text-[13px] font-normal text-gray-400">({ctx.tgt.sets}×{ctx.tgt.reps})</span>}{' '}
                <span data-ex-counter={ei} class={`ml-1 tabular-nums text-xs font-semibold ${ctx.allDoneInEx ? 'text-emerald-300' : 'text-gray-400'}`}>
                  {ctx.doneInEx}/{ex.sets.length}
                </span>
              </div>
              <div class="tabular-nums text-xs sm:text-[13px] text-gray-300">{ctx.lastRef}</div>
            </div>
          </button>
        </div>

        <div class="ml-auto flex shrink-0 items-center gap-0.5">
          <button type="button" class="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-25 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" data-act="logMoveEx" data-arg={`${ei}|-1`} disabled={ei === 0} aria-label={`Subir ${ex.name}`} title="Subir" onClick={() => actions.moveExercise(ei, -1)}>
            <Icon name="caretUp" className="h-3.5 w-3.5" />
          </button>
          <button type="button" class="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-25 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" data-act="logMoveEx" data-arg={`${ei}|1`} disabled={ei === total - 1} aria-label={`Bajar ${ex.name}`} title="Bajar" onClick={() => actions.moveExercise(ei, 1)}>
            <Icon name="caretDown" className="h-3.5 w-3.5" />
          </button>
          <button type="button" class="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:text-coralRed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" data-act="logRemoveEx" data-arg={String(ei)} aria-label={`Quitar ${ex.name} de la sesión`} onClick={() => actions.removeExercise(ei)}>
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
      </div>

      {(ctx.prescription || ctx.fixedNote) && (
        <div class="space-y-1 border-l-2 border-emeraldGreen/70 pl-2.5 text-xs">
          {ctx.prescription && (
            <div class="flex flex-wrap items-center justify-between gap-2 text-gray-200">
              <span>{ctx.prescription}</span>
              {ctx.showApplyBtn && ctx.targetW != null && (
                <button type="button" class="btn min-h-[44px] px-3 py-1.5 text-xs text-emerald-300 border-emeraldGreen/40 hover:border-emeraldGreen" data-act="logApplyWeight" data-arg={`${ei}|${ctx.targetW}`} onClick={() => actions.applyTargetWeight(ei, ctx.targetW!)}>
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

        {ex.sets.map((s, si) => {
          const key = `${ei}|${si}`;
          return (
            <div key={si} data-set-row={key} class={`flex flex-wrap sm:flex-nowrap items-center gap-1.5 rounded-xl p-1.5 transition-colors ${s.done ? 'bg-emeraldGreen/10' : ''}`}>
              <span class={`w-5 shrink-0 text-center tabular-nums text-xs font-bold ${s.done ? 'text-emerald-300' : 'text-gray-400'}`}>S{si + 1}</span>
              <StepperInput
                label="Peso (kg)"
                labelClass="mb-0.5 block sm:hidden text-[11px] font-semibold uppercase tracking-wide text-gray-400"
                value={s.w}
                step="0.5"
                inputMode="decimal"
                inputData={{ 'data-log-w': key }}
                inputAria={`Peso en kg serie ${si + 1} de ${ex.name}`}
                stepAct="logStepW"
                stepArgPrefix={key}
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
                inputData={{ 'data-log-r': key }}
                inputAria={`Repeticiones serie ${si + 1} de ${ex.name}`}
                stepAct="logStepR"
                stepArgPrefix={key}
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
                <input class="inp h-11 w-20 px-2 py-0 text-center text-base sm:text-xs font-semibold tabular-nums" type="number" step="5" min="0" max="1800" inputMode="numeric" value={s.restSec ?? ''} placeholder="Desc (s)" data-log-rest={key} aria-label={`Descanso en segundos serie ${si + 1} de ${ex.name}`} onInput={(e) => actions.updateRest(ei, si, e.currentTarget.value)} />
              </div>
              <div class="shrink-0">
                <span class="mb-0.5 block sm:hidden text-[11px] font-semibold uppercase tracking-wide text-gray-400">RIR</span>
                <input class="inp h-11 w-14 px-2 py-0 text-center text-base sm:text-xs font-semibold tabular-nums" type="number" step="1" min="0" max="10" inputMode="numeric" value={s.rir ?? ''} placeholder="RIR" data-log-rir={key} aria-label={`RIR de serie ${si + 1} de ${ex.name}`} onInput={(e) => actions.updateRir(ei, si, e.currentTarget.value)} />
              </div>
              <button type="button" data-act="logToggleSet" data-arg={key} aria-pressed={s.done ? 'true' : 'false'} aria-label={`${s.done ? 'Desmarcar' : 'Completar'} serie ${si + 1} de ${ex.name}`} class={`ml-auto sm:ml-0 self-end flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors active:scale-95 ${s.done ? 'border-emeraldGreen bg-emeraldGreen text-gray-950' : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-emeraldGreen/60 hover:text-white'}`} style={{ touchAction: 'manipulation' }} onClick={() => actions.toggleSet(ei, si)}>
                <Icon name="check" className="h-5 w-5" />
              </button>
            </div>
          );
        })}
      </div>

      <div class="flex flex-wrap items-center gap-2 pt-1">
        <button type="button" class="btn min-h-[44px] px-3 text-xs sm:text-sm" data-act="logAddSet" data-arg={String(ei)} onClick={() => actions.addSet(ei)}>+ Serie</button>
        {ex.sets.length > 1 && (
          <button type="button" class="btn min-h-[44px] px-3 text-xs sm:text-sm text-coralRed" data-act="logDelSet" data-arg={`${ei}|${ex.sets.length - 1}`} aria-label={`Quitar última serie de ${ex.name}`} onClick={() => actions.delSet(ei, ex.sets.length - 1)}>
            − Serie
          </button>
        )}
        <input class="inp min-h-[44px] min-w-[160px] flex-1 py-1.5" value={ex.note} data-log-note={ei} placeholder="Nota (RIR, sensaciones…)" aria-label={`Nota de sesión para ${ex.name}`} onInput={(e) => actions.updateNote(ei, e.currentTarget.value)} />
        <button type="button" class="btn min-h-[44px] px-2.5 text-xs" data-act="editNote" data-arg={ex.name} aria-label={`Editar nota biomecánica fija de ${ex.name}`} onClick={() => actions.openFixedNote(ex.name)}>
          <Icon name="edit" className="h-3.5 w-3.5" /> Fija
        </button>
      </div>
    </div>
  );
}
