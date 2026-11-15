import { icon } from './icons';
import { type State } from './shared';

/**
 * Renderiza la vista de gestión e importación de datos y copias de seguridad.
 *
 * @param S - Estado global de la aplicación.
 * @returns HTML completo de la pestaña `Datos e importación`.
 */
export function viewData(S: State): string {
  const unmappedCount = S.analysis.unmapped.length;

  return `
  <div class="space-y-4 pb-5 border-b border-white/10">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 class="text-lg font-extrabold text-white">Datos e importación</h2>
        <p class="text-xs text-gray-400">Importa tus exportaciones, genera copias de seguridad JSON y gestiona el almacenamiento local.</p>
      </div>
      ${unmappedCount > 0 ? `<button class="btn !border-amberGold/50 !py-1.5 !text-xs text-amberGold" data-act="openUnmapped">${unmappedCount} ejercicios Samsung sin nombre → Asignar</button>` : ''}
    </div>
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-4 pt-2">
      <div><span class="block text-xs text-gray-400">Fuerza</span><span class="tabular-nums text-xl font-extrabold text-white">${S.strength.length}</span><span class="block text-xs text-gray-400">ejercicios registrados</span></div>
      <div><span class="block text-xs text-gray-400">Cardio</span><span class="tabular-nums text-xl font-extrabold text-white">${S.cardio.length}</span><span class="block text-xs text-gray-400">sesiones guardadas</span></div>
      <div><span class="block text-xs text-gray-400">Bienestar</span><span class="tabular-nums text-xl font-extrabold text-white">${S.wellbeing.length}</span><span class="block text-xs text-gray-400">días de sueño y pasos</span></div>
      <div><span class="block text-xs text-gray-400">Medidas</span><span class="tabular-nums text-xl font-extrabold text-white">${S.measures.length}</span><span class="block text-xs text-gray-400">registros corporales</span></div>
    </div>
  </div>

  <div class="grid grid-cols-1 gap-6 xl:grid-cols-2 pb-5 border-b border-white/10">
    <div class="space-y-3 pb-5 border-b border-white/10 xl:pb-0 xl:border-b-0 xl:border-r xl:border-white/10 xl:pr-6">
      <div>
        <h3 class="font-bold text-white">Samsung Health</h3>
        <p class="text-xs text-gray-400 mt-0.5">Sube el ZIP completo o archivos CSV sueltos (exercise, custom_exercise, sleep, pedometer/step_daily_trend, vitality_score). Reimportar es seguro: se deduplica automáticamente.</p>
      </div>
      <label class="block"><span class="lbl">Archivo ZIP o CSV (máx. 50 MB por archivo)</span>
        <input class="inp" type="file" accept=".zip,.csv" multiple data-file="samsung"></label>
    </div>

    <div class="space-y-3">
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

  <div class="space-y-4 pb-5 border-b border-white/10">
    <div>
      <h3 class="font-bold text-white">Copia de seguridad completa (JSON)</h3>
      <p class="text-xs text-gray-400 mt-0.5">Descarga o restaura todos tus entrenamientos, medidas, rutinas y preferencias en un único archivo JSON verificado.</p>
    </div>
    <div class="flex flex-wrap gap-2">
      <button class="btn" data-act="export">${icon('download', 'h-4 w-4')} Exportar copia JSON</button>
      <label class="btn cursor-pointer">${icon('upload', 'h-4 w-4')} Restaurar copia JSON<input class="sr-only" type="file" accept=".json" data-file="backup"></label>
    </div>
  </div>

  <div class="rounded-2xl border border-coralRed/30 bg-coralRed/5 p-4 space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="font-bold text-rose-300">Zona de peligro</h3>
        <p class="text-xs text-gray-300 mt-0.5">${S.user ? 'Elimina todos tus entrenamientos, medidas y ajustes de este dispositivo y de tu nube conectada.' : 'Elimina todos los entrenamientos, medidas y ajustes guardados en este dispositivo.'}</p>
      </div>
      <button class="btn !border-coralRed/60 !bg-coralRed/10 text-rose-300 hover:!bg-coralRed/20" data-act="wipe">${icon('trash', 'h-4 w-4')} Borrar todos los datos</button>
    </div>
  </div>`;
}
