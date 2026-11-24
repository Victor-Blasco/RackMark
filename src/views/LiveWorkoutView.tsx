import { useRef } from 'preact/hooks';
import { useCollapsible } from '../hooks/useCollapsible';
import { ExerciseCard } from '../components/workout/ExerciseCard';
import { ExercisePickerSheet } from '../components/workout/ExercisePickerSheet';
import { LiveExerciseMenu } from '../components/workout/LiveExerciseMenu';
import { LiveHeader } from '../components/workout/LiveHeader';
import { AllDoneBanner, PrevCompletedBanner } from '../components/workout/LiveStatusBanners';
import { RestTimerBar } from '../components/workout/RestTimerBar';
import { RoutineDayPicker } from '../components/workout/RoutineDayPicker';
import { useAppStore } from '../store/appStore';
import { buildDayPickerItems, buildLiveWorkoutViewModel } from '../store/workoutSelectors';
import { quickExSuggestions } from '../store/exerciseCatalog';
import type { State } from '../ui/shared';

interface LiveWorkoutViewProps {
  /** Estado explícito opcional (permite renderizado aislado en tests). */
  state?: State;
}

/**
 * Vista principal de entrenamiento `En vivo`: muestra selector de rutina o un único ejercicio activo.
 */
export function LiveWorkoutView({ state: propState }: LiveWorkoutViewProps) {
  const { state: storeState, live: actions, setTab } = useAppStore();
  const state = propState ?? storeState;
  const live = state.liveWorkout;

  const lastModeRef = useRef<'add' | 'swap'>('add');
  if (live?.pickerMode) lastModeRef.current = live.pickerMode;
  const pickerOpen = Boolean(live?.pickerMode);
  const { mounted: pickerMounted, expanded: pickerExpanded } = useCollapsible(pickerOpen);

  if (!live) {
    return (
      <RoutineDayPicker
        items={buildDayPickerItems(state)}
        onStartWorkout={(day) => actions.start(day)}
        onGoToLog={() => setTab('log')}
      />
    );
  }

  const vm = buildLiveWorkoutViewModel(state, live);
  const pickerMode = live.pickerMode ?? lastModeRef.current;
  const pickerData = pickerMounted
    ? quickExSuggestions(state, live.day, live.exercises.map((e) => e.name), 8, pickerMode === 'swap' ? vm.currentEx?.name : undefined)
    : null;
  const secondarySave = vm.allDone || (!vm.currentEx && !pickerOpen);

  return (
    <div class="mx-auto max-w-xl space-y-3">
      <div>
        <LiveHeader
          day={live.day}
          dayColor={vm.dayColor}
          curIdx={vm.curIdx}
          total={vm.total}
          doneSetsCount={vm.doneSetsCount}
          totalSetsCount={vm.totalSetsCount}
          elapsedLabel={vm.elapsedLabel}
          menuOpen={Boolean(live.exMenuOpen)}
          secondarySave={secondarySave}
          onToggleMenu={actions.toggleMenu}
          onDiscard={() => void actions.discard()}
          onSave={() => void actions.save()}
        />

        <LiveExerciseMenu
          open={Boolean(live.exMenuOpen)}
          curIdx={vm.curIdx}
          doneExCount={vm.doneExCount}
          items={vm.menuItems}
          onToggleMenu={actions.toggleMenu}
          onSelectExercise={actions.selectExercise}
          onOpenAddPicker={() => actions.openPicker('add')}
        />
      </div>

      {vm.prevBannerEx && vm.prevIdx != null && (
        <PrevCompletedBanner
          prevIdx={vm.prevIdx}
          prevName={vm.prevBannerEx.name}
          summary={vm.prevSummary}
          onGoBack={() => actions.selectExercise(vm.prevIdx!)}
          onAddExtraSet={actions.addExtraSetPrev}
          onDismiss={actions.clearPrevBanner}
        />
      )}

      {vm.allDone && (
        <AllDoneBanner
          doneExCount={vm.doneExCount}
          doneSetsCount={vm.doneSetsCount}
          elapsedLabel={vm.elapsedLabel}
          onSave={() => void actions.save()}
          onAddExercise={() => actions.openPicker('add')}
        />
      )}

      <RestTimerBar
        restUntil={live.restUntil}
        targetRestSec={live.targetRestSec}
        onAdjust={actions.adjustRest}
        onStart={actions.startRest}
        onStop={actions.stopRest}
        onSelectPreset={actions.setRestPreset}
      />

      {pickerMounted && pickerData && (
        <div class={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${pickerExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`}>
          <div class="overflow-hidden" inert={!pickerOpen}>
            <ExercisePickerSheet mode={pickerMode} currentExName={vm.currentEx?.name} available={pickerData.avail} quickSuggestions={pickerData.quick} settings={state.settings} query={live.pickerQuery ?? ''} onQueryChange={actions.setPickerQuery} onPick={actions.pickExercise} onClose={actions.closePicker} />
          </div>
        </div>
      )}

      {!vm.currentEx && !pickerOpen && (
        <div class="rounded-2xl border border-white/10 bg-cardDark p-5 text-center space-y-3">
          <p class="text-sm text-gray-300">Esta rutina todavía no tiene ejercicios añadidos.</p>
          <button type="button" class="btn-primary min-h-[44px]" onClick={() => actions.openPicker('add')}>
            + Añadir primer ejercicio al entreno
          </button>
        </div>
      )}

      {vm.currentEx && vm.activeCtx && (
        <ExerciseCard
          curIdx={vm.curIdx}
          exercise={vm.currentEx}
          ctx={vm.activeCtx}
          targetRestSec={live.targetRestSec}
          actions={actions}
        />
      )}

      {vm.total > 1 && (
        <div class="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
          <button type="button" class="flex min-h-[44px] items-center justify-center rounded-lg text-xs sm:text-sm font-semibold text-gray-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue disabled:opacity-30" disabled={vm.curIdx === 0} onClick={actions.prevExercise}>
            ← Anterior
          </button>
          <button type="button" class="flex min-h-[44px] items-center justify-center rounded-lg text-xs sm:text-sm font-semibold text-gray-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue disabled:opacity-30" disabled={vm.curIdx >= vm.total - 1} onClick={actions.nextExercise}>
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
