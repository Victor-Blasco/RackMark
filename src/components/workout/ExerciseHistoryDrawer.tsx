import { useEffect } from 'preact/hooks';
import { isWorkSet, type ExStats } from '../../lib/analysis';
import { r1, short } from '../../ui/shared';
import { Icon } from '../common/Icon';

interface ExerciseHistoryDrawerProps {
  /** Si el panel de historial rápido está abierto. */
  open: boolean;
  /** Nombre del ejercicio activo. */
  exName: string;
  /** Estadísticas e historial analizado del ejercicio. */
  hist?: ExStats;
  /** Cierra el bottom sheet / drawer lateral. */
  onClose: () => void;
}

const bestRm = (hist: ExStats | undefined, minReps: number): number | null => {
  if (!hist) return null;
  let best: number | null = null;
  for (const sess of hist.sessions) {
    for (const s of sess.sets) {
      if (isWorkSet(s) && s.r >= minReps && (best == null || s.w > best)) best = s.w;
    }
  }
  return best;
};

/**
 * Panel rápido de historial en `En vivo`: bottom sheet en móvil y drawer lateral derecho en escritorio.
 */
export function ExerciseHistoryDrawer({ open, exName, hist, onClose }: ExerciseHistoryDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const pr5 = bestRm(hist, 5);
  const pr8 = bestRm(hist, 8);
  const recent = hist ? [...hist.sessions].slice(-5).reverse() : [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Historial de ${exName}`}
      class="fixed inset-0 z-40 flex items-end lg:items-stretch lg:justify-end bg-black/60 backdrop-blur-[1px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div class="w-full max-h-[82vh] lg:max-h-none lg:h-full lg:w-[400px] overflow-y-auto rounded-t-2xl lg:rounded-none border-t lg:border-t-0 lg:border-l border-white/15 bg-modalDark p-4 sm:p-5 shadow-2xl space-y-4">
        <div class="flex items-start justify-between gap-2 border-b border-white/10 pb-3">
          <div class="min-w-0">
            <h3 class="text-base font-extrabold text-white truncate">Historial · {exName}</h3>
            <p class="text-xs text-gray-400">Mejores marcas y últimas {recent.length} sesiones</p>
          </div>
          <button type="button" aria-label="Cerrar historial" class="icon-btn shrink-0" onClick={onClose}>
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        {!hist || recent.length === 0 ? (
          <p class="text-xs text-gray-400 py-4">Aún no hay sesiones previas registradas para este ejercicio.</p>
        ) : (
          <>
            <div class="grid grid-cols-3 gap-3 border-b border-white/10 pb-3">
              <div>
                <span class="block text-[11px] text-gray-400">PR 5RM</span>
                <span class="tabular-nums text-sm font-extrabold text-white">{pr5 != null ? `${r1(pr5)} kg` : '—'}</span>
              </div>
              <div>
                <span class="block text-[11px] text-gray-400">PR 8RM</span>
                <span class="tabular-nums text-sm font-extrabold text-white">{pr8 != null ? `${r1(pr8)} kg` : '—'}</span>
              </div>
              <div>
                <span class="block text-[11px] text-gray-400" title="Máximo estimado a 1 repetición (e1RM)">e1RM máx</span>
                <span class="tabular-nums text-sm font-extrabold text-emerald-300">{r1(hist.maxE1rm)} kg</span>
              </div>
            </div>

            <div class="divide-y divide-white/10">
              {recent.map((sess) => (
                <div key={sess.date} class="py-2.5 space-y-1">
                  <div class="flex items-center justify-between gap-2 text-xs">
                    <span class="font-bold text-white">{short(sess.date)}</span>
                    <span class="tabular-nums font-semibold text-blue-300">e1RM {r1(sess.e1rm)} kg</span>
                  </div>
                  <p class="text-xs text-gray-300 tabular-nums">
                    {sess.sets.map((s) => `${s.kind && s.kind !== 'S' ? `${s.kind} ` : ''}${s.w}×${s.r}`).join(' · ')}
                  </p>
                  {sess.note && <p class="text-[11px] text-emerald-300">Nota: {sess.note}</p>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
