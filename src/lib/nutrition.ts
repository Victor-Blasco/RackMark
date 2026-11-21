export interface NutritionPhase {
  id: string;
  label: string;
  shortLabel: string;
  delta: number;
}

export interface NutritionResult {
  bmr: number;
  tdee: number;
  target: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  proteinPerKg: number;
  fatPerKg: number;
  proteinPct: number;
  fatPct: number;
  carbsPct: number;
  weeklyProjectionKg: number;
  perMeal: { proteinG: number; fatG: number; carbsG: number };
}

export const NUTRITION_PHASES: NutritionPhase[] = [
  { id: 'maintenance', label: 'Mantenimiento', shortLabel: '0', delta: 0 },
  { id: 'recomp', label: 'Recomposición', shortLabel: '−150', delta: -150 },
  { id: 'bulk', label: 'Ganancia limpia', shortLabel: '+225', delta: 225 },
  { id: 'surplus', label: 'Superávit', shortLabel: '+350', delta: 350 },
  { id: 'cut-soft', label: 'Definición suave', shortLabel: '−350', delta: -350 },
  { id: 'cut', label: 'Definición estándar', shortLabel: '−500', delta: -500 },
];

export const ACTIVITY_OPTIONS = [
  { factor: 1.55, title: 'Ligera', subtitle: '3–4 días + rutina diaria' },
  { factor: 1.65, title: 'Moderada', subtitle: '5–6 días + pasos activos' },
  { factor: 1.75, title: 'Alta', subtitle: '6–7 días o actividad intensa' },
] as const;

export function calculateNutrition(
  weightKg: number,
  bodyFatPct: number,
  activityFactor: number,
  calorieDelta: number,
  proteinPerKg = 2.2,
  fatPerKg = 1,
  meals = 4,
): NutritionResult {
  const w = Math.max(20, Math.min(350, weightKg));
  const bf = Math.max(2, Math.min(70, bodyFatPct));
  const lbm = w * (1 - bf / 100);
  const bmr = Math.round(370 + 21.6 * lbm);
  const factor = ACTIVITY_OPTIONS.some((x) => x.factor === activityFactor) ? activityFactor : 1.55;
  const tdee = Math.round(bmr * factor);
  const target = Math.max(1000, tdee + calorieDelta);
  const proteinG = Math.round(w * proteinPerKg);
  const fatG = Math.round(w * fatPerKg);
  const proteinKcal = proteinG * 4;
  const fatKcal = fatG * 9;
  const carbsG = Math.max(0, Math.round((target - proteinKcal - fatKcal) / 4));
  const carbsKcal = carbsG * 4;
  const mealCount = [3, 4, 5].includes(meals) ? meals : 4;

  return {
    bmr,
    tdee,
    target,
    proteinG,
    fatG,
    carbsG,
    proteinPerKg,
    fatPerKg,
    proteinPct: target ? Math.round(proteinKcal / target * 100) : 0,
    fatPct: target ? Math.round(fatKcal / target * 100) : 0,
    carbsPct: target ? Math.max(0, 100 - Math.round(proteinKcal / target * 100) - Math.round(fatKcal / target * 100)) : 0,
    weeklyProjectionKg: ((target - tdee) / 7700) * 7,
    perMeal: {
      proteinG: Math.round(proteinG / mealCount),
      fatG: Math.round(fatG / mealCount),
      carbsG: Math.round(carbsG / mealCount),
    },
  };
}

export function recommendActivityFactor(strengthSessions7d: number, avgSteps7d: number): number {
  let factor = strengthSessions7d <= 3 ? 1.55 : strengthSessions7d <= 5 ? 1.65 : 1.75;
  if (avgSteps7d >= 10000 && factor < 1.75) factor = Math.round((factor + 0.10) * 100) / 100;
  if (factor > 1.75) return 1.75;
  return factor;
}
