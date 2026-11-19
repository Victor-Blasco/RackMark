import type { AiSection } from '../../types';
import { findAiSection, short, type State } from '../../ui/shared';

interface AiInsightBannerProps {
  /** Estado global con el informe de Coach IA guardado. */
  state: State;
  /** Expresión regular que identifica la sección relevante del informe. */
  pattern: RegExp;
}

const VERDICT_STYLES: Record<AiSection['verdict'], { border: string; title: string }> = {
  warning: { border: 'border-coralRed', title: 'text-rose-300' },
  good: { border: 'border-emeraldGreen', title: 'text-emerald-300' },
  neutral: { border: 'border-electricBlue', title: 'text-blue-300' },
};

/**
 * Muestra la tarjeta contextual del último análisis del Coach IA si coincide con `pattern`.
 */
export function AiInsightBanner({ state, pattern }: AiInsightBannerProps) {
  const sec = findAiSection(state, pattern);
  const aiDate = state.settings.ai?.date;
  if (!sec || !aiDate) return null;

  const styles = VERDICT_STYLES[sec.verdict];

  return (
    <section aria-label={sec.title} class={`border-l-2 ${styles.border} pl-4 py-1 space-y-1 max-w-prose`}>
      <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
        <span class={`font-bold ${styles.title}`}>{sec.title}</span>
        <span class="text-gray-400 tabular-nums">· Análisis IA ({short(aiDate)})</span>
      </div>
      <p class="text-xs sm:text-sm text-gray-200 leading-relaxed">{sec.text}</p>
    </section>
  );
}

interface NoDataCardProps {
  /** Navega al registro manual de sesiones. */
  onGoLog: () => void;
  /** Navega a la pestaña de importación de datos. */
  onImportData: () => void;
}

/**
 * Tarjeta de estado vacío accionable cuando todavía no existen sesiones de fuerza.
 */
export function NoDataCard({ onGoLog, onImportData }: NoDataCardProps) {
  return (
    <div class="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-gray-300">
      <p>Aún no hay entrenamientos guardados. Registra tu primera sesión o importa tus datos previos.</p>
      <div class="flex shrink-0 flex-wrap gap-2">
        <button type="button" class="btn-primary-sm" onClick={onGoLog}>
          + Registrar entreno
        </button>
        <button type="button" class="btn-sm" onClick={onImportData}>
          Importar datos
        </button>
      </div>
    </div>
  );
}
