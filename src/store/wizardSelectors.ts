import type { AiTone, ExperienceLevel, Settings, TrainingGoal } from '../types';
import type { State } from '../ui/shared';

/** Borrador paso a paso del asistente de configuración inicial. */
export interface WizardDraft {
  step: 1 | 2 | 3;
  sex: 'hombre' | 'mujer';
  age: string;
  height: string;
  weight: string;
  bf: string;
  waist: string;
  goal: TrainingGoal;
  experience: ExperienceLevel;
  daysPerWeek: 2 | 3 | 4 | 5 | 6;
  templateKey: string;
  aiTone: AiTone;
  anim?: 'open' | 'next' | 'prev';
  error?: string;
}

export const WIZARD_GOALS: { id: TrainingGoal; label: string; desc: string }[] = [
  { id: 'bulk', label: 'Ganar músculo', desc: 'Superávit ligero (+225 kcal) y progresión de volumen.' },
  { id: 'cut', label: 'Definición', desc: 'Déficit controlado (−350 kcal) conservando fuerza.' },
  { id: 'recomp', label: 'Recomposición', desc: 'Perder grasa y ganar músculo a la vez.' },
  { id: 'strength', label: 'Fuerza máxima', desc: 'Prioridad en ganar fuerza levantando más peso.' },
];

export const WIZARD_EXPERIENCES: { id: ExperienceLevel; label: string; sub: string }[] = [
  { id: 'beginner', label: 'Principiante', sub: '< 1 año entrenando' },
  { id: 'intermediate', label: 'Intermedio', sub: '1 – 3 años' },
  { id: 'advanced', label: 'Avanzado', sub: '+3 años' },
];

export const WIZARD_DAYS_OPTIONS: (2 | 3 | 4 | 5 | 6)[] = [2, 3, 4, 5, 6];

export const WIZARD_TONES: { id: AiTone; label: string; desc: string }[] = [
  { id: 'simple', label: 'Sencillo y directo', desc: 'Sin tecnicismos: pasos claros para entrenar y ajustar pesos.' },
  { id: 'technical', label: 'Técnico y detallado', desc: 'Incluye fuerza máxima estimada (e1RM), recuperación (HRV), esfuerzo (RIR) y volumen semanal.' },
];

/** Devuelve la plantilla inicial recomendada según los días semanales y el nivel del atleta. */
export function recommendTemplate(daysPerWeek: number, experience: ExperienceLevel): string {
  if (daysPerWeek <= 3) return experience === 'beginner' ? 'fullBody' : 'ppl';
  if (daysPerWeek === 4) return 'upperLower';
  return 'ppl';
}

/** Devuelve el nombre de fase nutricional/entrenamiento asociado al objetivo. */
export function goalPhaseName(goal: TrainingGoal): string {
  const names: Record<TrainingGoal, string> = {
    bulk: 'Volumen limpio',
    cut: 'Definición',
    recomp: 'Mantenimiento',
    strength: 'Fuerza',
  };
  return names[goal];
}

/** Devuelve el ajuste calórico por defecto (kcal) para la calculadora Katch-McArdle. */
export function goalCalorieDelta(goal: TrainingGoal): string {
  const deltas: Record<TrainingGoal, string> = {
    bulk: '225',
    cut: '-350',
    recomp: '0',
    strength: '225',
  };
  return deltas[goal];
}

/** Devuelve el factor de actividad física estimado para la calculadora nutricional según días/semana. */
export function daysActivityFactor(daysPerWeek: number): string {
  if (daysPerWeek <= 4) return '1.55';
  if (daysPerWeek === 5) return '1.65';
  return '1.75';
}

const latestMeasureValue = (state: State, key: 'weight' | 'bf' | 'waist'): string => {
  for (let i = state.measures.length - 1; i >= 0; i--) {
    const v = state.measures[i]?.[key];
    if (v != null && Number.isFinite(v)) return String(v);
  }
  return '';
};

/**
 * Crea un borrador inicial del asistente a partir del perfil actual y la última medición.
 *
 * @param state - Estado global de la aplicación.
 * @returns Estado inicial del paso 1 del wizard.
 */
export function createWizardDraft(state: State): WizardDraft {
  const p = state.settings.profile;
  const experience: ExperienceLevel = p.experience ?? 'intermediate';
  const rawDays = p.daysPerWeek;
  const daysPerWeek: 2 | 3 | 4 | 5 | 6 =
    rawDays === 2 || rawDays === 3 || rawDays === 4 || rawDays === 5 || rawDays === 6 ? rawDays : 4;
  return {
    step: 1,
    sex: p.sex === 'mujer' ? 'mujer' : 'hombre',
    age: String(p.age || 25),
    height: String(p.height || 170),
    weight: latestMeasureValue(state, 'weight'),
    bf: latestMeasureValue(state, 'bf'),
    waist: latestMeasureValue(state, 'waist'),
    goal: p.goal ?? 'bulk',
    experience,
    daysPerWeek,
    templateKey: recommendTemplate(daysPerWeek, experience),
    aiTone: state.settings.aiTone ?? (experience === 'beginner' ? 'simple' : 'technical'),
    anim: 'open',
  };
}

/** Parsea texto decimal aceptando coma o punto en campos numéricos del asistente. */
export const parseWizardNum = (v: string): number | undefined => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

/** Calcula las fases de entrenamiento resultantes al completar el asistente inicial. */
export function resolveWizardPhases(
  phases: Settings['phases'],
  wasOnboarded: boolean,
  hasStrength: boolean,
  phaseName: string,
  today: string,
): Settings['phases'] {
  if (!wasOnboarded && !hasStrength && phases.length === 0) return [{ name: phaseName, start: today }];
  if (phases.some((p) => p.start === today)) {
    return phases.map((p) => (p.start === today ? { ...p, name: phaseName } : p));
  }
  return [...phases, { name: phaseName, start: today }];
}
