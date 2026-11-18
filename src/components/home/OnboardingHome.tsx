import { ROUTINE_TEMPLATES } from '../../lib/seed';
import { routineColor, routineNames, type State } from '../../ui/shared';
import { Icon } from '../common/Icon';

interface OnboardingHomeProps {
  /** Estado global con configuración y plantillas disponibles. */
  state: State;
  /** Abre el asistente inicial de configuración en 3 pasos. */
  onOpenWizard: () => void;
  /** Inicia la vista `En vivo` directamente con una rutina opcional. */
  onStartWorkout: (day?: string) => void;
  /** Abre la vista `Registrar hecho`. */
  onGoLog: () => void;
  /** Aplica una plantilla rápida de entrenamiento. */
  onApplyTemplate: (key: string) => void;
  /** Navega a una sección concreta (`plan`, `body`, `data`). */
  onNavigateTab: (tab: string) => void;
}

/**
 * Pantalla de bienvenida del Día 1 cuando aún no hay registros guardados.
 */
export function OnboardingHome({
  state,
  onOpenWizard,
  onStartWorkout,
  onGoLog,
  onApplyTemplate,
  onNavigateTab,
}: OnboardingHomeProps) {
  const routines = routineNames(state.settings);
  const tpls = Object.entries(ROUTINE_TEMPLATES);

  return (
    <div class="space-y-6">
      <section class="rounded-2xl border border-white/10 bg-cardDark p-5 sm:p-6 space-y-5">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-wider text-emerald-400">Primeros pasos</span>
            <h2 class="text-xl sm:text-2xl font-extrabold text-white">Tu cuaderno de entrenamiento está listo</h2>
            <p class="text-sm text-gray-300 max-w-2xl">
              Registra tu primer entreno directamente desde aquí o elige una distribución base. Si ya tienes historial en Samsung Health o CSV, puedes importarlo cuando quieras.
            </p>
          </div>
          <div class="flex flex-wrap gap-2 shrink-0">
            <button type="button" class="btn btn-accent min-h-[44px]" data-act="openWizard" onClick={onOpenWizard}>
              {state.settings.onboardingCompleted ? 'Editar perfil y objetivo' : 'Configurar perfil y objetivo (1 min)'}
            </button>
            <button type="button" class="btn-primary shrink-0 min-h-[44px] px-5" data-act="startWorkout" onClick={() => onStartWorkout()}>
              + Empezar primer entreno hoy
            </button>
          </div>
        </div>

        <div class="space-y-2 border-t border-white/10 pt-4">
          <p class="text-xs font-semibold uppercase tracking-wider text-gray-400">Iniciar directamente una rutina activa</p>
          <div class="flex flex-wrap items-center gap-2">
            {routines.map((r, idx) => {
              const hex = routineColor(r, state.settings, idx);
              const count = state.settings.routines[r]?.length ?? 0;
              return (
                <button key={r} type="button" class="btn min-h-[44px]" data-act="startWorkout" data-arg={r} onClick={() => onStartWorkout(r)}>
                  <span class="h-2.5 w-2.5 rounded-full" style={{ background: hex }} aria-hidden="true" />
                  <span>{r}</span>
                  <span class="text-xs text-gray-400 tabular-nums">({count})</span>
                </button>
              );
            })}
            <button type="button" class="btn-sm" data-act="goLog" onClick={onGoLog}>
              ¿Ya terminaste? Registrar sesión pasada
            </button>
          </div>
        </div>
      </section>

      <section class="space-y-3 pb-5 border-b border-white/10">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="text-base font-bold text-white">Plantillas de rutina</h3>
            <p class="text-xs text-gray-400">Cambia la distribución en un toque o edita los ejercicios a tu gusto.</p>
          </div>
          <button type="button" class="btn-sm" data-act="tab" data-arg="plan" onClick={() => onNavigateTab('plan')}>
            Personalizar en Plan y rutinas
          </button>
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tpls.map(([key, tpl]) => (
            <button
              key={key}
              type="button"
              data-act="rtApplyTpl"
              data-arg={key}
              class="rounded-2xl border border-white/10 bg-cardDark p-4 text-left transition-colors hover:border-electricBlue/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue"
              onClick={() => onApplyTemplate(key)}
            >
              <div class="text-sm font-bold text-white">{tpl.label}</div>
              <p class="mt-1 text-xs text-gray-400 leading-relaxed">{tpl.desc}</p>
            </button>
          ))}
        </div>
      </section>

      <section class="flex flex-wrap items-center justify-between gap-3">
        <div class="text-sm text-gray-300">¿Prefieres empezar registrando tu peso inicial o trayendo datos previos?</div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn min-h-[44px]" data-act="tab" data-arg="body" onClick={() => onNavigateTab('body')}>
            <Icon name="body" className="h-4 w-4" /> Registrar primeras medidas
          </button>
          <button type="button" class="btn min-h-[44px]" data-act="tab" data-arg="data" onClick={() => onNavigateTab('data')}>
            <Icon name="upload" className="h-4 w-4" /> Importar Samsung Health / CSV
          </button>
        </div>
      </section>
    </div>
  );
}
