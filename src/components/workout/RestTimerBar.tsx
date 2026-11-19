import { fmtMMSS, useRestTimer } from '../../hooks/useRestTimer';

const REST_PRESETS = [60, 90, 120, 180] as const;

interface RestTimerBarProps {
  /** Marca temporal de fin de descanso activo en milisegundos epoch. */
  restUntil?: number;
  /** Descanso objetivo por defecto en segundos (`90` si se omite). */
  targetRestSec?: number;
  /** Ajusta el temporizador activo sumando o restando segundos. */
  onAdjust?: (deltaSec: number) => void;
  /** Inicia un descanso manual con la duración elegida. */
  onStart?: (sec: number) => void;
  /** Detiene y registra el descanso pendiente. */
  onStop?: () => void;
  /** Cambia el descanso automático por defecto entre series. */
  onSelectPreset?: (sec: number) => void;
}

/**
 * Barra de cronómetro de descanso entre series en sus estados activo, completado o en espera.
 */
export function RestTimerBar({
  restUntil,
  targetRestSec = 90,
  onAdjust,
  onStart,
  onStop,
  onSelectPreset,
}: RestTimerBarProps) {
  const { mode, remSec, restSec } = useRestTimer(restUntil, targetRestSec);

  if (mode === 'running') {
    return (
      <div id="rest-timer-bar" data-rest-state="running" class="border-l-4 border-electricBlue bg-electricBlue/10 px-3 py-2 rounded-r-xl">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2.5">
            <span id="rest-timer-val" class="tabular-nums text-2xl font-extrabold text-white">{fmtMMSS(remSec)}</span>
            <span class="text-xs font-semibold uppercase tracking-wide text-blue-300">Descanso</span>
          </div>
          <div class="flex items-center gap-1.5">
            <button type="button" class="btn min-h-[48px] sm:min-h-[44px] px-3 tabular-nums" aria-label="Restar 15 segundos" onClick={() => onAdjust?.(-15)}>−15s</button>
            <button type="button" class="btn min-h-[48px] sm:min-h-[44px] px-3 tabular-nums" aria-label="Sumar 30 segundos" onClick={() => onAdjust?.(30)}>+30s</button>
            <button type="button" class="btn min-h-[48px] sm:min-h-[44px] border-emeraldGreen/50 hover:border-emeraldGreen px-3 text-emerald-300" onClick={() => onStop?.()}>Listo</button>
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
            {REST_PRESETS.map((p) => (
              <button key={p} type="button" class="btn min-h-[44px] px-2.5 text-xs tabular-nums" onClick={() => onStart?.(p)}>{p}s</button>
            ))}
            <button type="button" class="btn min-h-[44px] px-3 text-xs" onClick={() => onStop?.()}>Cerrar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="rest-timer-bar" data-rest-state="idle" class="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2 text-xs">
      <span class="text-gray-400">Descanso auto entre series: <b class="text-white tabular-nums">{restSec}s</b></span>
      <div class="inline-flex items-center gap-1 rounded-xl bg-white/5 p-1">
        {REST_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            class={`min-h-[44px] sm:min-h-[36px] rounded-lg px-2.5 text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${p === restSec ? 'bg-electricBlue/25 text-blue-200' : 'text-gray-400 hover:text-white'}`}
            onClick={() => onSelectPreset?.(p)}
          >
            {p}s
          </button>
        ))}
      </div>
    </div>
  );
}
