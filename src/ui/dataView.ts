import { icon } from './icons';
import { kpi, type State } from './shared';

/**
 * Renderiza la vista de gestión e importación de datos y copias de seguridad.
 *
 * @param S - Estado global de la aplicación.
 * @returns HTML completo de la pestaña `Datos e importación`.
 */
export function viewData(S: State): string {
  const unmappedCount = S.analysis.unmapped.length;

  return `
  <div class="card space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 class="text-lg font-extrabold text-white">Datos e importación</h2>
        <p class="text-xs text-gray-400">Importa tus exportaciones, genera copias de seguridad JSON y gestiona el almacenamiento local.</p>
      </div>
      ${unmappedCount > 0 ? `<button class="btn !border-amberGold/50 !py-1.5 !text-xs text-amberGold" data-act="openUnmapped">${unmappedCount} ejercicios Samsung sin nombre → Asignar</button>` : ''}
    </div>
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      ${kpi('Fuerza', String(S.strength.length), 'ejercicios registrados')}
      ${kpi('Cardio', String(S.cardio.length), 'sesiones guardadas')}
      ${kpi('Bienestar', String(S.wellbeing.length), 'días de sueño y pasos')}
      ${kpi('Medidas', String(S.measures.length), 'registros corporales')}
    </div>
  </div>

  <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
    <div class="card space-y-3">
      <div>
        <h3 class="font-bold text-white">Samsung Health</h3>
        <p class="text-xs text-gray-400 mt-0.5">Sube el ZIP completo o archivos CSV sueltos (exercise, custom_exercise, sleep, pedometer/step_daily_trend, vitality_score). Reimportar es seguro: se deduplica automáticamente.</p>
      </div>
      <label class="block"><span class="lbl">Archivo ZIP o CSV (máx. 50 MB por archivo)</span>
        <input class="inp" type="file" accept=".zip,.csv" multiple data-file="samsung"></label>
    </div>

    <div class="card space-y-3">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 class="font-bold text-white">Medidas corporales (CSV)</h3>
          <p class="text-xs text-gray-400 mt-0.5">Importa tu histórico de peso, % grasa y perímetros, o añade mediciones nuevas manualmente desde la pestaña Cuerpo.</p>
        </div>
        <button class="btn !py-1.5 !text-xs" data-act="tab" data-arg="body">Ir a Cuerpo</button>
      </div>
      <label class="block"><span class="lbl">Archivo CSV de medidas</span>
        <input class="inp" type="file" accept=".csv" data-file="measures"></label>
    </div>
  </div>

  <div class="card space-y-3">
    <div>
      <h3 class="font-bold text-white">Copia de seguridad completa (JSON)</h3>
      <p class="text-xs text-gray-400 mt-0.5">Descarga o restaura todos tus entrenamientos, medidas, rutinas y preferencias en un único archivo JSON verificado.</p>
    </div>
    <div class="flex flex-wrap gap-2">
      <button class="btn" data-act="export">${icon('download', 'h-4 w-4')} Exportar copia JSON</button>
      <label class="btn cursor-pointer">${icon('upload', 'h-4 w-4')} Restaurar copia JSON<input class="sr-only" type="file" accept=".json" data-file="backup"></label>
    </div>
  </div>

  <div class="card space-y-3 border-coralRed/30 bg-coralRed/5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="font-bold text-rose-300">Zona de peligro</h3>
        <p class="text-xs text-gray-300 mt-0.5">${S.user ? 'Elimina todos tus entrenamientos, medidas y ajustes de este dispositivo y de tu nube conectada.' : 'Elimina todos los entrenamientos, medidas y ajustes guardados en este dispositivo.'}</p>
      </div>
      <button class="btn !border-coralRed/60 !bg-coralRed/10 text-rose-300 hover:!bg-coralRed/20" data-act="wipe">${icon('trash', 'h-4 w-4')} Borrar todos los datos</button>
    </div>
  </div>`;
}
