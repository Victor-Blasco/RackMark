import { MacroCalculator } from '../components/calc/MacroCalculator';
import { OneRmCalculator } from '../components/calc/OneRmCalculator';
import { useAppStore } from '../store/appStore';
import { buildCalcViewModel } from '../store/calcSelectors';
import type { State } from '../ui/shared';

interface CalcViewProps {
  /** Estado explícito opcional para renderizado SSR aislado en tests. */
  state?: State;
}

/**
 * Vista `Calculadoras`: estimación de 1RM con zonas y planificador calórico/macros.
 */
export function CalcView({ state: propState }: CalcViewProps) {
  const { state: storeState, analytics } = useAppStore();
  const state = propState ?? storeState;
  const vm = buildCalcViewModel(state);

  return (
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <OneRmCalculator
        usingSampleStrength={vm.usingSampleStrength}
        presets={vm.presets}
        cW={vm.cW}
        cR={vm.cR}
        cRir={vm.cRir}
        oneRm={vm.oneRm}
        oneRmRir={vm.oneRmRir}
        ratio={vm.ratio}
        zones={vm.zones}
        onSelectPreset={analytics.applyCalcPreset}
        onUpdateField={analytics.updateCalcField}
      />

      <MacroCalculator
        w={vm.w}
        bf={vm.bf}
        ffm={vm.ffm}
        usingSampleMeasures={vm.usingSampleMeasures}
        cAct={vm.cAct}
        cGoal={vm.cGoal}
        cProtein={vm.cProtein}
        cFat={vm.cFat}
        cMeals={vm.cMeals}
        recommendedAct={vm.recommendedAct}
        nutrition={vm.nutrition}
        deltaNum={vm.deltaNum}
        deltaSign={vm.deltaSign}
        projectionText={vm.projectionText}
        carbWarning={vm.carbWarning}
        onUpdateField={analytics.updateCalcField}
      />
    </div>
  );
}
