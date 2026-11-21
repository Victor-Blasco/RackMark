import { ACTIVITY_OPTIONS, NUTRITION_PHASES } from '../../lib/nutrition';

const ACT_BTN_BASE = 'min-h-[44px] rounded-xl border px-3 py-2 text-left transition-colors';
const PHASE_BTN_BASE = 'min-h-[44px] rounded-xl border px-2 py-2 text-center transition-colors';

function phaseDeltaColor(delta: number): string {
  if (delta > 0) return 'text-emerald-300';
  if (delta < 0) return 'text-amberGold';
  return 'text-gray-400';
}

interface MacroPhaseSelectorsProps {
  /** Factor de actividad seleccionado. */
  cAct: string;
  /** Ajuste calórico seleccionado (`delta`). */
  cGoal: string;
  /** Factor recomendado en base a sesiones y pasos recientes. */
  recommendedAct: number;
  /** Actualiza actividad o fase energética. */
  onUpdateField: (field: 'act' | 'goal', val: string) => void;
}

/**
 * Selectores de factor de actividad semanal y fase energética del planificador nutricional.
 */
export function MacroPhaseSelectors({ cAct, cGoal, recommendedAct, onUpdateField }: MacroPhaseSelectorsProps) {
  return (
    <>
      <div class="space-y-2">
        <span class="lbl">Actividad semanal</span>
        <div role="radiogroup" aria-label="Factor de actividad" class="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {ACTIVITY_OPTIONS.map((option) => {
            const active = Number(cAct) === option.factor;
            const cls = active ? 'border-electricBlue bg-electricBlue/15' : 'border-white/10 hover:border-white/25';
            return (
              <button
                key={option.factor}
                type="button"
                role="radio"
                aria-checked={active ? 'true' : 'false'}
                class={`${ACT_BTN_BASE} ${cls}`}
                onClick={() => onUpdateField('act', String(option.factor))}
              >
                <span class="flex min-h-5 flex-wrap items-center justify-between gap-1">
                  <b class="text-sm text-white">{option.title}</b>
                  {recommendedAct === option.factor && (
                    <span class="shrink-0 whitespace-nowrap rounded-full bg-emeraldGreen/15 px-1.5 py-0.5 text-[10px] font-bold leading-4 text-emerald-300">
                      Según tus datos
                    </span>
                  )}
                </span>
                <span class="mt-0.5 block text-[11px] text-gray-400">{option.subtitle} · ×{option.factor.toFixed(2).replace('.', ',')}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div class="space-y-2">
        <span class="lbl">Fase energética</span>
        <div role="radiogroup" aria-label="Fase energética" class="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {NUTRITION_PHASES.map((phase) => {
            const active = Number(cGoal) === phase.delta;
            const cls = active
              ? 'border-electricBlue bg-electricBlue/15 text-blue-200'
              : 'border-white/10 text-gray-300 hover:border-white/25 hover:text-white';
            return (
              <button
                key={phase.id}
                type="button"
                role="radio"
                aria-checked={active ? 'true' : 'false'}
                class={`${PHASE_BTN_BASE} ${cls}`}
                onClick={() => onUpdateField('goal', String(phase.delta))}
              >
                <span class="block text-xs font-bold">{phase.label}</span>
                <span class={`mt-0.5 block tabular-nums text-[11px] ${phaseDeltaColor(phase.delta)}`}>
                  {phase.shortLabel} kcal
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
