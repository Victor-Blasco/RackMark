import type { DayName, LogDraft, SetRec } from '../types';
import { manualSessionId } from './exerciseCatalog';
import type { ConfirmModalOpts } from './types';

/** Comprueba si una serie tiene check marcado y al menos 1 repetición válida. */
export const isCompletedSet = (s: SetRec): boolean => Boolean(s.done && s.r > 0);

/** Parsea y acota un entero opcional (`0..max`); devuelve `undefined` si el campo está vacío. */
export function clampOptionalInt(raw: string, max: number, min = 0): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return Math.min(max, Math.max(min, Math.round(Number(trimmed) || 0)));
}

/** Solicita confirmación si el borrador histórico tiene cambios sin guardar y se va a cambiar de sesión. */
export async function confirmSwitchLogDraft(
  cur: LogDraft | undefined,
  nextDay: DayName | 'Libre',
  nextDate: string,
  askConfirm: (opts: ConfirmModalOpts) => Promise<boolean>,
  nextSessionId?: string,
): Promise<boolean> {
  if (!cur?.dirty) return true;
  const targetSid = nextSessionId ?? manualSessionId(nextDate, nextDay);
  const curSid = cur.sessionId ?? manualSessionId(cur.date, cur.day);
  if (cur.day === nextDay && cur.date === nextDate && curSid === targetSid) return true;
  return askConfirm({
    title: 'Cambiar de sesión sin guardar',
    message: 'Tienes series o cambios sin guardar en el entrenamiento actual. Si cambias ahora se descartarán.',
    confirmLabel: 'Descartar cambios',
    danger: true,
  });
}
