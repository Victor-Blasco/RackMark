import { useEffect, useState } from 'preact/hooks';
import { useDismissibleMenu } from '../../hooks/useDismissibleMenu';
import { effectiveLoadKg } from '../../lib/analysis';
import type { exerciseContext } from '../../store/exerciseCatalog';
import type { LiveWorkoutActions } from '../../store/workoutActions';
import type { LogExDraft } from '../../types';
import { fmtMMSS } from '../../ui/restAudio';
import { r1 } from '../../ui/shared';
import { Collapsible } from '../common/Collapsible';
import { ExercisePrescriptionBanner } from '../common/ExercisePrescriptionBanner';
import { Icon } from '../common/Icon';
import { ExerciseCardMenu } from './ExerciseCardMenu';
import { ExerciseHistoryDrawer } from './ExerciseHistoryDrawer';
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

const PILL_BTN = 'min-h-[44px] sm:min-h-[34px] inline-flex items-center rounded-xl border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue';

/** Vista plana y compacta del único ejercicio activo en `En vivo` con menú `⋯`, series en 1 fila y toggles. */
export function ExerciseCard({ curIdx, exercise: ex, ctx, targetRestSec, actions }: ExerciseCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(() => Boolean(ex.note.trim()));
  const { open: menuOpen, setOpen: setMenuOpen, triggerRef, menuRef } = useDismissibleMenu();

  useEffect(() => {
    setShowDetails(false);
    setHistoryOpen(false);
    setMenuOpen(false);
    setNoteOpen(Boolean(ex.note.trim()));
  }, [ex.name]);

  useEffect(() => {
    if (ex.note.trim()) setNoteOpen(true);
  }, [ex.note]);

  const detailsCount = ex.sets.filter((s) => s.rir != null || s.restSec != null).length;
  const hasNote = Boolean(ex.note.trim());
  const act = (fn: () => void) => { setMenuOpen(false); fn(); };
  const colWeightLabel = ctx.loadType === 'weighted' ? 'Lastre (+kg)' : ctx.loadType === 'assisted' ? 'Asistencia (−kg)' : 'Peso (kg)';
  const firstW = ex.sets[0]?.w ?? 0;

  return (
    <section aria-label={`Ejercicio actual: ${ex.name}`} class="space-y-2.5 pt-1">
      <div class="space-y-1.5">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <h2 class="text-xl font-extrabold text-white leading-tight">{ex.name}</h2>
            <p class="mt-0.5 text-xs text-gray-300 tabular-nums">
              {ctx.tgt && <><span class="text-gray-400">Objetivo {ctx.tgt.sets}×{ctx.tgt.reps}</span> · </>}
              {ctx.tgt?.restSec != null && <><span class="text-blue-300">Descanso {fmtMMSS(ctx.tgt.restSec)}</span> · </>}
              {ctx.hist && ctx.hist.n > 0 ? (
                <button type="button" class="underline decoration-white/30 underline-offset-2 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue rounded" onClick={() => setHistoryOpen(true)}>{ctx.lastRef}</button>
              ) : ctx.lastRef}
            </p>
            {ctx.loadType !== 'external' && ctx.bodyWeightKg != null && (
              <p class="mt-0.5 text-[11px] text-blue-300 tabular-nums">
                Carga real S1: {r1(effectiveLoadKg(firstW, ctx.loadType, ctx.bodyWeightKg))} kg (BW {r1(ctx.bodyWeightKg)} kg)
              </p>
            )}
          </div>
          <div class="relative flex shrink-0 items-center gap-1" ref={menuRef}>
            <span class={`text-xs font-bold tabular-nums ${ctx.allDoneInEx ? 'text-emerald-300' : 'text-gray-400'}`}>
              {ctx.doneInEx}/{ex.sets.length} {ex.sets.length === 1 ? 'serie' : 'series'}
            </span>
            <button ref={triggerRef} type="button" aria-haspopup="menu" aria-expanded={menuOpen ? 'true' : 'false'} aria-label={`Opciones de ${ex.name}`} class="flex h-11 w-9 sm:h-9 sm:w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" onClick={() => setMenuOpen((o) => !o)}>
              <Icon name="dotsVertical" className="h-4 w-4" />
            </button>
            {menuOpen && (
              <ExerciseCardMenu
                exName={ex.name} historyCount={ctx.hist?.n ?? 0} loadType={ctx.loadType}
                onOpenHistory={() => act(() => setHistoryOpen(true))}
                onOpenPicker={(mode) => act(() => actions.openPicker(mode))}
                onOpenFixedNote={() => act(() => actions.openFixedNote(ex.name))}
                onSetLoadType={(lt) => act(() => actions.setLoadType(ex.name, lt))}
              />
            )}
          </div>
        </div>

        <ExercisePrescriptionBanner
          prescription={ctx.prescription} targetW={ctx.showApplyBtn ? ctx.targetW : null}
          fixedNote={ctx.fixedNote} firstTimeHint={!ctx.hist && ex.sets.every((s) => s.w === 0)}
          onApplyTarget={(w) => actions.applyTargetWeight(curIdx, w)}
        />
      </div>

      <div>
        <div class="flex items-center gap-1.5 px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          <span class="w-9 shrink-0 text-center">Tipo</span>
          <span class="flex-1 text-center">{colWeightLabel}</span>
          <span class="flex-1 text-center">Reps</span>
          <span class="w-12 sm:w-20 shrink-0 text-center">OK</span>
        </div>
        <div class="divide-y divide-white/10 border-y border-white/10">
          {ex.sets.map((s, si) => {
            let effIdx = 0;
            for (let j = 0; j <= si; j++) if (ex.sets[j].kind !== 'W' && ex.sets[j].kind !== 'D') effIdx++;
            let dropIdx = 0;
            for (let j = si; j >= 0 && ex.sets[j].kind === 'D'; j--) dropIdx++;
            const tagLabel = s.kind === 'W' ? 'W' : s.kind === 'D' ? `↳D${dropIdx}` : `${s.kind === 'F' ? 'F' : 'S'}${effIdx}`;
            return (
              <SetRow key={si} setIndex={si} tagLabel={tagLabel} nextDropNum={dropIdx + 1} canDelete={ex.sets.length > 1} set={s} targetRestSec={targetRestSec} showDetails={showDetails} onStepWeight={(d) => actions.stepWeight(curIdx, si, d)} onWeightChange={(raw, fin) => actions.updateWeight(curIdx, si, raw, fin)} onStepReps={(d) => actions.stepReps(curIdx, si, d)} onRepsChange={(raw, fin) => actions.updateReps(curIdx, si, raw, fin)} onToggleDone={() => actions.toggleSet(curIdx, si)} onRirChange={(raw) => actions.updateRir(curIdx, si, raw)} onRestChange={(raw) => actions.updateRest(curIdx, si, raw)} onSelectKind={(k) => actions.setSetKind(curIdx, si, k)} onAddDrop={() => actions.addDropSet(curIdx, si)} onRemoveDrop={() => actions.delSet(curIdx, si)} />
            );
          })}
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
      <ExerciseHistoryDrawer open={historyOpen} exName={ex.name} hist={ctx.hist} onClose={() => setHistoryOpen(false)} />
    </section>
  );
}
