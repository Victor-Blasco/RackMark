import {
  WIZARD_DAYS_OPTIONS,
  WIZARD_EXPERIENCES,
  WIZARD_GOALS,
  recommendTemplate,
  type WizardDraft,
} from '../../store/wizardSelectors';

export { WizardStep3 } from './WizardStep3';

interface WizardStepProps {
  /** Borrador actual del asistente con perfil, objetivo y plantilla. */
  draft: WizardDraft;
  /** Actualiza campos individuales del borrador sin reiniciar el paso. */
  onPatch: (patch: Partial<WizardDraft>) => void;
}

/** Paso 1 del asistente: datos físicos básicos y medición corporal inicial. */
export function WizardStep1({ draft, onPatch }: WizardStepProps) {
  return (
    <div class="space-y-4">
      <div>
        <span class="lbl">Sexo biológico (para gasto energético y métricas)</span>
        <div class="grid grid-cols-2 gap-2.5" role="group" aria-label="Sexo">
          {(['hombre', 'mujer'] as const).map((sex) => {
            const active = draft.sex === sex;
            return (
              <button
                key={sex}
                type="button"
                aria-pressed={active ? 'true' : 'false'}
                class={`min-h-[44px] rounded-xl border px-3 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${active ? 'border-electricBlue bg-electricBlue/20 text-white' : 'border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/25'}`}
                onClick={() => onPatch({ sex })}
              >
                {sex === 'hombre' ? 'Hombre' : 'Mujer'}
              </button>
            );
          })}
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <label class="block">
          <span class="lbl">Edad (años)</span>
          <input id="wizAge" class="inp tabular-nums font-semibold" type="number" inputMode="numeric" enterKeyHint="next" name="age" min="12" max="110" value={draft.age} required onInput={(e) => onPatch({ age: e.currentTarget.value })} />
        </label>
        <label class="block">
          <span class="lbl">Altura (cm)</span>
          <input id="wizHeight" class="inp tabular-nums font-semibold" type="number" inputMode="numeric" enterKeyHint="next" name="height" min="100" max="250" value={draft.height} required onInput={(e) => onPatch({ height: e.currentTarget.value })} />
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
            <input id="wizWeight" class="inp tabular-nums font-semibold" type="number" inputMode="decimal" enterKeyHint="next" name="weight" step="0.1" min="25" max="300" value={draft.weight} placeholder="Ej. 72,5" onInput={(e) => onPatch({ weight: e.currentTarget.value })} />
          </label>
          <label class="block">
            <span class="lbl">% Grasa (opcional)</span>
            <input id="wizBf" class="inp tabular-nums font-medium" type="number" inputMode="decimal" enterKeyHint="next" name="bf" step="0.1" min="3" max="60" value={draft.bf} placeholder="Ej. 15" onInput={(e) => onPatch({ bf: e.currentTarget.value })} />
          </label>
          <label class="block">
            <span class="lbl">Cintura cm (opc.)</span>
            <input id="wizWaist" class="inp tabular-nums font-medium" type="number" inputMode="decimal" enterKeyHint="done" name="waist" step="0.1" min="40" max="200" value={draft.waist} placeholder="Ej. 80" onInput={(e) => onPatch({ waist: e.currentTarget.value })} />
          </label>
        </div>
      </div>
    </div>
  );
}

/** Paso 2 del asistente: objetivo, nivel de experiencia y frecuencia semanal. */
export function WizardStep2({ draft, onPatch }: WizardStepProps) {
  return (
    <div class="space-y-4">
      <div>
        <span class="lbl">Objetivo principal</span>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Objetivo principal">
          {WIZARD_GOALS.map((g) => {
            const active = draft.goal === g.id;
            return (
              <button
                key={g.id}
                type="button"
                aria-pressed={active ? 'true' : 'false'}
                class={`min-h-[44px] rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${active ? 'border-electricBlue bg-electricBlue/15' : 'border-white/10 bg-white/[0.03] hover:border-white/25'}`}
                onClick={() => onPatch({ goal: g.id })}
              >
                <div class="text-sm font-bold text-white">{g.label}</div>
                <p class="mt-0.5 text-[11px] text-gray-400 leading-snug">{g.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span class="lbl">Nivel de experiencia en fuerza</span>
        <div class="grid grid-cols-3 gap-2" role="group" aria-label="Nivel de experiencia">
          {WIZARD_EXPERIENCES.map((e) => {
            const active = draft.experience === e.id;
            return (
              <button
                key={e.id}
                type="button"
                aria-pressed={active ? 'true' : 'false'}
                class={`min-h-[44px] rounded-xl border px-2.5 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${active ? 'border-electricBlue bg-electricBlue/20 text-white' : 'border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/25'}`}
                onClick={() =>
                  onPatch({
                    experience: e.id,
                    templateKey: recommendTemplate(draft.daysPerWeek, e.id),
                    aiTone: e.id === 'beginner' ? 'simple' : 'technical',
                  })
                }
              >
                <span class="block text-xs sm:text-sm font-bold">{e.label}</span>
                <span class="block text-[10px] text-gray-400">{e.sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span class="lbl">Días de entrenamiento por semana</span>
        <div class="grid grid-cols-5 gap-1.5 sm:gap-2" role="group" aria-label="Días por semana">
          {WIZARD_DAYS_OPTIONS.map((d) => {
            const active = draft.daysPerWeek === d;
            return (
              <button
                key={d}
                type="button"
                aria-pressed={active ? 'true' : 'false'}
                class={`min-h-[44px] rounded-xl border px-2 py-2 text-center tabular-nums text-xs sm:text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${active ? 'border-electricBlue bg-electricBlue/20 text-white' : 'border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/25'}`}
                onClick={() => onPatch({ daysPerWeek: d, templateKey: recommendTemplate(d, draft.experience) })}
              >
                {d} días
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
