import { routineColor, routineNames, type State } from '../../ui/shared';
import { Icon } from '../common/Icon';

interface OnboardingHomeProps {
  /** Estado global con configuración y medidas iniciales. */
  state: State;
  /** Abre el asistente inicial de configuración en 3 pasos. */
  onOpenWizard: () => void;
  /** Inicia la vista `En vivo` directamente con una rutina opcional. */
  onStartWorkout: (day?: string) => void;
  /** Abre la vista `Registrar hecho`. */
  onGoLog: () => void;
  /** Navega a una sección concreta (`plan`, `body`, `data`). */
  onNavigateTab: (tab: string) => void;
}

/**
 * Pantalla de bienvenida guiada en 3 pasos cuando aún no hay entrenamientos guardados.
 */
export function OnboardingHome({
  state,
  onOpenWizard,
  onStartWorkout,
  onGoLog,
  onNavigateTab,
}: OnboardingHomeProps) {
  const routines = routineNames(state.settings);
  const onboarded = Boolean(state.settings.onboardingCompleted);

  return (
    <div class="max-w-3xl space-y-6">
      <header class="space-y-1">
        <span class="text-xs font-semibold uppercase tracking-wider text-emerald-400">Primeros pasos</span>
        <h2 class="text-xl sm:text-2xl font-extrabold text-white">Tu cuaderno de entrenamiento está listo</h2>
        <p class="text-sm text-gray-300">
          Completa estos pasos a tu ritmo. En cuanto guardes tu primer entreno verás tus gráficas y progresión aquí.
        </p>
      </header>

      <ol class="divide-y divide-white/10 border-y border-white/10">
        <li class="py-5 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2.5">
              <span class={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold tabular-nums ${onboarded ? 'bg-emeraldGreen/20 text-emerald-300' : 'bg-electricBlue/20 text-blue-300'}`}>
                1
              </span>
              <div>
                <h3 class="text-sm sm:text-base font-bold text-white">Perfil y rutina configurada</h3>
                <p class="text-xs text-gray-400">
                  {routines.length > 0 ? `Rutinas activas: ${routines.join(' · ')}` : 'Todavía no tienes rutinas definidas.'}
                </p>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="btn-sm min-h-[44px] sm:min-h-0" onClick={onOpenWizard}>
                {onboarded ? 'Editar perfil y objetivo' : 'Configurar perfil y objetivo (1 min)'}
              </button>
              <button type="button" class="btn-sm min-h-[44px] sm:min-h-0" onClick={() => onNavigateTab(routines[0] ?? 'plan')}>
                Ver y editar rutinas
              </button>
            </div>
          </div>
        </li>

        <li class="py-5 space-y-3">
          <div class="flex items-center gap-2.5">
            <span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-electricBlue/20 text-xs font-extrabold text-blue-300 tabular-nums">
              2
            </span>
            <div>
              <h3 class="text-sm sm:text-base font-bold text-white">Registra tu primer entrenamiento</h3>
              <p class="text-xs text-gray-400">Empieza una sesión en directo o apunta un entreno que ya hayas terminado.</p>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" class="btn-primary min-h-[44px] px-5" onClick={() => onStartWorkout()}>
              + Empezar entreno en vivo
            </button>
            <button type="button" class="btn min-h-[44px]" onClick={onGoLog}>
              Registrar hecho
            </button>
          </div>
          {routines.length > 0 && (
            <div class="flex flex-wrap items-center gap-2 pt-1">
              <span class="text-xs text-gray-400">Abrir rutina directa:</span>
              {routines.map((r, idx) => {
                const hex = routineColor(r, state.settings, idx);
                const count = state.settings.routines[r]?.length ?? 0;
                return (
                  <button key={r} type="button" class="btn-sm min-h-[44px] sm:min-h-0" onClick={() => onStartWorkout(r)}>
                    <span class="h-2 w-2 rounded-full" style={{ background: hex }} aria-hidden="true" />
                    <span>{r}</span>
                    <span class="text-gray-400 tabular-nums">({count})</span>
                  </button>
                );
              })}
            </div>
          )}
        </li>

        <li class="py-5 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-2.5">
              <span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-extrabold text-gray-300 tabular-nums">
                3
              </span>
              <div>
                <h3 class="text-sm sm:text-base font-bold text-white">Medidas o historial previo (opcional)</h3>
                <p class="text-xs text-gray-400">
                  {state.measures.length > 0
                    ? `Ya tienes ${state.measures.length} ${state.measures.length === 1 ? 'medida inicial guardada' : 'medidas iniciales guardadas'}.`
                    : 'Añade tu peso inicial o importa tus entrenamientos desde Samsung Health o CSV.'}
                </p>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="btn-sm min-h-[44px] sm:min-h-0" onClick={() => onNavigateTab('body')}>
                <Icon name="body" className="h-4 w-4" /> Registrar medidas
              </button>
              <button type="button" class="btn-sm min-h-[44px] sm:min-h-0" onClick={() => onNavigateTab('data')}>
                <Icon name="upload" className="h-4 w-4" /> Importar datos
              </button>
            </div>
          </div>
        </li>
      </ol>
    </div>
  );
}
