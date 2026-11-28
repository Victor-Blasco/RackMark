import { useState } from 'preact/hooks';
import { Collapsible } from '../components/common/Collapsible';
import { Icon } from '../components/common/Icon';
import { SegmentedControl } from '../components/common/SegmentedControl';
import { AccountSyncSection } from '../components/settings/AccountSyncSection';
import { AiPreferencesSection } from '../components/settings/AiPreferencesSection';
import { AthleteProfileSection } from '../components/settings/AthleteProfileSection';
import { SettingsRelatedLinks } from '../components/settings/SettingsRelatedLinks';
import { useAppStore } from '../store/appStore';
import { buildSettingsSections, THEME_OPTIONS, type SettingsSecId, type SettingsSectionMeta } from '../store/settingsSelectors';
import type { AiTone, ThemeMode } from '../types';
import type { State } from '../ui/shared';

interface SettingsViewProps {
  /** Estado explícito opcional para renderizado SSR aislado en tests. */
  state?: State;
}

/**
 * Vista `Cuenta y ajustes`: acordeones en escritorio e índice con subpantallas en móvil.
 */
export function SettingsView({ state: propState }: SettingsViewProps) {
  const { state: storeState, unsynced, plan, analytics, dataSync, setTab } = useAppStore();
  const state = propState ?? storeState;
  const [openPc, setOpenPc] = useState<SettingsSecId | null>(null);
  const [mobSub, setMobSub] = useState<SettingsSecId | null>(null);

  const tone: AiTone = state.settings.aiTone === 'simple' ? 'simple' : 'technical';
  const theme: ThemeMode = state.settings.theme ?? 'dark';
  const sections = buildSettingsSections(state, unsynced, tone);
  const activeMobSec = mobSub ? sections.find((s) => s.id === mobSub) : null;

  const renderBody = (id: SettingsSecId) => {
    if (id === 'account') {
      return (
        <AccountSyncSection
          state={state} unsynced={unsynced} hideTitle
          onOpenAuth={dataSync.openAuthModal} onResendVerification={dataSync.cloudResendVerification}
          onCheckVerified={dataSync.cloudCheckEmailVerified} onSync={dataSync.cloudSync}
          onLogout={dataSync.cloudLogout} onDeleteAccount={dataSync.cloudDeleteAccount}
        />
      );
    }
    if (id === 'profile') {
      return (
        <AthleteProfileSection
          profile={state.settings.profile} hideTitle onOpenWizard={plan.openWizard}
          onChangeSex={(s) => void analytics.updateProfileSex(s)} onChangeAge={(r) => void analytics.updateProfileAge(r)}
          onChangeHeight={(r) => void analytics.updateProfileHeight(r)} onChangeGoal={(g) => void analytics.updateProfileGoal(g)}
          onChangeExperience={(e) => void analytics.updateProfileExperience(e)} onChangeDays={(d) => void analytics.updateProfileDays(d)}
        />
      );
    }
    if (id === 'ai') {
      return (
        <AiPreferencesSection
          state={state} tone={tone} hideTitle
          onChangeTone={(next) => void dataSync.setAiToneWithToast(next)}
          onRunAi={plan.runAi} onRetryAi={plan.retryAi} onDismissAi={plan.dismissAi}
        />
      );
    }
    return (
      <SettingsRelatedLinks
        onOpenData={() => setTab('data')}
        onOpenExercises={() => plan.openPlanTab('exercises')}
        onOpenPhases={() => plan.openPlanTab('phases')}
      />
    );
  };

  const themePicker = (
    <SegmentedControl
      options={THEME_OPTIONS}
      value={theme}
      ariaLabel="Apariencia de la interfaz"
      className="inline-flex w-full sm:w-auto rounded-xl border border-white/10 bg-gray-950/60 p-1 gap-1"
      buttonClassName="flex-1 sm:flex-initial min-h-[44px] sm:min-h-[34px] px-3.5 py-1.5 text-xs font-bold"
      onChange={(next) => void dataSync.setThemeWithToast(next)}
    />
  );

  const mobRow = (s: SettingsSectionMeta) => (
    <button key={s.id} type="button" class="flex min-h-[56px] w-full items-center justify-between gap-3 py-3 text-left" onClick={() => setMobSub(s.id)}>
      <div class="min-w-0">
        <p class="text-sm font-bold text-white">{s.title}</p>
        <p class="truncate text-xs text-gray-400 tabular-nums">{s.summary}</p>
      </div>
      <Icon name="caretRight" className="h-4 w-4 shrink-0 text-gray-400" />
    </button>
  );

  return (
    <div>
      <div class="lg:hidden space-y-3">
        {!activeMobSec ? (
          <div class="divide-y divide-white/10 border-y border-white/10">
            {sections.map(mobRow)}
            <div class="py-3 space-y-2">
              <p class="text-sm font-bold text-white">Apariencia</p>
              {themePicker}
            </div>
          </div>
        ) : (
          <div class="space-y-4">
            <button type="button" class="inline-flex min-h-[44px] items-center gap-1 text-xs font-bold text-blue-300" onClick={() => setMobSub(null)}>
              <Icon name="caretLeft" className="h-4 w-4" /> Cuenta y ajustes
            </button>
            <h2 class="text-base font-extrabold text-white">{activeMobSec.title}</h2>
            {renderBody(activeMobSec.id)}
          </div>
        )}
      </div>

      <div class="hidden lg:block max-w-3xl divide-y divide-white/10 border-y border-white/10">
        {sections.map((s) => {
          const isOpen = openPc === s.id;
          return (
            <div key={s.id}>
              <button type="button" aria-expanded={isOpen ? 'true' : 'false'} class="flex w-full items-center justify-between gap-4 py-4 text-left" onClick={() => setOpenPc((cur) => (cur === s.id ? null : s.id))}>
                <div class="min-w-0">
                  <h2 class={s.titleCls ?? 'font-bold text-white'}>{s.title}</h2>
                  <p class="truncate text-xs text-gray-400 mt-0.5 tabular-nums">{s.summary}</p>
                </div>
                <Icon name={isOpen ? 'caretUp' : 'caretDown'} className="h-4 w-4 shrink-0 text-gray-400" />
              </button>
              <Collapsible open={isOpen} keepMounted>
                <div class="pb-5">{renderBody(s.id)}</div>
              </Collapsible>
            </div>
          );
        })}
        <div class="flex items-center justify-between gap-4 py-4">
          <div>
            <h2 class="font-bold text-white">Apariencia</h2>
            <p class="text-xs text-gray-400 mt-0.5">Modo oscuro, claro o automático según tu dispositivo.</p>
          </div>
          {themePicker}
        </div>
      </div>
    </div>
  );
}
