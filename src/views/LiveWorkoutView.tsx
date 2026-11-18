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
  const pickerData = live.pickerMode
    ? quickExSuggestions(state, live.day, live.exercises.map((e) => e.name), 8)
    : null;

  return (
    <div class="mx-auto max-w-xl space-y-3">
      <LiveHeader
        day={live.day}
        dayColor={vm.dayColor}
        curIdx={vm.curIdx}
        total={vm.total}
        doneSetsCount={vm.doneSetsCount}
        totalSetsCount={vm.totalSetsCount}
        elapsedLabel={vm.elapsedLabel}
        menuOpen={Boolean(live.exMenuOpen)}
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

      {vm.prevBannerEx && live.lastCompletedExIdx != null && (
        <PrevCompletedBanner
          prevName={vm.prevBannerEx.name}
          prevIdx={live.lastCompletedExIdx}
          onGoBack={() => actions.selectExercise(live.lastCompletedExIdx!)}
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

      {live.pickerMode && pickerData && (
        <ExercisePickerSheet
          mode={live.pickerMode}
          currentExName={vm.currentEx?.name}
          available={pickerData.avail}
          quickSuggestions={pickerData.quick}
          query={live.pickerQuery ?? ''}
          onQueryChange={actions.setPickerQuery}
          onPick={actions.pickExercise}
          onClose={actions.closePicker}
        />
      )}

      {!vm.currentEx && !live.pickerMode && (
        <div class="rounded-2xl border border-white/10 bg-cardDark p-5 text-center space-y-3">
          <p class="text-sm text-gray-300">Esta rutina todavía no tiene ejercicios añadidos.</p>
          <button type="button" class="btn-primary min-h-[44px]" data-act="liveOpenPicker" data-arg="add" onClick={() => actions.openPicker('add')}>
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
          <button type="button" class="flex min-h-[44px] items-center justify-center text-xs sm:text-sm font-semibold text-gray-300 hover:text-white disabled:opacity-30" data-act="livePrevEx" disabled={vm.curIdx === 0} onClick={actions.prevExercise}>
            ← Anterior
          </button>
          <button type="button" class="flex min-h-[44px] items-center justify-center text-xs sm:text-sm font-semibold text-gray-300 hover:text-white disabled:opacity-30" data-act="liveNextEx" disabled={vm.curIdx >= vm.total - 1} onClick={actions.nextExercise}>
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
