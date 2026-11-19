import { ROUTINE_TEMPLATES } from '../../lib/seed';
import { WIZARD_TONES, recommendTemplate, type WizardDraft } from '../../store/wizardSelectors';

interface WizardStep3Props {
  /** Borrador actual del asistente con objetivo, disponibilidad y plantilla. */
  draft: WizardDraft;
  /** Permite ocultar la opción de mantener rutinas si aún no se completó el onboarding. */
  showKeep?: boolean;
  /** Actualiza campos individuales del borrador sin reiniciar el paso. */
  onPatch: (patch: Partial<WizardDraft>) => void;
}

/** Paso 3 del asistente: selección de plantilla recomendada y tono del Coach IA. */
export function WizardStep3({ draft, showKeep = true, onPatch }: WizardStep3Props) {
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
