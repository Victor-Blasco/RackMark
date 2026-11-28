import { epley } from '../lib/analysis';
import { calculateNutrition, recommendActivityFactor } from '../lib/nutrition';
import { daysAgoIso, norm, parseDecimal } from '../lib/seed';
import { r1, routineNames, type State } from '../ui/shared';
import { daysActivityFactor, goalCalorieDelta } from './wizardSelectors';

function formatWeeklyProjection(projection: number): string {
  if (Math.abs(projection) < 0.05) return 'Sin cambio previsto';
  const sign = projection > 0 ? '+' : '−';
  return `${sign}${Math.abs(projection).toFixed(2).replace('.', ',')} kg/sem`;
}

/**
 * Calcula los datos de la calculadora de fuerza 1RM y el planificador nutricional Katch-McArdle.
 *
 * @param state - Estado global con marcas recientes, medidas y borrador de calculadoras.
 * @returns Presets, métricas de 1RM, factor recomendado, calorías y reparto de macros.
 */
export function buildCalcViewModel(state: State) {
  const latestW = [...state.measures].reverse().find((m) => m.weight != null)?.weight;
  const latestBf = [...state.measures].reverse().find((m) => m.bf != null)?.bf;
  const usingSampleMeasures = latestW == null || latestBf == null;
  const cBodyW = state.calcDraft?.bodyW;
  const cBodyBf = state.calcDraft?.bodyBf;
  const parsedBodyW = cBodyW != null ? parseDecimal(cBodyW) : undefined;
  const parsedBodyBf = cBodyBf != null ? parseDecimal(cBodyBf) : undefined;
  const w = parsedBodyW != null && parsedBodyW >= 25 && parsedBodyW <= 300 ? parsedBodyW : (latestW ?? 70);
  const bf = parsedBodyBf != null && parsedBodyBf >= 2 && parsedBodyBf <= 65 ? parsedBodyBf : (latestBf ?? 15);
  const hasBodyOverride = cBodyW != null || cBodyBf != null;
  const ffm = w * (1 - bf / 100);

  const seenPresets = new Set<string>();
  const presets = routineNames(state.settings)
    .flatMap((d) => state.analysis.byDay[d] ?? [])
    .flatMap((e) => {
      const k = norm(e.name);
      const last = e.last;
      if (!last?.sets.length || seenPresets.has(k)) return [];
      seenPresets.add(k);
      const best = last.sets.filter((s) => s.w === last.top).sort((a, b) => b.r - a.r)[0] ?? last.sets[0];
      return best ? [{ n: e.name, w: best.w, r: best.r }] : [];
    });

  const usingSampleStrength = presets.length === 0;
  const first = presets[0] ?? { w: 50, r: 9 };
  const cW = state.calcDraft?.w ?? String(first.w);
  const cR = state.calcDraft?.r ?? String(first.r);
  const cRir = state.calcDraft?.rir ?? '1';
  const cAct = state.calcDraft?.act ?? (state.settings.profile.daysPerWeek ? daysActivityFactor(state.settings.profile.daysPerWeek) : '1.65');
  const cGoal = state.calcDraft?.goal ?? (state.settings.profile.goal ? goalCalorieDelta(state.settings.profile.goal) : '225');
  const cProtein = state.calcDraft?.protein ?? '2.2';
  const cFat = state.calcDraft?.fat ?? '1.0';
  const cMeals = state.calcDraft?.meals ?? '4';

  const cutoff = daysAgoIso(7);
  const strengthSessions7d = state.analysis.sessions.filter((session) => session.date >= cutoff).length;
  const recentSteps = state.wellbeing
    .filter((day) => day.date >= cutoff)
    .map((day) => day.steps)
    .filter((steps): steps is number => steps != null);
  const avgSteps7d = recentSteps.length
    ? recentSteps.reduce((sum, steps) => sum + steps, 0) / recentSteps.length
    : 0;
  const recommendedAct = recommendActivityFactor(strengthSessions7d, avgSteps7d);

  const numW = Math.max(0, parseDecimal(cW) ?? 0);
  const numR = Math.max(1, Math.min(30, parseInt(cR, 10) || 1));
  const numRir = Math.max(0, Math.min(10, parseInt(cRir, 10) || 0));
  const oneRm = epley(numW, numR);
  const oneRmRir = epley(numW, numR + numRir);
  const ratio = (oneRm / (w || 70)).toFixed(2).replace('.', ',');
  const zones = (
    [
      [0.85, '5–6 reps'],
      [0.8, '7–8 reps'],
      [0.75, '9–10 reps'],
      [0.7, '11–12 reps'],
    ] as const
  ).map(([pct, repsLabel]) => ({
    pctLabel: `${Math.round(pct * 100)}% · ${repsLabel}`,
    weightLabel: `${r1(oneRm * pct)} kg`,
  }));

  const actNum = parseFloat(cAct) || 1.55;
  const deltaNum = parseInt(cGoal, 10) || 0;
  const proteinNum = parseFloat(cProtein) || 2.2;
  const fatNum = parseFloat(cFat) || 1;
  const mealsNum = parseInt(cMeals, 10) || 4;
  const nutrition = calculateNutrition(w, bf, actNum, deltaNum, proteinNum, fatNum, mealsNum);
  const deltaSign = deltaNum > 0 ? '+' : '';
  const projectionText = formatWeeklyProjection(nutrition.weeklyProjectionKg);
  const carbWarning = nutrition.target - nutrition.proteinG * 4 - nutrition.fatG * 9 < 0;

  return {
    w,
    bf,
    ffm,
    usingSampleMeasures,
    usingSampleStrength,
    presets,
    cW,
    cR,
    cRir,
    cBodyW: cBodyW ?? String(r1(w)),
    cBodyBf: cBodyBf ?? String(r1(bf)),
    hasBodyOverride,
    cAct,
    cGoal,
    cProtein,
    cFat,
    cMeals,
    recommendedAct,
    oneRm,
    oneRmRir,
    ratio,
    zones,
    nutrition,
    deltaNum,
    deltaSign,
    projectionText,
    carbWarning,
  };
}
