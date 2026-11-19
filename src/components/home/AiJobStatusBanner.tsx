import type { AiJob } from '../../types';
import { Icon } from '../common/Icon';

interface AiJobStatusBannerProps {
  /** Estado persistente del trabajo en curso o con error del Coach IA. */
  job?: AiJob;
  /** Reintenta la generación tras un fallo. */
  onRetry?: () => void;
  /** Descarta el aviso de error. */
  onDismiss?: () => void;
}

/** Banner de progreso o error durante la generación del informe de Coach IA. */
export function AiJobStatusBanner({ job, onRetry, onDismiss }: AiJobStatusBannerProps) {
  if (!job || job.status === 'completed') return null;
  if (job.status === 'error') {
    return (
      <div role="alert" class="space-y-2 rounded-xl border border-coralRed/40 bg-coralRed/10 px-3 py-2.5 text-sm">
        <p class="font-semibold text-rose-200">No se pudo generar el informe.</p>
        <p class="text-gray-300">{job.error ?? 'Se produjo un error inesperado.'}</p>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn-sm min-h-[44px] sm:min-h-[36px]" onClick={onRetry}>
            <Icon name="refresh" className="h-3.5 w-3.5" /> Reintentar
          </button>
          <button type="button" class="btn-sm min-h-[44px] sm:min-h-[36px]" onClick={onDismiss}>
            Descartar aviso
          </button>
        </div>
      </div>
    );
  }
  return (
    <div role="status" aria-live="polite" class="rounded-xl border border-electricBlue/30 bg-electricBlue/10 px-3 py-2.5 text-sm text-blue-100">
      {job.attempts > 1 ? 'Reintentando generación tras recuperar la sesión…' : 'Generando informe…'}
    </div>
  );
}
