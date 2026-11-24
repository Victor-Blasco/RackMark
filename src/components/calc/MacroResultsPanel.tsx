import type { NutritionResult } from '../../lib/nutrition';

function deltaBadgeClass(deltaNum: number): string {
  if (deltaNum === 0) return 'bg-white/5 text-gray-300';
  if (deltaNum > 0) return 'bg-emeraldGreen/15 text-emerald-300';
  return 'bg-amberGold/15 text-amberGold';
}

interface CalorieSummaryCardProps {
  /** Resultado completo calculado con Katch-McArdle. */
  nutrition: NutritionResult;
  /** Ajuste numérico en kcal/día. */
  deltaNum: number;
  /** Signo `+` cuando el ajuste es positivo. */
  deltaSign: string;
  /** Proyección semanal de variación de peso formateada. */
  projectionText: string;
}

/**
 * Resumen de calorías objetivo, TMB y TDEE estimado.
 */
export function CalorieSummaryCard({ nutrition, deltaNum, deltaSign, projectionText }: CalorieSummaryCardProps) {
  return (
    <div id="nuOut">
      <div class="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span class="block text-xs text-gray-400">Calorías objetivo</span>
            <span class="tabular-nums text-3xl font-extrabold text-white">
              {nutrition.target} <span class="text-base font-bold text-gray-300">kcal</span>
            </span>
          </div>
          <div class="text-right tabular-nums">
            <span class={`inline-flex rounded-full ${deltaBadgeClass(deltaNum)} px-2 py-1 text-xs font-bold`}>
              {deltaSign}{deltaNum} kcal/día
            </span>
            <span class="mt-1 block text-xs text-gray-400">{projectionText} estimado</span>
          </div>
        </div>
        <div class="mt-3 grid grid-cols-2 divide-x divide-white/10 border-t border-white/10 pt-3 text-center">
          <div class="px-2">
            <span class="block text-[11px] text-gray-400">Gasto en reposo (TMB)</span>
            <span class="tabular-nums text-lg sm:text-xl font-extrabold text-white">{nutrition.bmr} kcal</span>
          </div>
          <div class="px-2">
            <span class="block text-[11px] text-gray-400">Gasto diario total (TDEE)</span>
            <span class="tabular-nums text-lg sm:text-xl font-extrabold text-electricBlue">{nutrition.tdee} kcal</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MacroDistributionPanelProps {
  /** Resultado completo calculado con Katch-McArdle. */
  nutrition: NutritionResult;
  /** Indica si proteína + grasa superan las calorías objetivo. */
  carbWarning: boolean;
}

/**
 * Desglose diario y por comida de proteína, grasas y carbohidratos.
 */
export function MacroDistributionPanel({ nutrition, carbWarning }: MacroDistributionPanelProps) {
  return (
    <div id="nuMacros">
      <div class="space-y-3 border-t border-white/10 pt-3">
        <div class="flex h-2 overflow-hidden rounded-full bg-white/5" aria-label="Distribución de macros">
          <span class="h-full bg-emeraldGreen" style={{ width: `${nutrition.proteinPct}%` }} />
          <span class="h-full bg-amberGold" style={{ width: `${nutrition.fatPct}%` }} />
          <span class="h-full bg-electricBlue" style={{ width: `${nutrition.carbsPct}%` }} />
        </div>
        <div class="grid grid-cols-3 divide-x divide-white/10 text-center">
          <div class="px-2">
            <span class="block text-[11px] tabular-nums text-gray-400">Proteína {nutrition.proteinPerKg.toFixed(1).replace('.', ',')} g/kg</span>
            <span class="tabular-nums text-lg sm:text-xl font-extrabold text-emerald-300">{nutrition.proteinG} g</span>
          </div>
          <div class="px-2">
            <span class="block text-[11px] tabular-nums text-gray-400">Grasas {nutrition.fatPerKg.toFixed(1).replace('.', ',')} g/kg</span>
            <span class="tabular-nums text-lg sm:text-xl font-extrabold text-amberGold">{nutrition.fatG} g</span>
          </div>
          <div class="px-2">
            <span class="block text-[11px] text-gray-400">Carbohidratos</span>
            <span class="tabular-nums text-lg sm:text-xl font-extrabold text-blue-300">{nutrition.carbsG} g</span>
          </div>
        </div>
        <p class="text-center text-[11px] tabular-nums text-gray-400">
          {nutrition.proteinPct}% proteína · {nutrition.fatPct}% grasas · {nutrition.carbsPct}% carbohidratos
        </p>
        {carbWarning && (
          <p class="mt-2 text-xs text-amberGold">
            Proteína y grasas superan el objetivo: baja uno de los ajustes antes de definir carbohidratos.
          </p>
        )}
        <div class="grid grid-cols-3 divide-x divide-white/10 rounded-xl border border-white/10 py-2 text-center">
          <div class="px-2">
            <span class="block text-[11px] text-gray-400">Por comida · Proteína</span>
            <span class="tabular-nums text-lg sm:text-xl font-extrabold text-emerald-300">{nutrition.perMeal.proteinG} g</span>
          </div>
          <div class="px-2">
            <span class="block text-[11px] text-gray-400">Por comida · Grasas</span>
            <span class="tabular-nums text-lg sm:text-xl font-extrabold text-amberGold">{nutrition.perMeal.fatG} g</span>
          </div>
          <div class="px-2">
            <span class="block text-[11px] text-gray-400">Por comida · Carbos</span>
            <span class="tabular-nums text-lg sm:text-xl font-extrabold text-blue-300">{nutrition.perMeal.carbsG} g</span>
          </div>
        </div>
      </div>
    </div>
  );
}
