import { useRestTimer } from '../../hooks/useRestTimer';
import { fmtMMSS } from '../../ui/restAudio';
import { Icon } from '../common/Icon';

interface RestTimerBarProps {
  /** Marca temporal de fin de descanso activo en milisegundos epoch. */
  restUntil?: number;
  /** Segundos restantes guardados si el temporizador está pausado. */
  restPausedRemSec?: number;
  /** Descanso objetivo del ejercicio o sesión en segundos (`90` si se omite). */
  targetRestSec?: number;
  /** Ajusta el temporizador activo sumando o restando segundos (`±30s`). */
  onAdjust?: (deltaSec: number) => void;
  /** Pausa o reanuda el temporizador activo. */
  onTogglePause?: () => void;
  /** Inicia un descanso manual con la duración configurada. */
  onStart?: (sec: number) => void;
  /** Detiene y registra el descanso pendiente. */
  onStop?: () => void;
}

/**
 * Barra de cronómetro de descanso entre series en sus estados activo, pausado, completado o en espera.
 */
export function RestTimerBar({
  restUntil,
  restPausedRemSec,
  targetRestSec = 90,
  onAdjust,
  onTogglePause,
  onStart,
  onStop,
}: RestTimerBarProps) {
  const { mode, remSec, restSec } = useRestTimer(restUntil, targetRestSec, restPausedRemSec);

  if (mode === 'running' || mode === 'paused') {
    const isPaused = mode === 'paused';
    return (
      <div
        id="rest-timer-bar"
        data-rest-state={mode}
        class={`border-l-4 px-3 py-2.5 rounded-r-xl ${isPaused ? 'border-amberGold bg-amberGold/10' : 'border-electricBlue bg-electricBlue/10'}`}
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2.5">
            <span id="rest-timer-val" class="tabular-nums text-2xl font-extrabold text-white">{fmtMMSS(remSec)}</span>
            <span class={`text-xs font-semibold uppercase tracking-wide ${isPaused ? 'text-amberGold' : 'text-blue-300'}`}>
              {isPaused ? 'En pausa' : 'Descanso'}
            </span>
          </div>
          <div class="grid grid-cols-3 gap-1.5 w-full sm:w-auto">
            <button type="button" class="btn min-h-[48px] sm:min-h-[44px] px-3 tabular-nums" aria-label="Restar 30 segundos" onClick={() => onAdjust?.(-30)}>−30s</button>
            <button type="button" class="btn min-h-[48px] sm:min-h-[44px] px-3 border-electricBlue/50 text-blue-200 hover:border-electricBlue" onClick={() => onTogglePause?.()}>
              {isPaused ? 'Reanudar' : 'Pausar'}
            </button>
            <button type="button" class="btn min-h-[48px] sm:min-h-[44px] px-3 tabular-nums" aria-label="Sumar 30 segundos" onClick={() => onAdjust?.(30)}>+30s</button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'done') {
    return (
      <div id="rest-timer-bar" data-rest-state="done" class="border-l-4 border-emeraldGreen bg-emeraldGreen/10 px-3 py-2 rounded-r-xl">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="h-2.5 w-2.5 rounded-full bg-emeraldGreen" aria-hidden="true" />
            <span class="text-sm font-bold text-emerald-300">¡Descanso listo!</span>
          </div>
          <div class="flex items-center gap-1.5">
            <button type="button" class="btn min-h-[44px] px-3 text-xs tabular-nums" onClick={() => onStart?.(restSec)}>Repetir {fmtMMSS(restSec)}</button>
            <button type="button" class="btn min-h-[44px] px-3 text-xs" onClick={() => onStop?.()}>Cerrar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="rest-timer-bar" data-rest-state="idle" class="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2 text-xs">
      <span class="text-gray-400">Descanso</span>
      <button
        type="button"
        class="btn min-h-[44px] min-w-[44px] sm:min-h-[36px] px-3 text-xs font-semibold text-blue-300 tabular-nums"
        onClick={() => onStart?.(restSec)}
      >
        <Icon name="play" className="h-3.5 w-3.5" /> Iniciar {fmtMMSS(restSec)}
      </button>
    </div>
  );
}
