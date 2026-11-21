import { DayMasterList } from '../components/day/DayMasterList';
import { Icon } from '../components/common/Icon';
import { RangePicker } from '../components/common/RangePicker';
import { buildDayRoutineViewModel } from '../store/daySelectors';
import { useAppStore } from '../store/appStore';
import type { DayName } from '../types';
import { fmtDate, type State } from '../ui/shared';

interface DayRoutineViewProps {
  /** Identificador de la rutina a mostrar (`Push`, `Pull`, personalizada…). */
  day: DayName;
  /** Estado explícito opcional para renderizado SSR en tests. */
  state?: State;
}

/**
 * Vista de detalle por rutina con estado, gráfica de progresión y maestro-detalle por ejercicio.
 */
export function DayRoutineView({ day, state: propState }: DayRoutineViewProps) {
  const { state: storeState, plan, openFixedNote } = useAppStore();
  const state = propState ?? storeState;
  const vm = buildDayRoutineViewModel(state, day);

  if (vm.isEmpty) {
    return (
      <div class="card flex flex-wrap items-center justify-between gap-3 text-sm text-gray-300">
        <p>Esta rutina aún no tiene ejercicios asignados.</p>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn-sm" onClick={() => plan.openRoutineInPlan(day)}>Configurar rutina en Plan</button>
          <button type="button" class="btn-primary-sm whitespace-nowrap" onClick={() => plan.startWorkout(day)}>
            <Icon name="play" className="h-3.5 w-3.5" /> Iniciar {day}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div class="space-y-5">
      <section class="pb-4 border-b border-white/10 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="space-y-0.5">
            <div class="flex items-center gap-2">
              <span class="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: vm.dayColor }} aria-hidden="true" />
              <h1 class="text-lg font-extrabold text-white">Rutina {day}</h1>
              <span class="text-xs text-gray-400 tabular-nums">· {vm.sess.length} {vm.sess.length === 1 ? 'sesión' : 'sesiones'}{vm.hasFilter ? ` (${vm.rangeLabel})` : ''}</span>
            </div>
            <p class="text-xs sm:text-sm text-gray-400 tabular-nums">
              {vm.lastS
                ? `Última: ${fmtDate(vm.lastS.date)} · ${vm.lastS.sets} ${vm.lastS.sets === 1 ? 'serie' : 'series'}${vm.lastS.durMin ? ` · ${Math.round(vm.lastS.durMin)} min` : ''}${vm.lastS.avgHr ? ` · Pulso ${vm.lastS.avgHr}${vm.lastS.maxHr ? `/${vm.lastS.maxHr}` : ''} lpm` : ''}${vm.lastS.kcal ? ` · ${vm.lastS.kcal} kcal` : ''}`
                : `Sin sesiones en ${vm.rangeLabel}`}
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {state.analysis.unmapped.length > 0 && (
              <button type="button" class="btn-sm border-amberGold/40 text-amberGold tabular-nums" onClick={plan.openUnmapped}>
                {state.analysis.unmapped.length} sin nombre
              </button>
            )}
            <button type="button" class="btn-sm sm:text-sm" onClick={() => plan.openRoutineInPlan(day)}>
              <Icon name="edit" className="h-3.5 w-3.5" /> Editar rutina
            </button>
            <button type="button" class="btn-sm sm:text-sm" onClick={() => plan.openLog(day)}>Registrar hecho</button>
            <button type="button" class="btn-primary-sm flex-1 sm:flex-initial sm:text-sm whitespace-nowrap" onClick={() => plan.startWorkout(day)}>
              <Icon name="play" className="h-3.5 w-3.5" /> Iniciar {day}
            </button>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3">
          {vm.extraAll.length > 0 && vm.primary.length > 0 ? (
            <div role="tablist" aria-label="Filtro de ejercicios" class="inline-flex rounded-xl border border-white/10 bg-gray-900/70 p-1 gap-1">
              <button type="button" role="tab" aria-selected={!vm.showingExtra ? 'true' : 'false'} class={`inline-flex min-h-[44px] sm:min-h-[34px] items-center rounded-lg px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${!vm.showingExtra ? 'bg-electricBlue text-white' : 'text-gray-400 hover:text-white'}`} onClick={() => plan.setDayScope(day, 'routine')}>
                En rutina ({vm.primary.length})
              </button>
              <button type="button" role="tab" aria-selected={vm.showingExtra ? 'true' : 'false'} class={`inline-flex min-h-[44px] sm:min-h-[34px] items-center rounded-lg px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${vm.showingExtra ? 'bg-electricBlue text-white' : 'text-gray-400 hover:text-white'}`} onClick={() => plan.setDayScope(day, 'extra')}>
                Anteriores ({vm.extraAll.length})
              </button>
            </div>
          ) : <span />}
          <RangePicker
            scope={day}
            active={vm.bounds.key}
            custom={state.customRanges?.[day]}
            onSelectRange={(k) => plan.setRange(day, k)}
            onChangeFrom={(val) => plan.setCustomRangeDate(day, 'from', val)}
            onChangeTo={(val) => plan.setCustomRangeDate(day, 'to', val)}
          />
        </div>
      </section>

      <DayMasterList
        day={day}
        exercises={vm.visibleList}
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
      />
    </div>
  );
}
