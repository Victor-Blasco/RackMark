import type { NutritionResult } from '../../lib/nutrition';
import { r1 } from '../../ui/shared';
import { MacroPhaseSelectors } from './MacroPhaseSelectors';
import { CalorieSummaryCard, MacroDistributionPanel } from './MacroResultsPanel';

interface MacroCalculatorProps {
  /** Peso corporal de referencia en kg. */
  w: number;
  /** Porcentaje de grasa corporal de referencia. */
  bf: number;
  /** Masa libre de grasa estimada en kg. */
  ffm: number;
  /** Indica si se están usando peso/grasa de ejemplo por falta de medidas. */
  usingSampleMeasures: boolean;
  /** Factor de actividad seleccionado. */
  cAct: string;
  /** Ajuste calórico seleccionado (`delta`). */
  cGoal: string;
  /** Gramos de proteína por kg seleccionados. */
  cProtein: string;
  /** Gramos de grasa por kg seleccionados. */
  cFat: string;
  /** Número de comidas diario seleccionado. */
  cMeals: string;
  /** Factor recomendado en base a sesiones y pasos recientes. */
  recommendedAct: number;
  /** Resultado completo calculado con Katch-McArdle. */
  nutrition: NutritionResult;
  /** Ajuste numérico en kcal/día. */
  deltaNum: number;
  /** Signo `+` cuando el ajuste es positivo. */
  deltaSign: string;
  /** Proyección semanal de variación de peso formateada. */
  projectionText: string;
  /** Indica si proteína + grasa superan las calorías objetivo. */
  carbWarning: boolean;
  /** Actualiza cualquier parámetro del planificador nutricional. */
  onUpdateField: (field: 'act' | 'goal' | 'protein' | 'fat' | 'meals', val: string) => void;
}

/**
 * Planificador calórico y reparto de macronutrientes basado en Katch-McArdle.
 */
export function MacroCalculator({
  w,
  bf,
  ffm,
  usingSampleMeasures,
  cAct,
  cGoal,
  cProtein,
  cFat,
  cMeals,
  recommendedAct,
  nutrition,
  deltaNum,
  deltaSign,
  projectionText,
  carbWarning,
  onUpdateField,
}: MacroCalculatorProps) {
  return (
    <div class="min-w-0 space-y-4">
      <div>
        <h2 class="font-bold text-white">Planificador nutricional (<span class="tabular-nums">{r1(w)} kg · {r1(bf)}%</span> grasa)</h2>
        {usingSampleMeasures ? (
          <p class="text-xs text-amberGold mt-0.5">Valores de ejemplo (añade una medida para personalizar)</p>
        ) : (
          <p class="text-xs text-gray-400">
            Calculado según tu peso y masa libre de grasa (<span class="tabular-nums">{r1(ffm)} kg</span>). Usa tu última medición.
          </p>
        )}
      </div>

      <MacroPhaseSelectors cAct={cAct} cGoal={cGoal} recommendedAct={recommendedAct} onUpdateField={onUpdateField} />

      <input type="hidden" id="nuMeals" value={cMeals} />

      <CalorieSummaryCard nutrition={nutrition} deltaNum={deltaNum} deltaSign={deltaSign} projectionText={projectionText} />

      <div class="grid grid-cols-2 gap-3">
        <label class="block">
          <span class="lbl">Proteína</span>
          <select id="nuProtein" class="inp tabular-nums" value={cProtein} onChange={(e) => onUpdateField('protein', e.currentTarget.value)}>
            <option value="1.8" selected={cProtein === '1.8'}>1,8 g/kg</option>
            <option value="2.0" selected={cProtein === '2.0'}>2,0 g/kg</option>
            <option value="2.2" selected={cProtein === '2.2'}>2,2 g/kg</option>
            <option value="2.4" selected={cProtein === '2.4'}>2,4 g/kg</option>
          </select>
        </label>
        <label class="block">
          <span class="lbl">Grasas</span>
          <select id="nuFat" class="inp tabular-nums" value={cFat} onChange={(e) => onUpdateField('fat', e.currentTarget.value)}>
            <option value="0.8" selected={cFat === '0.8'}>0,8 g/kg</option>
            <option value="1.0" selected={cFat === '1.0'}>1,0 g/kg</option>
            <option value="1.2" selected={cFat === '1.2'}>1,2 g/kg</option>
          </select>
        </label>
      </div>

      <div class="space-y-2">
        <span class="lbl">Reparto por comidas</span>
        <div role="radiogroup" aria-label="Número de comidas" class="inline-flex rounded-xl border border-white/10 bg-gray-900/70 p-1">
          {[3, 4, 5].map((meals) => {
            const active = Number(cMeals) === meals;
            return (
              <button
                key={meals}
                type="button"
                role="radio"
                tabIndex={active ? 0 : -1}
                aria-checked={active ? 'true' : 'false'}
                class={`min-h-[44px] min-w-[44px] rounded-lg px-4 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${active ? 'bg-electricBlue text-white' : 'text-gray-400 hover:text-white'}`}
                onClick={() => onUpdateField('meals', String(meals))}
              >
                {meals}
              </button>
            );
          })}
        </div>
      </div>

      <MacroDistributionPanel nutrition={nutrition} carbWarning={carbWarning} />
    </div>
  );
}
