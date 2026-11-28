import type { AiTone } from '../../types';
import { fmtDate, type State } from '../../ui/shared';
import { Icon } from '../common/Icon';
import { AiJobStatusBanner } from '../home/AiJobStatusBanner';

interface AiPreferencesSectionProps {
  /** Estado global con preferencias IA, fecha del último informe y trabajo activo. */
  state: State;
  /** Tono activo de redacción (`simple` o `technical`). */
  tone: AiTone;
  /** Cambia el tono preferido del Coach IA. */
  onChangeTone: (tone: AiTone) => void;
  /** Lanza la generación o regeneración del informe. */
  onRunAi: () => void;
  /** Reintenta la generación tras un error. */
  onRetryAi: () => void;
  /** Descarta el aviso de error del trabajo IA. */
  onDismissAi: () => void;
  /** Oculta el encabezado `<h2>` interno cuando el contenedor ya muestra título. */
  hideTitle?: boolean;
}

const TONE_OPTIONS: { id: AiTone; title: string; desc: string }[] = [
  {
    id: 'simple',
    title: 'Sencillo y generalista',
    desc: 'Tono cercano y directo sin tecnicismos. Resume peso, progresión de fuerza y descanso en recomendaciones prácticas fáciles de aplicar.',
  },
  {
    id: 'technical',
    title: 'Técnico y detallado',
    desc: 'Análisis completo con fuerza máxima estimada (e1RM), recuperación (HRV), pulso, actividad diaria y consejos técnicos.',
  },
];

const STATUS_LOCKED_CLS = 'border-amberGold/40 bg-amberGold/10 text-amber-300';
const TONE_BTN_BASE =
  'rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue';

/**
 * Preferencias de profundidad y estado de generación del Coach IA.
 */
export function AiPreferencesSection({
  state,
  tone,
  onChangeTone,
  onRunAi,
  onRetryAi,
  onDismissAi,
  hideTitle = false,
}: AiPreferencesSectionProps) {
  const ai = state.settings.ai;
  const quota = state.user?.emailVerified ? state.aiQuota : undefined;
  const quotaExhausted = Boolean(quota && quota.remaining <= 0);

  return (
    <div class="space-y-4">
      {(!hideTitle || !state.user?.emailVerified) && (
        <div class="flex flex-wrap items-center justify-between gap-2">
          {!hideTitle ? (
            <div>
              <h2 class="font-bold text-white">Preferencias del Coach IA</h2>
              <p class="text-xs text-gray-400 mt-0.5">
                Elige con qué profundidad y vocabulario redacta tu Coach IA tus resúmenes y recomendaciones.
              </p>
            </div>
          ) : (
            <p class="text-xs text-gray-400">
              Elige con qué profundidad y vocabulario redacta tu Coach IA tus resúmenes y recomendaciones.
            </p>
          )}
          {!state.user?.emailVerified && (
            <span class={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_LOCKED_CLS}`}>
              {state.user ? 'Verifica tu correo' : 'Requiere iniciar sesión'}
            </span>
          )}
        </div>
      )}

      <div class="grid grid-cols-1 gap-3 md:grid-cols-2" role="group" aria-label="Nivel técnico de la IA">
        {TONE_OPTIONS.map((opt) => {
          const active = tone === opt.id;
          const cardCls = active
            ? 'border-electricBlue bg-electricBlue/15'
            : 'border-white/10 bg-gray-900/50 hover:border-white/25';
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={active ? 'true' : 'false'}
              class={`${TONE_BTN_BASE} ${cardCls}`}
              onClick={() => onChangeTone(opt.id)}
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-bold text-white">{opt.title}</span>
                <span
                  class={`rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? 'bg-electricBlue' : 'bg-gray-800 text-gray-400'}`}
                  style={active ? { color: 'rgb(var(--c-accent-fg))' } : undefined}
                >
                  {active ? 'Activo' : 'Seleccionar'}
                </span>
              </div>
              <p class="mt-1.5 text-xs text-gray-300 leading-relaxed">{opt.desc}</p>
            </button>
          );
        })}
      </div>

      <AiJobStatusBanner job={state.aiJob} onRetry={onRetryAi} onDismiss={onDismissAi} />

      <div class="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3 text-xs text-gray-400">
        <div class="space-y-0.5">
          {ai ? (
            <p>
              Último informe guardado: {fmtDate(ai.date)} · modo{' '}
              <span class="font-semibold text-gray-200">{ai.tone === 'simple' ? 'Sencillo' : 'Técnico'}</span>
            </p>
          ) : (
            <p>Genera resúmenes personalizados cuando registres tus entrenos.</p>
          )}
          {quota && (
            <p class={`tabular-nums ${quotaExhausted ? 'text-amberGold font-semibold' : 'text-gray-400'}`}>
              Informes hoy: {quota.used}/{quota.limit}
            </p>
          )}
        </div>
        <button type="button" class="btn-sm" disabled={state.busy === 'ai' || quotaExhausted} onClick={onRunAi}>
          <Icon name="chart" className="h-3.5 w-3.5" />{' '}
          {quotaExhausted ? 'Límite diario alcanzado' : state.busy === 'ai' ? 'Analizando…' : 'Regenerar informe IA'}
        </button>
      </div>
    </div>
  );
}
