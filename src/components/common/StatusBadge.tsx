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

const TONE_OPTIONS: ReadonlyArray<readonly [AiTone, string]> = [
  ['simple', 'Sencillo'],
  ['technical', 'Técnico'],
];

const BASE_BTN =
  'inline-flex min-h-[44px] sm:min-h-[30px] items-center rounded-lg px-2.5 py-1 font-semibold transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue';

/** Selector segmentado para elegir el nivel técnico de los informes del Coach IA. */
export function AiToneToggle({ tone, onChange }: AiToneToggleProps) {
  return (
    <div
      role="group"
      aria-label="Nivel técnico de la IA"
      class="inline-flex rounded-xl border border-white/10 bg-gray-950/60 p-1 text-xs sm:text-[11px]"
    >
      {TONE_OPTIONS.map(([value, label]) => {
        const active = tone === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active ? 'true' : 'false'}
            class={`${BASE_BTN} ${active ? 'bg-white/15 text-white shadow-sm ring-1 ring-white/10' : 'text-gray-400 hover:text-gray-200'}`}
            onClick={() => onChange(value)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
