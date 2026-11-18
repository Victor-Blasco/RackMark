import { useEffect, useRef, useState } from 'preact/hooks';

export type RestTimerMode = 'running' | 'done' | 'idle';

/** Formatea segundos enteros a `M:SS` para el cronómetro de descanso. */
export function fmtMMSS(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Estado calculado del temporizador de descanso entre series. */
export interface RestTimerSnapshot {
  /** Fase actual del cronómetro: contando, terminado o en espera. */
  mode: RestTimerMode;
  /** Segundos restantes hasta el fin del descanso. */
  remSec: number;
  /** Duración objetivo configurada por defecto en segundos. */
  restSec: number;
}

/**
 * Calcula de forma pura los segundos restantes y la fase del descanso.
 *
 * @param restUntil - Marca temporal objetivo en milisegundos epoch.
 * @param targetRestSec - Duración objetivo por defecto en segundos.
 * @param now - Instante de referencia (por defecto `Date.now()`).
 * @returns Instantánea determinista del estado del cronómetro.
 */
export function calcRestTimerState(
  restUntil?: number,
  targetRestSec = 90,
  now = Date.now(),
): RestTimerSnapshot {
  const remSec = restUntil != null ? Math.max(0, Math.ceil((restUntil - now) / 1000)) : 0;
  const mode: RestTimerMode = restUntil != null && remSec > 0 ? 'running' : restUntil != null ? 'done' : 'idle';
  return { mode, remSec, restSec: targetRestSec };
}

/**
 * Hook reactivo que actualiza cada segundo la cuenta atrás de descanso y dispara
 * el aviso sonoro/vibración exactamente una vez al llegar a cero.
 *
 * @param restUntil - Marca temporal objetivo en milisegundos epoch.
 * @param targetRestSec - Duración objetivo por defecto en segundos.
 * @param onExpire - Callback opcional ejecutado al agotarse el temporizador.
 * @returns Instantánea reactiva `{ mode, remSec, restSec }`.
 */
export function useRestTimer(
  restUntil?: number,
  targetRestSec = 90,
  onExpire?: () => void,
): RestTimerSnapshot {
  const [now, setNow] = useState(() => Date.now());
  const firedForUntil = useRef<number | undefined>(undefined);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    setNow(Date.now());
    if (restUntil == null || restUntil <= Date.now()) return;
    if (firedForUntil.current !== restUntil) firedForUntil.current = undefined;

    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= restUntil) {
        window.clearInterval(timer);
        if (firedForUntil.current !== restUntil) {
          firedForUntil.current = restUntil;
          onExpireRef.current?.();
        }
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [restUntil]);

  return calcRestTimerState(restUntil, targetRestSec, now);
}
