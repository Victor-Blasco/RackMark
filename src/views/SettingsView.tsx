import { AccountSyncSection } from '../components/settings/AccountSyncSection';
import { AiPreferencesSection } from '../components/settings/AiPreferencesSection';
import { AthleteProfileSection } from '../components/settings/AthleteProfileSection';
import { useAppStore } from '../store/appStore';
import type { AiTone } from '../types';
import type { State } from '../ui/shared';

interface SettingsViewProps {
  /** Estado explícito opcional para renderizado SSR aislado en tests. */
  state?: State;
}

/**
 * Vista `Cuenta y ajustes`: sincronización en la nube, perfil del atleta y tono del Coach IA.
 */
export function SettingsView({ state: propState }: SettingsViewProps) {
  const { state: storeState, plan, analytics, dataSync, setTab } = useAppStore();
  const state = propState ?? storeState;
  const tone: AiTone = state.settings.aiTone === 'simple' ? 'simple' : 'technical';

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
          <button type="button" class="btn-sm" onClick={() => setTab('plan')}>
            Plan y rutinas
          </button>
          <button type="button" class="btn-sm" onClick={() => setTab('data')}>
            Datos y copias
          </button>
        </div>
      </div>
    </div>
  );
}
