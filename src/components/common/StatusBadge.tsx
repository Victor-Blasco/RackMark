import { STATUS_STYLE } from '../../store/homeSelectors';
import type { ExStats } from '../../lib/analysis';
import type { AiTone } from '../../types';

interface StatusInlineProps {
  /** Estadísticas del ejercicio con color y estado automático. */
  stats: ExStats;
  /** Estado resumido alternativo proveniente del Coach IA. */
  aiStatus?: string;
}

/** Muestra el semáforo de estado de progresión de un ejercicio con punto y etiqueta. */
export function StatusInline({ stats, aiStatus }: StatusInlineProps) {
  const text = aiStatus || stats.status;
  const st = STATUS_STYLE[stats.statusColor] ?? STATUS_STYLE.gray;
  return (
    <span class={`inline-flex max-w-full items-center gap-1.5 text-[13px] sm:text-sm font-semibold ${st.text}`}>
      <span class={`h-2.5 w-2.5 shrink-0 rounded-full ${st.dot}`} aria-hidden="true" />
      <span class="truncate">{text}</span>
    </span>
  );
}

interface AiToneToggleProps {
  /** Tono de análisis IA seleccionado (`simple` o `technical`). */
  tone: AiTone;
  /** Callback al alternar entre modo sencillo y técnico. */
  onChange: (tone: AiTone) => void;
}

/** Selector segmentado para elegir el nivel técnico de los informes del Coach IA. */
export function AiToneToggle({ tone, onChange }: AiToneToggleProps) {
  return (
    <div role="group" aria-label="Nivel técnico de la IA" class="inline-flex rounded-xl border border-white/10 bg-gray-900/70 p-1 text-[11px]">
      <button
        type="button"
        aria-pressed={tone === 'simple' ? 'true' : 'false'}
        class={`inline-flex min-h-[44px] sm:min-h-[30px] items-center rounded-lg px-2.5 py-1 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${tone === 'simple' ? 'bg-electricBlue text-white' : 'text-gray-400 hover:text-white'}`}
        onClick={() => onChange('simple')}
      >
        Sencillo
      </button>
      <button
        type="button"
        aria-pressed={tone === 'technical' ? 'true' : 'false'}
        class={`inline-flex min-h-[44px] sm:min-h-[30px] items-center rounded-lg px-2.5 py-1 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${tone === 'technical' ? 'bg-electricBlue text-white' : 'text-gray-400 hover:text-white'}`}
        onClick={() => onChange('technical')}
      >
        Técnico
      </button>
    </div>
  );
}
