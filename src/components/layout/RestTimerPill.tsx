import { useEffect, useRef } from 'preact/hooks';
import { fmtMMSS, useRestTimer } from '../../hooks/useRestTimer';

interface RestTimerBadgeProps {
  /** Marca temporal objetivo en milisegundos epoch. */
  restUntil?: number;
  /** Duración objetivo configurada por defecto en segundos. */
  targetRestSec?: number;
  /** Segundos restantes explícitos opcionales para renderizado SSR aislado. */
  fallbackRemSec?: number;
  /** Clases CSS aplicables al badge visible cuando hay descanso activo. */
  className: string;
}

/** Insignia hoja que actualiza el reloj de descanso sin re-renderizar `AppShell`. */
export function RestTimerBadge({ restUntil, targetRestSec, fallbackRemSec = 0, className }: RestTimerBadgeProps) {
  const { remSec } = useRestTimer(restUntil, targetRestSec);
  const effectiveSec = restUntil != null ? remSec : fallbackRemSec;
  if (effectiveSec <= 0) return null;
  return <span class={className}>{fmtMMSS(effectiveSec)}</span>;
}

interface RestTimerWatcherProps {
  /** Marca temporal objetivo del descanso activo en milisegundos epoch. */
  restUntil?: number;
  /** Callback ejecutado exactamente una vez al expirar el descanso. */
  onExpire?: () => void;
}

/** Observador silencioso que dispara aviso al vencer `restUntil` sin re-renders periódicos del shell. */
export function RestTimerWatcher({ restUntil, onExpire }: RestTimerWatcherProps) {
  const firedForRef = useRef<number | undefined>(undefined);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (restUntil == null || restUntil <= Date.now()) return;
    if (firedForRef.current !== restUntil) firedForRef.current = undefined;
    const fireIfDue = () => {
      if (Date.now() < restUntil || firedForRef.current === restUntil) return false;
      firedForRef.current = restUntil;
      onExpireRef.current?.();
      return true;
    };
    const id = window.setTimeout(() => { fireIfDue(); }, Math.max(0, restUntil - Date.now()) + 20);
    const onVis = () => { fireIfDue(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [restUntil]);

  return null;
}
