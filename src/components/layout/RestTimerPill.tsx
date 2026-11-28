import { useEffect, useRef } from 'preact/hooks';
import { useRestTimer } from '../../hooks/useRestTimer';
import { fmtMMSS } from '../../ui/restAudio';
import { Icon } from '../common/Icon';

interface RestTimerBadgeProps {
  /** Marca temporal objetivo en milisegundos epoch. */
  restUntil?: number;
  /** Segundos restantes si el descanso está en pausa. */
  restPausedRemSec?: number;
  /** Duración objetivo configurada por defecto en segundos. */
  targetRestSec?: number;
  /** Clases CSS aplicables al badge visible cuando hay descanso activo. */
  className: string;
}

/** Insignia hoja que actualiza el reloj de descanso sin re-renderizar `AppShell`. */
export function RestTimerBadge({ restUntil, restPausedRemSec, targetRestSec, className }: RestTimerBadgeProps) {
  const { mode, remSec } = useRestTimer(restUntil, targetRestSec, restPausedRemSec);
  if ((mode !== 'running' && mode !== 'paused') || remSec <= 0) return null;
  return <span class={className}>{fmtMMSS(remSec)}</span>;
}

interface MobileTrainPillProps {
  /** Indica si la pestaña activa ya es `En vivo` o `Registrar hecho`. */
  inTrain: boolean;
  /** Indica si hay entreno/borrador activo para mostrar el indicador verde. */
  showDot: boolean;
  /** Marca temporal objetivo del descanso activo en milisegundos epoch. */
  restUntil?: number;
  /** Segundos restantes si el descanso está en pausa. */
  restPausedRemSec?: number;
  /** Duración objetivo del descanso activo en segundos. */
  targetRestSec?: number;
}

/** Pill del botón `Entrenar` en móvil: muestra el reloj de descanso al salir de `En vivo`. */
export function MobileTrainPill({ inTrain, showDot, restUntil, restPausedRemSec, targetRestSec }: MobileTrainPillProps) {
  const { mode, remSec } = useRestTimer(restUntil, targetRestSec, restPausedRemSec);
  const showTimer = !inTrain && (mode === 'running' || mode === 'paused') && remSec > 0;
  const bgCls = mode === 'paused' && showTimer ? 'bg-amberGold' : 'bg-electricBlue';

  return (
    <span
      class={`relative inline-flex min-w-[44px] items-center justify-center rounded-full px-3 py-1 shadow-sm ${bgCls} ${inTrain ? 'ring-2 ring-blue-300/60' : ''}`}
      style={{ color: 'rgb(var(--c-accent-fg))' }}
    >
      {showTimer
        ? <span class="text-xs font-extrabold tabular-nums tracking-tight">{fmtMMSS(remSec)}</span>
        : <Icon name="play" className="h-4 w-4" />}
      {showDot && (
        <span class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emeraldGreen ring-2 ring-navDark" />
      )}
    </span>
  );
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
