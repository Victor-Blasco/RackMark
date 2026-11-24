import { Icon } from '../common/Icon';

interface DataImportSectionProps {
  /** Importa archivos ZIP/CSV de Samsung, CSV de medidas o copia JSON. */
  onImportFiles: (kind: 'samsung' | 'measures' | 'backup', files: FileList | null) => Promise<void>;
  /** Cambia a la pestaña de medidas corporales. */
  onGoBody: () => void;
  /** Descarga la plantilla CSV de medidas corporales. */
  onDownloadTemplate: () => void;
  /** Descarga una copia JSON con todo el historial y ajustes. */
  onExportBackup: () => Promise<void>;
}

/**
 * Secciones de importación externa (Samsung Health / CSV) y copias de seguridad JSON.
 */
export function DataImportSection({ onImportFiles, onGoBody, onDownloadTemplate, onExportBackup }: DataImportSectionProps) {
  const handleFile = (kind: 'samsung' | 'measures' | 'backup', input: HTMLInputElement) => {
    const files = input.files;
    void onImportFiles(kind, files).finally(() => {
      input.value = '';
    });
  };

  return (
    <>
      <div class="grid grid-cols-1 gap-6 xl:grid-cols-2 pb-5 border-b border-white/10">
        <div class="space-y-3 pb-5 border-b border-white/10 xl:pb-0 xl:border-b-0 xl:border-r xl:border-white/10 xl:pr-6">
          <div>
            <h2 class="font-bold text-white">Samsung Health</h2>
            <p class="text-xs text-gray-400 mt-0.5">
              Sube el archivo ZIP o los CSV exportados desde Samsung Health. Puedes volver a importar cuando quieras sin duplicar sesiones.
            </p>
            <p class="text-[11px] text-gray-400 mt-1">
              En tu móvil: Samsung Health → Ajustes → Descargar datos personales → sube aquí el ZIP.
            </p>
          </div>
          <div class="space-y-1.5">
            <p class="lbl">Archivo ZIP o CSV (máx. 50 MB por archivo)</p>
            <label class="btn cursor-pointer focus-within:outline-none focus-within:ring-2 focus-within:ring-electricBlue">
              <Icon name="upload" className="h-4 w-4" /> Seleccionar ZIP o CSV
              <input
                class="sr-only"
                type="file"
                accept=".zip,.csv"
                multiple
                onChange={(e) => handleFile('samsung', e.currentTarget)}
              />
            </label>
          </div>
        </div>

        <div class="space-y-3">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 class="font-bold text-white">Medidas corporales (CSV)</h2>
              <p class="text-xs text-gray-400 mt-0.5">
                Importa tu histórico de peso, % grasa y perímetros, o añade mediciones nuevas manualmente desde la pestaña Cuerpo.
              </p>
            </div>
            <button type="button" class="btn-sm" onClick={onGoBody}>
              Ir a Cuerpo
            </button>
          </div>
          <div class="space-y-1.5">
            <p class="lbl">Archivo CSV de medidas</p>
            <div class="flex flex-wrap gap-2">
              <label class="btn cursor-pointer focus-within:outline-none focus-within:ring-2 focus-within:ring-electricBlue">
                <Icon name="upload" className="h-4 w-4" /> Seleccionar CSV de medidas
                <input
                  class="sr-only"
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleFile('measures', e.currentTarget)}
                />
              </label>
              <button type="button" class="btn" onClick={onDownloadTemplate}>
                <Icon name="download" className="h-4 w-4" /> Descargar plantilla CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="space-y-4 pb-5 border-b border-white/10">
        <div>
          <h2 class="font-bold text-white">Copia de seguridad completa</h2>
          <p class="text-xs text-gray-400 mt-0.5">
            Descarga o restaura todos tus entrenamientos, medidas, rutinas y ajustes en un archivo de respaldo.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn" onClick={() => void onExportBackup()}>
            <Icon name="download" className="h-4 w-4" /> Descargar copia de seguridad
          </button>
          <label class="btn cursor-pointer focus-within:outline-none focus-within:ring-2 focus-within:ring-electricBlue">
            <Icon name="upload" className="h-4 w-4" /> Restaurar copia de seguridad
            <input
              class="sr-only"
              type="file"
              accept=".json"
              onChange={(e) => handleFile('backup', e.currentTarget)}
            />
          </label>
        </div>
      </div>
    </>
  );
}
