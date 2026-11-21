import { useLayoutEffect, useRef } from 'preact/hooks';
import { Icon } from '../components/common/Icon';
import { LogAddExerciseSection } from '../components/log/LogAddExerciseSection';
import { LogExerciseCard } from '../components/log/LogExerciseCard';
import { LogRecentSessions } from '../components/log/LogRecentSessions';
import { LogSessionHeader } from '../components/log/LogSessionHeader';
import { useAppStore } from '../store/appStore';
import { exerciseContext } from '../store/exerciseCatalog';
import { buildLogViewModel } from '../store/logSelectors';
import { captureFlipRects, playFlipRects } from '../ui/reorder';
import type { State } from '../ui/shared';

interface LogWorkoutViewProps {
  /** Estado explícito opcional para renderizado SSR en tests. */
  state?: State;
}

/**
 * Vista de registro histórico `Registrar entreno ya hecho` (sin temporizadores en segundo plano).
 */
export function LogWorkoutView({ state: propState }: LogWorkoutViewProps) {
  const { state: storeState, log: actions } = useAppStore();
  const state = propState ?? storeState;
  const vm = buildLogViewModel(state);
  const listRef = useRef<HTMLDivElement>(null);
  const pendingFlipRef = useRef<{ rects: Map<string, DOMRect>; key: string } | null>(null);
  const orderKey = vm.draft.exercises.map((e) => e.name).join('\0');

  useLayoutEffect(() => {
    const pending = pendingFlipRef.current;
    if (!pending) return;
    pendingFlipRef.current = null;
    playFlipRects(listRef.current, pending.rects, pending.key);
  }, [orderKey]);

  return (
    <div class="space-y-4">
      <LogSessionHeader
        state={state}
        routines={vm.routines}
        selectedDay={vm.draft.day}
        date={vm.draft.date}
        exerciseCount={vm.draft.exercises.length}
        doneExCount={vm.doneExCount}
        doneSetsCount={vm.doneSetsCount}
        totalSetsCount={vm.totalSetsCount}
        onOpenLive={actions.openLiveWorkoutTab}
        onReset={() => void actions.resetDraft()}
        onSave={() => void actions.saveSession()}
        onChangeDate={(d) => void actions.changeDate(d)}
        onSelectDay={(d) => void actions.selectDay(d)}
      />

      {vm.draft.exercises.length > 0 ? (
        <div ref={listRef} data-sort-list="log" class="grid grid-cols-1 gap-3 2xl:grid-cols-2 items-start">
          {vm.draft.exercises.map((ex, ei) => (
            <LogExerciseCard
              key={ex.name}
              ei={ei}
              total={vm.draft.exercises.length}
              exercise={ex}
              ctx={exerciseContext(state, vm.draft.day, ex)}
              actions={actions}
              onMoveExercise={(dir) => {
                const rects = captureFlipRects(listRef.current);
                if (rects.size) pendingFlipRef.current = { rects, key: ex.name };
                actions.moveExercise(ei, dir);
              }}
            />
          ))}
        </div>
      ) : (
        <div class="card text-center text-sm text-gray-400">
          No hay ejercicios en el borrador. Elige una rutina arriba o añade ejercicios abajo.
        </div>
      )}

      <div class="flex flex-wrap items-center justify-between gap-2">
        <button type="button" class="btn min-h-[44px]" onClick={() => void actions.resetDraft()}>
          <Icon name="reset" className="h-4 w-4" /> Reiniciar borrador
        </button>
        <button type="button" class="btn-primary min-h-[44px] px-5 py-2.5 tabular-nums" onClick={() => void actions.saveSession()}>
          <Icon name="save" className="h-4 w-4" /> Guardar sesión ({vm.doneSetsCount} {vm.doneSetsCount === 1 ? 'serie' : 'series'})
        </button>
      </div>

      <LogAddExerciseSection
        availableCount={vm.avail.length}
        quickSuggestions={vm.quick}
        onOpenPicker={actions.openExercisePicker}
        onAddExercise={(name) => actions.addExerciseByName(name)}
      />

      <LogRecentSessions
        state={state}
        routines={vm.routines}
        sessions={vm.recentSessions}
        onEditSession={(id, date, day) => void actions.editHistorySession(id, date, day)}
        onDeleteSession={(id, date) => void actions.deleteHistorySession(id, date)}
      />
    </div>
  );
}
