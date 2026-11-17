import { ROUTINE_TEMPLATES } from '../lib/seed';
import type { AiTone, ExperienceLevel, TrainingGoal } from '../types';
import { icon } from './icons';
import { esc, type State } from './shared';

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
}

const GOALS: { id: TrainingGoal; label: string; desc: string }[] = [
  { id: 'bulk', label: 'Ganar músculo', desc: 'Superávit ligero (+225 kcal) y progresión de volumen.' },
  { id: 'cut', label: 'Definición', desc: 'Déficit controlado (−350 kcal) conservando fuerza.' },
  { id: 'recomp', label: 'Recomposición', desc: 'Perder grasa y ganar músculo a la vez.' },
  { id: 'strength', label: 'Fuerza máxima', desc: 'Prioridad en ganar fuerza levantando más peso.' },
];

const EXPERIENCES: { id: ExperienceLevel; label: string; sub: string }[] = [
  { id: 'beginner', label: 'Principiante', sub: '< 1 año entrenando' },
  { id: 'intermediate', label: 'Intermedio', sub: '1 – 3 años' },
  { id: 'advanced', label: 'Avanzado', sub: '+3 años' },
];

const DAYS_OPTIONS: (2 | 3 | 4 | 5 | 6)[] = [2, 3, 4, 5, 6];

const TONES: { id: AiTone; label: string; desc: string }[] = [
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

const latestVal = (S: State, key: 'weight' | 'bf' | 'waist'): string => {
  for (let i = S.measures.length - 1; i >= 0; i--) {
    const v = S.measures[i]?.[key];
    if (v != null && Number.isFinite(v)) return String(v);
  }
  return '';
};

/** Crea un borrador inicial del wizard a partir del perfil actual y la última medición. */
export function createWizardDraft(S: State): WizardDraft {
  const p = S.settings.profile;
  const experience: ExperienceLevel = p.experience ?? 'intermediate';
  const rawDays = p.daysPerWeek;
  const daysPerWeek: 2 | 3 | 4 | 5 | 6 =
    rawDays === 2 || rawDays === 3 || rawDays === 4 || rawDays === 5 || rawDays === 6 ? rawDays : 4;
  return {
    step: 1,
    sex: p.sex === 'mujer' ? 'mujer' : 'hombre',
    age: String(p.age || 25),
    height: String(p.height || 170),
    weight: latestVal(S, 'weight'),
    bf: latestVal(S, 'bf'),
    waist: latestVal(S, 'waist'),
    goal: p.goal ?? 'bulk',
    experience,
    daysPerWeek,
    templateKey: recommendTemplate(daysPerWeek, experience),
    aiTone: S.settings.aiTone ?? (experience === 'beginner' ? 'simple' : 'technical'),
    anim: 'open',
  };
}

function renderStep1(w: WizardDraft): string {
  return `<div class="space-y-4">
    <div>
      <span class="lbl">Sexo biológico (para gasto energético y métricas)</span>
      <div class="grid grid-cols-2 gap-2.5" role="group" aria-label="Sexo">
        ${(['hombre', 'mujer'] as const).map((sex) => {
          const active = w.sex === sex;
          return `<button type="button" data-act="wizardPickSex" data-arg="${sex}" aria-pressed="${active}" class="min-h-[44px] rounded-xl border px-3 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${active ? 'border-electricBlue bg-electricBlue/20 text-white' : 'border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/25'}">${sex === 'hombre' ? 'Hombre' : 'Mujer'}</button>`;
        }).join('')}
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <label class="block">
        <span class="lbl">Edad (años)</span>
        <input id="wizAge" class="inp tabular-nums font-semibold" type="number" name="age" min="12" max="110" value="${esc(w.age)}" required>
      </label>
      <label class="block">
        <span class="lbl">Altura (cm)</span>
        <input id="wizHeight" class="inp tabular-nums font-semibold" type="number" name="height" min="100" max="250" value="${esc(w.height)}" required>
      </label>
    </div>

    <div class="border-t border-white/10 pt-3 space-y-3">
      <div>
        <h4 class="text-xs font-bold uppercase tracking-wider text-gray-300">Medición inicial (hoy)</h4>
        <p class="text-[11px] text-gray-400">Si rellenas tu peso actual guardaremos automáticamente tu primer registro en Cuerpo.</p>
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label class="block">
          <span class="lbl">Peso actual (kg)</span>
          <input id="wizWeight" class="inp tabular-nums font-semibold" type="number" name="weight" step="0.1" min="25" max="300" value="${esc(w.weight)}" placeholder="Ej. 72.5">
        </label>
        <label class="block">
          <span class="lbl">% Grasa (opcional)</span>
          <input id="wizBf" class="inp tabular-nums font-medium" type="number" name="bf" step="0.1" min="3" max="60" value="${esc(w.bf)}" placeholder="Ej. 15">
        </label>
        <label class="block">
          <span class="lbl">Cintura cm (opc.)</span>
          <input id="wizWaist" class="inp tabular-nums font-medium" type="number" name="waist" step="0.1" min="40" max="200" value="${esc(w.waist)}" placeholder="Ej. 80">
        </label>
      </div>
    </div>
  </div>`;
}

function renderStep2(w: WizardDraft): string {
  return `<div class="space-y-4">
    <div>
      <span class="lbl">Objetivo principal</span>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Objetivo principal">
        ${GOALS.map((g) => {
          const active = w.goal === g.id;
          return `<button type="button" data-act="wizardPickGoal" data-arg="${g.id}" aria-pressed="${active}" class="min-h-[44px] rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${active ? 'border-electricBlue bg-electricBlue/15' : 'border-white/10 bg-white/[0.03] hover:border-white/25'}">
            <div class="text-sm font-bold text-white">${g.label}</div>
            <p class="mt-0.5 text-[11px] text-gray-400 leading-snug">${g.desc}</p>
          </button>`;
        }).join('')}
      </div>
    </div>

    <div>
      <span class="lbl">Nivel de experiencia en fuerza</span>
      <div class="grid grid-cols-3 gap-2" role="group" aria-label="Nivel de experiencia">
        ${EXPERIENCES.map((e) => {
          const active = w.experience === e.id;
          return `<button type="button" data-act="wizardPickExp" data-arg="${e.id}" aria-pressed="${active}" class="min-h-[44px] rounded-xl border px-2.5 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${active ? 'border-electricBlue bg-electricBlue/20 text-white' : 'border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/25'}">
            <span class="block text-xs sm:text-sm font-bold">${e.label}</span>
            <span class="block text-[10px] text-gray-400">${e.sub}</span>
          </button>`;
        }).join('')}
      </div>
    </div>

    <div>
      <span class="lbl">Días de entrenamiento por semana</span>
      <div class="grid grid-cols-5 gap-1.5 sm:gap-2" role="group" aria-label="Días por semana">
        ${DAYS_OPTIONS.map((d) => {
          const active = w.daysPerWeek === d;
          return `<button type="button" data-act="wizardPickDays" data-arg="${d}" aria-pressed="${active}" class="min-h-[44px] rounded-xl border px-2 py-2 text-center tabular-nums text-xs sm:text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${active ? 'border-electricBlue bg-electricBlue/20 text-white' : 'border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/25'}">${d} días</button>`;
        }).join('')}
      </div>
    </div>
  </div>`;
}

function renderStep3(w: WizardDraft, showKeep = true): string {
  const recommended = recommendTemplate(w.daysPerWeek, w.experience);
  const selectedTpl = w.templateKey !== 'keep' ? ROUTINE_TEMPLATES[w.templateKey] : undefined;
  return `<div class="space-y-4">
    <div class="space-y-2">
      <span class="lbl">Distribución de rutina recomendada</span>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Plantilla de rutina">
        ${Object.entries(ROUTINE_TEMPLATES).map(([k, tpl]) => {
          const active = w.templateKey === k;
          const isRec = k === recommended;
          return `<button type="button" data-act="wizardPickTpl" data-arg="${k}" aria-pressed="${active}" class="min-h-[44px] rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${active ? 'border-electricBlue bg-electricBlue/15' : 'border-white/10 bg-white/[0.03] hover:border-white/25'}">
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-bold text-white">${esc(tpl.label)}</span>
              ${isRec ? `<span class="rounded-full bg-emeraldGreen/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">Recomendada</span>` : ''}
            </div>
            <p class="mt-0.5 text-[11px] text-gray-400">${esc(tpl.desc)}</p>
          </button>`;
        }).join('')}
      </div>
      ${showKeep ? `<button type="button" data-act="wizardPickTpl" data-arg="keep" aria-pressed="${w.templateKey === 'keep'}" class="w-full min-h-[44px] rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${w.templateKey === 'keep' ? 'border-electricBlue bg-electricBlue/15 text-white' : 'border-white/10 bg-white/[0.02] text-gray-400 hover:border-white/25 hover:text-gray-200'}">
        Mantener mis rutinas actuales sin sobrescribir
      </button>` : ''}
    </div>

    ${selectedTpl ? `
      <div class="rounded-xl border border-white/10 bg-gray-900/60 p-3 space-y-1.5">
        <span class="text-[11px] font-bold uppercase tracking-wider text-gray-400">Vista previa · ${esc(selectedTpl.label)}</span>
        <div class="flex flex-wrap gap-2 text-xs">
          ${Object.entries(selectedTpl.routines).map(([day, exs]) => `<span class="rounded-lg border border-white/10 bg-cardDark px-2.5 py-1 text-gray-200"><b class="text-white">${esc(day)}</b> · ${exs.length} ej.</span>`).join('')}
        </div>
      </div>` : ''}

    <div>
      <span class="lbl">Tono del Coach IA (puedes cambiarlo luego)</span>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Tono del Coach IA">
        ${TONES.map((t) => {
          const active = w.aiTone === t.id;
          return `<button type="button" data-act="wizardPickTone" data-arg="${t.id}" aria-pressed="${active}" class="min-h-[44px] rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${active ? 'border-electricBlue bg-electricBlue/15' : 'border-white/10 bg-white/[0.03] hover:border-white/25'}">
            <div class="text-sm font-bold text-white">${t.label}</div>
            <p class="mt-0.5 text-[11px] text-gray-400 leading-snug">${t.desc}</p>
          </button>`;
        }).join('')}
      </div>
    </div>
  </div>`;
}

/** Renderiza el modal paso a paso del asistente de configuración inicial. */
export function renderWizardModal(S: State): string {
  const w = S.wizard;
  if (!w) return '';
  const titles: Record<1 | 2 | 3, { title: string; sub: string }> = {
    1: { title: 'Tu perfil físico', sub: 'Personaliza tus calorías recomendadas y el seguimiento de tu progreso físico.' },
    2: { title: 'Objetivo y disponibilidad', sub: 'Elige tu objetivo actual y cuántos días a la semana quieres entrenar.' },
    3: { title: 'Tu rutina y Coach IA', sub: 'Elige la distribución base sugerida y cómo quieres recibir los informes.' },
  };
  const info = titles[w.step];
  const body = w.step === 1 ? renderStep1(w) : w.step === 2 ? renderStep2(w) : renderStep3(w, Boolean(S.settings.onboardingCompleted));
  const modalAnim = w.anim === 'open' ? 'wizard-modal-in' : '';
  const backdropAnim = w.anim === 'open' ? 'wizard-backdrop-in' : '';
  const stepAnim = w.anim === 'next' ? 'wizard-step-next' : w.anim === 'prev' ? 'wizard-step-prev' : '';

  return `<div id="wizard-modal" role="dialog" aria-modal="true" aria-labelledby="wizardTitle" class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
    <div class="fixed inset-0 bg-black/80 ${backdropAnim}" data-act="wizardSkip" aria-hidden="true"></div>
    <form id="f-wizard" class="relative z-10 w-full max-w-xl rounded-2xl border border-white/10 bg-modalDark p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto ${modalAnim}">
      <div class="overflow-x-hidden space-y-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 ${stepAnim}">
            <span class="text-[11px] font-bold uppercase tracking-wider text-blue-300 tabular-nums">Paso ${w.step} de 3 · Configuración inicial</span>
            <h3 id="wizardTitle" class="text-lg font-extrabold text-white mt-0.5">${info.title}</h3>
            <p class="text-xs text-gray-400 mt-0.5">${info.sub}</p>
          </div>
          <button type="button" data-act="wizardSkip" class="inline-flex min-h-[44px] sm:min-h-[34px] shrink-0 items-center rounded-lg px-2.5 text-xs font-semibold text-gray-400 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue">Omitir</button>
        </div>

        <div class="grid grid-cols-3 gap-1.5" aria-hidden="true">
          ${([1, 2, 3] as const).map((n) => {
            const barAnim = w.anim === 'next' && n === w.step ? 'wizard-bar-fill' : '';
            return `<div class="h-1.5 overflow-hidden rounded-full bg-white/10"><div class="h-full rounded-full ${n <= w.step ? `bg-electricBlue ${barAnim}` : 'w-0'}"></div></div>`;
          }).join('')}
        </div>

        <div class="${stepAnim}">${body}</div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
        <div>
          ${w.step > 1 ? `<button type="button" class="btn min-h-[44px]" data-act="wizardBack">← Anterior</button>` : `<button type="button" class="btn min-h-[44px]" data-act="wizardSkip">Omitir por ahora</button>`}
        </div>
        <button id="wizardNext" type="submit" class="btn-primary min-h-[44px] px-5">
          ${w.step < 3 ? 'Siguiente →' : `${icon('save', 'h-4 w-4')} Guardar y empezar`}
        </button>
      </div>
    </form>
  </div>`;
}
