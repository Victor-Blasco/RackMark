import { useEffect, useState } from 'preact/hooks';

type RestTimerMode = 'running' | 'paused' | 'done' | 'idle';

/** Estado calculado del temporizador de descanso entre series. */
interface RestTimerSnapshot {
  /** Fase actual del cronómetro: contando, en pausa, terminado o en espera. */
  mode: RestTimerMode;
  /** Segundos restantes hasta el fin del descanso. */
  remSec: number;
  /** Duración objetivo configurada por defecto en segundos. */
  restSec: number;
}

/**
 * Calcula de forma pura los segundos restantes y la fase del descanso.
 */
function calcRestTimerState(
  restUntil?: number,
  targetRestSec = 90,
  now = Date.now(),
  restPausedRemSec?: number,
): RestTimerSnapshot {
  if (restPausedRemSec != null && restPausedRemSec > 0) {
    return { mode: 'paused', remSec: Math.round(restPausedRemSec), restSec: targetRestSec };
  }
  const remSec = restUntil != null ? Math.max(0, Math.ceil((restUntil - now) / 1000)) : 0;
  const mode: RestTimerMode = restUntil != null && remSec > 0 ? 'running' : restUntil != null ? 'done' : 'idle';
  return { mode, remSec, restSec: targetRestSec };
}

/**
 * Hook reactivo que actualiza cada segundo la cuenta atrás de descanso.
 *
 * @param restUntil - Marca temporal objetivo en milisegundos epoch.
 * @param targetRestSec - Duración objetivo por defecto en segundos.
 * @param restPausedRemSec - Segundos restantes cuando el descanso está en pausa.
 * @returns Instantánea reactiva `{ mode, remSec, restSec }`.
 */
export function useRestTimer(
  restUntil?: number,
  targetRestSec = 90,
  restPausedRemSec?: number,
): RestTimerSnapshot {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    if (restPausedRemSec != null || restUntil == null || restUntil <= Date.now()) return;

    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= restUntil) window.clearInterval(timer);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [restUntil, restPausedRemSec]);

  return calcRestTimerState(restUntil, targetRestSec, now, restPausedRemSec);
}
