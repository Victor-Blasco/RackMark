import { useMemo, useState } from 'preact/hooks';
import { Collapsible } from '../components/common/Collapsible';
import { Icon } from '../components/common/Icon';
import { DayMasterList } from '../components/day/DayMasterList';
import { DayOrganizeBar } from '../components/day/DayOrganizeBar';
import { DayRoutineHeader } from '../components/day/DayRoutineHeader';
import { PlanSidebarWidgets } from '../components/plan/PlanSidebarWidgets';
import { buildDayRoutineViewModel } from '../store/daySelectors';
import { useAppStore } from '../store/appStore';
import type { DayName } from '../types';
import { routineNames, type State } from '../ui/shared';

interface DayRoutineViewProps {
  /** Identificador de la rutina a mostrar (`Push`, `Pull`, personalizada…). */
  day: DayName;
  /** Estado explícito opcional para renderizado SSR en tests. */
  state?: State;
}

/**
 * Vista unificada de rutina: progreso por ejercicio, edición directa de series×reps, organización y volumen semanal.
 */
export function DayRoutineView({ day, state: propState }: DayRoutineViewProps) {
  const { state: storeState, plan, openFixedNote } = useAppStore();
  const state = propState ?? storeState;
  const vm = useMemo(
    () => buildDayRoutineViewModel(state, day),
    [state.analysis, state.settings, state.sel, state.dayExtra, state.ranges, state.customRanges, day],
  );
  const [organizeOpen, setOrganizeOpen] = useState(false);
  const [simOpen, setSimOpen] = useState(false);
  const routineRows = state.settings.routines[day] ?? [];
  const totalRoutines = routineNames(state.settings).length;

  const updateTarget = async (idx: number, setsRaw: string, repsRaw: string) => {
    await plan.changeRoutineExSets(day, idx, setsRaw);
    await plan.changeRoutineExReps(day, idx, repsRaw);
  };

  const organizeBar = (
    <Collapsible open={organizeOpen}>
      <DayOrganizeBar
        day={day}
        routineCount={totalRoutines}
        onAddExercise={() => plan.openRoutineExercisePicker(day)}
        onApplyTemplate={(k) => void plan.applyTemplate(k)}
        onNewRoutine={plan.openRoutineModalNew}
        onEditRoutine={() => plan.openRoutineModalEdit(day)}
        onDeleteRoutine={() => void plan.removeRoutineDay(day)}
        onOpenCatalog={() => plan.openPlanTab('exercises')}
      />
    </Collapsible>
  );

  if (vm.isEmpty) {
    return (
      <div class="space-y-4">
        <div class="card flex flex-wrap items-center justify-between gap-3 text-sm text-gray-300">
          <p>Esta rutina aún no tiene ejercicios asignados.</p>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="btn-primary-sm" onClick={() => plan.openRoutineExercisePicker(day)}>+ Añadir ejercicio</button>
            <button type="button" class="btn-sm" onClick={() => setOrganizeOpen((v) => !v)}>{organizeOpen ? 'Ocultar opciones' : 'Plantillas / día'}</button>
            <button type="button" class="btn-sm whitespace-nowrap" onClick={() => plan.startWorkout(day)}>
              <Icon name="play" className="h-3.5 w-3.5" /> Iniciar {day}
            </button>
          </div>
        </div>
        {organizeBar}
      </div>
    );
  }

  return (
    <div class="space-y-5">
      <DayRoutineHeader
        day={day}
        dayColor={vm.dayColor}
        sessCount={vm.sess.length}
        lastSess={vm.lastS}
        bounds={vm.bounds}
        hasFilter={vm.hasFilter}
        customRange={state.customRanges?.[day]}
        unmappedCount={state.analysis.unmapped.length}
        organizeOpen={organizeOpen}
        simOpen={simOpen}
        showingExtra={vm.showingExtra}
        primaryCount={vm.primary.length}
        extraCount={vm.extraAll.length}
        onOpenUnmapped={plan.openUnmapped}
        onToggleOrganize={() => setOrganizeOpen((v) => !v)}
        onToggleSim={() => setSimOpen((v) => !v)}
        onOpenLog={() => plan.openLog(day)}
        onStartWorkout={() => plan.startWorkout(day)}
        onSetScope={(s) => plan.setDayScope(day, s)}
        onSelectRange={(k) => plan.setRange(day, k)}
        onChangeFrom={(val) => plan.setCustomRangeDate(day, 'from', val)}
        onChangeTo={(val) => plan.setCustomRangeDate(day, 'to', val)}
      />

      {organizeBar}

      <Collapsible open={simOpen}>
        <PlanSidebarWidgets state={state} inline />
      </Collapsible>

      <DayMasterList
        day={day}
        exercises={vm.visibleList}
        routineRows={routineRows}
        organizeMode={organizeOpen && !vm.showingExtra}
        desktopCur={vm.desktopCur}
        mobileCur={vm.mobileCur}
        desktopEx={vm.desktopEx}
        desktopChartCfg={vm.desktopChartCfg}
        mobileChartCfg={vm.mobileChartCfg}
        rangeLabel={vm.rangeLabel}
        aiDate={state.settings.ai?.date}
        userNotes={state.settings.notes}
        aiFor={vm.aiFor}
        onSelectEx={(name) => plan.selectDayEx(day, name)}
        onStartWorkout={() => plan.startWorkout(day)}
        onEditNote={openFixedNote}
        onUpdateTarget={(idx, setsRaw, repsRaw) => void updateTarget(idx, setsRaw, repsRaw)}
        onMoveRow={(idx, dir) => void plan.moveRoutineRow(day, idx, dir)}
        onDeleteRow={(idx) => void plan.deleteRoutineRow(day, idx)}
        onAddToRoutine={(name) => {
          if (vm.primary.length === 0 && vm.extraAll.length > 1) plan.setDayScope(day, 'extra');
          void plan.quickAddToRoutine(day, name);
        }}
      />
    </div>
  );
}
