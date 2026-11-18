import { ROUTINE_TEMPLATES } from '../../lib/seed';
import {
  WIZARD_DAYS_OPTIONS,
  WIZARD_EXPERIENCES,
  WIZARD_GOALS,
  WIZARD_TONES,
  recommendTemplate,
  type WizardDraft,
} from '../../store/wizardSelectors';

interface WizardStepProps {
  /** Borrador actual del asistente con perfil, objetivo y plantilla. */
  draft: WizardDraft;
  /** Permite ocultar la opción de mantener rutinas si aún no se completó el onboarding. */
  showKeep?: boolean;
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
                data-act="wizardPickSex"
                data-arg={sex}
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
          <input id="wizAge" class="inp tabular-nums font-semibold" type="number" name="age" min="12" max="110" value={draft.age} required onInput={(e) => onPatch({ age: e.currentTarget.value })} />
        </label>
        <label class="block">
          <span class="lbl">Altura (cm)</span>
          <input id="wizHeight" class="inp tabular-nums font-semibold" type="number" name="height" min="100" max="250" value={draft.height} required onInput={(e) => onPatch({ height: e.currentTarget.value })} />
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
            <input id="wizWeight" class="inp tabular-nums font-semibold" type="number" name="weight" step="0.1" min="25" max="300" value={draft.weight} placeholder="Ej. 72.5" onInput={(e) => onPatch({ weight: e.currentTarget.value })} />
          </label>
          <label class="block">
            <span class="lbl">% Grasa (opcional)</span>
            <input id="wizBf" class="inp tabular-nums font-medium" type="number" name="bf" step="0.1" min="3" max="60" value={draft.bf} placeholder="Ej. 15" onInput={(e) => onPatch({ bf: e.currentTarget.value })} />
          </label>
          <label class="block">
            <span class="lbl">Cintura cm (opc.)</span>
            <input id="wizWaist" class="inp tabular-nums font-medium" type="number" name="waist" step="0.1" min="40" max="200" value={draft.waist} placeholder="Ej. 80" onInput={(e) => onPatch({ waist: e.currentTarget.value })} />
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
                data-act="wizardPickGoal"
                data-arg={g.id}
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
                data-act="wizardPickExp"
                data-arg={e.id}
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
                data-act="wizardPickDays"
                data-arg={String(d)}
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

/** Paso 3 del asistente: selección de plantilla recomendada y tono del Coach IA. */
export function WizardStep3({ draft, showKeep = true, onPatch }: WizardStepProps) {
  const recommended = recommendTemplate(draft.daysPerWeek, draft.experience);
  const selectedTpl = draft.templateKey !== 'keep' ? ROUTINE_TEMPLATES[draft.templateKey] : undefined;

  return (
    <div class="space-y-4">
      <div class="space-y-2">
        <span class="lbl">Distribución de rutina recomendada</span>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Plantilla de rutina">
          {Object.entries(ROUTINE_TEMPLATES).map(([k, tpl]) => {
            const active = draft.templateKey === k;
            const isRec = k === recommended;
            return (
              <button
                key={k}
                type="button"
                data-act="wizardPickTpl"
                data-arg={k}
                aria-pressed={active ? 'true' : 'false'}
                class={`min-h-[44px] rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${active ? 'border-electricBlue bg-electricBlue/15' : 'border-white/10 bg-white/[0.03] hover:border-white/25'}`}
                onClick={() => onPatch({ templateKey: k })}
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="text-sm font-bold text-white">{tpl.label}</span>
                  {isRec && <span class="rounded-full bg-emeraldGreen/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">Recomendada</span>}
                </div>
                <p class="mt-0.5 text-[11px] text-gray-400">{tpl.desc}</p>
              </button>
            );
          })}
        </div>
        {showKeep && (
          <button
            type="button"
            data-act="wizardPickTpl"
            data-arg="keep"
            aria-pressed={draft.templateKey === 'keep' ? 'true' : 'false'}
            class={`w-full min-h-[44px] rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${draft.templateKey === 'keep' ? 'border-electricBlue bg-electricBlue/15 text-white' : 'border-white/10 bg-white/[0.02] text-gray-400 hover:border-white/25 hover:text-gray-200'}`}
            onClick={() => onPatch({ templateKey: 'keep' })}
          >
            Mantener mis rutinas actuales sin sobrescribir
          </button>
        )}
      </div>

      {selectedTpl && (
        <div class="rounded-xl border border-white/10 bg-gray-900/60 p-3 space-y-1.5">
          <span class="text-[11px] font-bold uppercase tracking-wider text-gray-400">Vista previa · {selectedTpl.label}</span>
          <div class="flex flex-wrap gap-2 text-xs">
            {Object.entries(selectedTpl.routines).map(([day, exs]) => (
              <span key={day} class="rounded-lg border border-white/10 bg-cardDark px-2.5 py-1 text-gray-200">
                <b class="text-white">{day}</b> · {exs.length} ej.
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <span class="lbl">Tono del Coach IA (puedes cambiarlo luego)</span>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Tono del Coach IA">
          {WIZARD_TONES.map((t) => {
            const active = draft.aiTone === t.id;
            return (
              <button
                key={t.id}
                type="button"
                data-act="wizardPickTone"
                data-arg={t.id}
                aria-pressed={active ? 'true' : 'false'}
                class={`min-h-[44px] rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${active ? 'border-electricBlue bg-electricBlue/15' : 'border-white/10 bg-white/[0.03] hover:border-white/25'}`}
                onClick={() => onPatch({ aiTone: t.id })}
              >
                <div class="text-sm font-bold text-white">{t.label}</div>
                <p class="mt-0.5 text-[11px] text-gray-400 leading-snug">{t.desc}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
