import { Icon } from '../components/common/Icon';
import { ViewHeader } from '../components/common/ViewHeader';
import { DataImportSection } from '../components/data/DataImportSection';
import { DuplicateSessionsPanel } from '../components/data/DuplicateSessionsPanel';
import { findDuplicateSessionGroups } from '../lib/dedupSessions';
import { useAppStore } from '../store/appStore';
import type { State } from '../ui/shared';

interface DataViewProps {
  /** Estado explícito opcional para renderizado SSR aislado en tests. */
  state?: State;
}

/**
 * Vista `Datos e importación`: carga desde Samsung Health / CSV, copias JSON y borrado total.
 */
export function DataView({ state: propState }: DataViewProps) {
  const { state: storeState, plan, dataSync, setTab } = useAppStore();
  const state = propState ?? storeState;
  const unmappedCount = state.analysis.unmapped.length;
  const dupGroups = findDuplicateSessionGroups(state);

  return (
    <div class="space-y-5">
      <div class={unmappedCount > 0 ? '' : 'hidden lg:block'}>
        <ViewHeader
          title="Datos e importación"
          subtitle="Importa tu historial externo, descarga copias de seguridad y gestiona los datos guardados."
          right={
            unmappedCount > 0 ? (
              <button
                type="button"
                class="btn-sm border-amberGold/50 text-amberGold"
                onClick={plan.openUnmapped}
              >
                {unmappedCount} ejercicios importados sin nombre → Asignar
              </button>
            ) : undefined
          }
        />
      </div>

      <div class="pb-5 border-b border-white/10">
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-4 pt-1">
          <div>
            <span class="block text-xs text-gray-400">Fuerza</span>
            <span class="tabular-nums text-xl font-extrabold text-white">{state.strength.length}</span>
            <span class="block text-xs text-gray-400">ejercicios registrados</span>
          </div>
          <div>
            <span class="block text-xs text-gray-400">Cardio</span>
            <span class="tabular-nums text-xl font-extrabold text-white">{state.cardio.length}</span>
            <span class="block text-xs text-gray-400">sesiones guardadas</span>
          </div>
          <div>
            <span class="block text-xs text-gray-400">Bienestar</span>
            <span class="tabular-nums text-xl font-extrabold text-white">{state.wellbeing.length}</span>
            <span class="block text-xs text-gray-400">días de sueño y pasos</span>
          </div>
          <div>
            <span class="block text-xs text-gray-400">Medidas</span>
            <span class="tabular-nums text-xl font-extrabold text-white">{state.measures.length}</span>
            <span class="block text-xs text-gray-400">registros corporales</span>
          </div>
        </div>
      </div>

      <DuplicateSessionsPanel
        groups={dupGroups}
        onKeepSession={(sessions, keepId) => void dataSync.resolveDuplicateSession(sessions, keepId)}
      />

      <DataImportSection
        onImportFiles={dataSync.importFiles}
        onGoBody={() => setTab('body')}
        onDownloadTemplate={dataSync.downloadMeasuresTemplate}
        onExportBackup={dataSync.exportBackupFile}
      />

      <div class="rounded-2xl border border-coralRed/30 p-4 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="font-bold text-coralRed">Zona de peligro</h2>
            <p class="text-xs text-gray-300 mt-0.5">
              {state.user
                ? 'Elimina todos tus entrenamientos, medidas y ajustes de este dispositivo y de tu nube conectada.'
                : 'Elimina todos los entrenamientos, medidas y ajustes guardados en este dispositivo.'}
            </p>
          </div>
          <button
            type="button"
            class="btn btn-danger"
            onClick={dataSync.wipeAllData}
          >
            <Icon name="trash" className="h-4 w-4" /> Borrar todos los datos
          </button>
        </div>
      </div>
    </div>
  );
}
