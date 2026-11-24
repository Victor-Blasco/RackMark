import {
  exportBackup,
  importBackup,
  mergeWellbeing,
  parseBackup,
  putMany,
  sanitizeSettings,
  saveSettings,
} from '../lib/db';
import { parseMeasuresCsv } from '../lib/measures';
import { importSamsungInWorker } from '../lib/samsung';
import { markBucketUpserts, markSettingsDirty } from '../lib/sync';
import type { AiTone, ThemeMode } from '../types';
import { todayIso, type State } from '../ui/shared';
import { humanizeError } from './types';

const MAX_SINGLE_FILE_BYTES = 50 * 1024 * 1024;

/** Dependencias para exportación, importaciones pesadas, nube y tono IA. */
export interface DataSyncActionDeps {
  getState: () => State;
  persist: () => Promise<void>;
  reload: () => Promise<void>;
  render: () => void;
  queueSync: () => void;
  toast: (msg: string) => void;
  downloadFile?: (name: string, data: string, type: string) => void;
  wipeAllData: () => Promise<void>;
  cloudLogin: () => Promise<void>;
  cloudSync: () => Promise<void>;
  cloudLogout: () => Promise<void>;
}

/** Tipo de retorno completo de acciones de datos y cuenta en la nube. */
export type DataSyncActions = ReturnType<typeof createDataSyncActions>;

/**
 * Crea acciones reactivas para `Datos y copias` y `Cuenta y ajustes`.
 *
 * @param deps - Puentes a base de datos local, sincronización nube y avisos.
 * @returns Conjunto tipado de manejadores de exportación, importación y sesión.
 */
export function createDataSyncActions(deps: DataSyncActionDeps) {
  const state = () => deps.getState();

  return {
    async exportBackupFile() {
      const data = JSON.stringify(await exportBackup());
      deps.downloadFile?.(`gymapp-backup-${todayIso()}.json`, data, 'application/json');
    },

    async importFiles(kind: 'samsung' | 'measures' | 'backup', fileList: FileList | null) {
      if (!fileList?.length) return;
      const files = [...fileList];
      const S = state();
      try {
        if (kind === 'samsung') {
          deps.toast('Procesando exportación…');
          const imp = await importSamsungInWorker(files);
          const before = S.strength.length;
          await putMany('strength', imp.strength);
          await putMany('cardio', imp.cardio);
          await mergeWellbeing(imp.wellbeing);
          S.settings = sanitizeSettings({
            ...S.settings,
            customNames: { ...S.settings.customNames, ...imp.customNames },
          });
          await saveSettings(S.settings);
          markBucketUpserts('strength', imp.strength);
          markBucketUpserts('cardio', imp.cardio);
          markBucketUpserts('wellbeing', imp.wellbeing);
          markSettingsDirty();
          await deps.reload();
          deps.render();
          deps.queueSync();
          const unresolvedCustomIds = imp.strength
            .map((row) => row.ref)
            .filter((ref) => !ref.startsWith('name:') && !ref.startsWith('type:') && !S.settings.customNames[ref])
            .filter((ref, index, refs) => refs.indexOf(ref) === index);
          const parts = [
            `${S.strength.length - before} ejercicios nuevos (${imp.strength.length} leídos)`,
            `${imp.cardio.length} cardio`,
            `${imp.wellbeing.length} días de bienestar`,
            `${Object.keys(imp.customNames).length} nombres`,
          ];
          deps.toast(
            `Importado: ${parts.join(', ')}.${
              unresolvedCustomIds.length
                ? ` Faltan nombres personalizados para ${unresolvedCustomIds.length} ejercicios. Puedes asignarles nombre desde Catálogo y músculos o volver a exportar el ZIP completo desde Samsung Health.`
                : ''
            }`,
          );
        } else if (kind === 'measures') {
          if (files[0].size > MAX_SINGLE_FILE_BYTES) throw new Error('Archivo demasiado grande (máx. 50 MB).');
          const m = parseMeasuresCsv(await files[0].text());
          if (!m.measures.length && !Object.keys(m.profile).length) {
            deps.toast('No se encontraron filas válidas. Usa fecha DD/MM/AAAA o AAAA-MM-DD y columnas como Fecha, Peso, % Grasa o Cintura.');
            return;
          }
          await putMany('measures', m.measures);
          S.settings = sanitizeSettings({
            ...S.settings,
            profile: { ...S.settings.profile, ...m.profile },
          });
          await saveSettings(S.settings);
          markBucketUpserts('measures', m.measures);
          markSettingsDirty();
          await deps.reload();
          deps.render();
          deps.queueSync();
          deps.toast(`Importadas ${m.measures.length} mediciones.`);
        } else if (kind === 'backup') {
          if (files[0].size > MAX_SINGLE_FILE_BYTES) throw new Error('Archivo demasiado grande (máx. 50 MB).');
          const b = parseBackup(await files[0].text());
          await importBackup(b);
          markBucketUpserts('strength', b.strength);
          markBucketUpserts('cardio', b.cardio);
          markBucketUpserts('measures', b.measures);
          if (b.wellbeing?.length) markBucketUpserts('wellbeing', b.wellbeing);
          markSettingsDirty();
          await deps.reload();
          deps.render();
          deps.queueSync();
          deps.toast('Copia restaurada.');
        }
      } catch (err) {
        deps.toast(`Error al importar: ${humanizeError(err, 'revisa que el archivo tenga un formato válido.')}`);
      }
    },

    wipeAllData: () => void deps.wipeAllData(),
    cloudLogin: () => void deps.cloudLogin(),
    cloudSync: () => void deps.cloudSync(),
    cloudLogout: () => void deps.cloudLogout(),

    async setAiToneWithToast(tone: AiTone) {
      const S = state();
      if (S.settings.aiTone === tone) return;
      S.settings = { ...S.settings, aiTone: tone };
      await deps.persist();
      deps.toast(`Nivel de IA: ${tone === 'simple' ? 'Sencillo y generalista' : 'Técnico y detallado'}.`);
    },

    async setThemeWithToast(theme: ThemeMode) {
      const S = state();
      if ((S.settings.theme ?? 'dark') === theme) return;
      S.settings = { ...S.settings, theme };
      await deps.persist();
      const label = theme === 'light' ? 'Claro' : theme === 'system' ? 'Preferencia del sistema' : 'Oscuro';
      deps.toast(`Apariencia: ${label}.`);
    },
  };
}
