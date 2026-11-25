import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { fs } from './firebase';

/** Máximo diario de informes del Coach IA por usuario (reinicio a las 00:00 UTC). */
export const AI_DAILY_LIMIT = 3;

export interface AiQuotaStatus {
  used: number;
  limit: number;
  remaining: number;
  dayUtc: string;
}

/** Devuelve la fecha UTC en formato `YYYY-MM-DD`. */
export function utcDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function toUtcDay(raw: unknown): string | null {
  if (raw == null) return null;
  if (raw instanceof Date) return Number.isFinite(raw.getTime()) ? utcDayKey(raw) : null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? utcDayKey(new Date(raw)) : null;
  if (typeof raw === 'object' && typeof (raw as { toDate?: unknown }).toDate === 'function') {
    const d = (raw as { toDate: () => Date }).toDate();
    return d instanceof Date && Number.isFinite(d.getTime()) ? utcDayKey(d) : null;
  }
  return null;
}

/** Calcula el estado del cupo diario a partir del documento `usage/ai` y la fecha actual. */
export function resolveAiQuota(
  docData?: { count?: unknown; updatedAt?: unknown },
  now = new Date(),
): AiQuotaStatus {
  const dayUtc = utcDayKey(now);
  const docDay = toUtcDay(docData?.updatedAt);
  const rawCount = docData?.count;
  const used =
    docDay === dayUtc && typeof rawCount === 'number' && Number.isFinite(rawCount)
      ? Math.max(0, Math.min(AI_DAILY_LIMIT, Math.trunc(rawCount)))
      : 0;
  return {
    used,
    limit: AI_DAILY_LIMIT,
    remaining: Math.max(0, AI_DAILY_LIMIT - used),
    dayUtc,
  };
}

/** Consulta el consumo diario actual de informes IA del usuario en Firestore. */
export async function fetchAiQuota(uid: string): Promise<AiQuotaStatus> {
  const snap = await getDoc(doc(fs, 'users', uid, 'usage', 'ai'));
  return resolveAiQuota(snap.exists() ? (snap.data() as { count?: unknown; updatedAt?: unknown }) : undefined);
}

/** Reserva atómicamente 1 informe de la cuota diaria en Firestore o devuelve `allowed: false`. */
export async function consumeAiQuota(uid: string): Promise<{ allowed: boolean; quota: AiQuotaStatus }> {
  const ref = doc(fs, 'users', uid, 'usage', 'ai');
  try {
    return await runTransaction(fs, async (tx) => {
      const snap = await tx.get(ref);
      const current = resolveAiQuota(snap.exists() ? (snap.data() as { count?: unknown; updatedAt?: unknown }) : undefined);
      if (current.remaining <= 0) {
        return { allowed: false, quota: current };
      }
      const nextUsed = current.used + 1;
      tx.set(ref, { count: nextUsed, updatedAt: serverTimestamp() });
      return {
        allowed: true,
        quota: {
          used: nextUsed,
          limit: AI_DAILY_LIMIT,
          remaining: Math.max(0, AI_DAILY_LIMIT - nextUsed),
          dayUtc: current.dayUtc,
        },
      };
    });
  } catch (err) {
    const code = (err as { code?: string })?.code ?? '';
    const msg = err instanceof Error ? err.message : '';
    if (code === 'permission-denied' || /permission-denied/i.test(msg)) {
      const quota = await fetchAiQuota(uid);
      if (quota.remaining === 0) return { allowed: false, quota };
    }
    throw err;
  }
}
