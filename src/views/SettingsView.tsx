import { AccountSyncSection } from '../components/settings/AccountSyncSection';
import { AiPreferencesSection } from '../components/settings/AiPreferencesSection';
import { AthleteProfileSection } from '../components/settings/AthleteProfileSection';
import { useAppStore } from '../store/appStore';
import type { AiTone, ThemeMode } from '../types';
import type { State } from '../ui/shared';

interface SettingsViewProps {
  /** Estado explícito opcional para renderizado SSR aislado en tests. */
  state?: State;
}

const THEME_OPTIONS: ReadonlyArray<{ id: ThemeMode; label: string }> = [
  { id: 'dark', label: 'Oscuro' },
  { id: 'light', label: 'Claro' },
  { id: 'system', label: 'Sistema' },
];

const THEME_BTN_BASE =
  'inline-flex min-h-[44px] sm:min-h-[34px] items-center justify-center rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue';

/**
 * Vista `Cuenta y ajustes`: sincronización en la nube, perfil del atleta, apariencia y tono del Coach IA.
 */
export function SettingsView({ state: propState }: SettingsViewProps) {
  const { state: storeState, plan, analytics, dataSync, setTab } = useAppStore();
  const state = propState ?? storeState;
  const tone: AiTone = state.settings.aiTone === 'simple' ? 'simple' : 'technical';
  const theme: ThemeMode = state.settings.theme ?? 'dark';

  return (
    <div class="space-y-5">
      <div class="grid grid-cols-1 gap-6 xl:grid-cols-2 pb-5 border-b border-white/10">
        <AccountSyncSection
          state={state}
          onLogin={dataSync.cloudLogin}
          onSync={dataSync.cloudSync}
          onLogout={dataSync.cloudLogout}
        />
        <AthleteProfileSection
          profile={state.settings.profile}
          onOpenWizard={plan.openWizard}
          onChangeSex={(sex) => void analytics.updateProfileSex(sex)}
          onChangeAge={(raw) => void analytics.updateProfileAge(raw)}
          onChangeHeight={(raw) => void analytics.updateProfileHeight(raw)}
          onChangeGoal={(val) => void analytics.updateProfileGoal(val)}
          onChangeExperience={(val) => void analytics.updateProfileExperience(val)}
          onChangeDays={(raw) => void analytics.updateProfileDays(raw)}
        />
      </div>

      <div class="pb-5 border-b border-white/10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="font-bold text-white">Apariencia</h2>
          <p class="text-xs text-gray-400 mt-0.5">
            Elige entre modo oscuro, claro o automático según tu dispositivo.
          </p>
        </div>
        <div
          role="group"
          aria-label="Apariencia de la interfaz"
          class="inline-flex w-full sm:w-auto rounded-xl border border-white/10 bg-gray-950/60 p-1 gap-1"
        >
          {THEME_OPTIONS.map((opt) => {
            const active = theme === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={active ? 'true' : 'false'}
                class={`flex-1 sm:flex-initial ${THEME_BTN_BASE} ${active ? 'bg-electricBlue text-white font-bold shadow-sm' : 'text-gray-400 hover:text-white'}`}
                onClick={() => void dataSync.setThemeWithToast(opt.id)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <AiPreferencesSection
        state={state}
        tone={tone}
        onChangeTone={(next) => void dataSync.setAiToneWithToast(next)}
        onRunAi={plan.runAi}
        onRetryAi={plan.retryAi}
        onDismissAi={plan.dismissAi}
      />

      <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div>
          <h2 class="text-sm font-bold text-white">Accesos relacionados</h2>
          <p class="text-xs text-gray-400">La configuración de rutinas e importación de archivos tienen sus propias secciones dedicadas.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn-sm" onClick={() => plan.openPlanTab('exercises')}>
            Catálogo y músculos
          </button>
          <button type="button" class="btn-sm" onClick={() => setTab('data')}>
            Datos y copias
          </button>
        </div>
      </div>
    </div>
  );
}
