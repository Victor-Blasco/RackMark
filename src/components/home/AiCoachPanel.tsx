import { buildAiReportViewModel } from '../../store/homeSelectors';
import type { AiJob, AiTone } from '../../types';
import { fmtDate, type State } from '../../ui/shared';
import { Icon } from '../common/Icon';
import { AiToneToggle } from '../common/StatusBadge';

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
          <button type="button" class="btn-sm min-h-[44px] sm:min-h-[36px]" data-act="aiRetry" onClick={onRetry}>
            <Icon name="refresh" className="h-3.5 w-3.5" /> Reintentar
          </button>
          <button type="button" class="btn-sm min-h-[44px] sm:min-h-[36px]" data-act="aiDismiss" onClick={onDismiss}>
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

interface AiCoachPanelProps {
  /** Estado global con informe guardado y trabajo activo. */
  state: State;
  /** Tono técnico seleccionado para la próxima generación. */
  tone: AiTone;
  /** Cambia entre modo sencillo y técnico. */
  onToneChange?: (tone: AiTone) => void;
  /** Cambia la pestaña activa dentro del informe IA. */
  onSelectTab?: (idx: number) => void;
  /** Dispara una nueva generación o actualización del análisis. */
  onGenerate?: () => void;
  /** Reintenta la generación fallida. */
  onRetry?: () => void;
  /** Descarta el error del trabajo IA. */
  onDismiss?: () => void;
}

/** Panel de informe del Coach IA con pestañas por área o llamada inicial a generar. */
export function AiCoachPanel({
  state,
  tone,
  onToneChange = () => {},
  onSelectTab = () => {},
  onGenerate = () => {},
  onRetry,
  onDismiss,
}: AiCoachPanelProps) {
  const vm = buildAiReportViewModel(state);

  if (!vm) {
    return (
      <section id="ai-report" aria-label="Informe de IA" class="rounded-2xl border border-borderDark bg-cardDark p-4 sm:p-5 space-y-3.5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-base font-extrabold text-white">Informe IA</h2>
            <p class="text-xs text-gray-400">Resumen personalizado de tus cargas y recuperación.</p>
          </div>
          <AiToneToggle tone={tone} onChange={onToneChange} />
        </div>
        <AiJobStatusBanner job={state.aiJob} onRetry={onRetry} onDismiss={onDismiss} />
        <button type="button" class="btn-primary w-full text-xs sm:text-sm" data-act="ai" disabled={state.busy === 'ai'} onClick={onGenerate}>
          <Icon name="chart" className="h-3.5 w-3.5" /> {state.busy === 'ai' ? 'Analizando…' : 'Generar análisis IA'}
        </button>
      </section>
    );
  }

  const { ai, steps, activeIdx, current, activeTone, reportTone, toneChanged, coverage, limitedData } = vm;
  const tabPanelAttrs = steps.length > 1
    ? { id: 'ai-tabpanel', role: 'tabpanel' as const, 'aria-labelledby': `ai-tab-${activeIdx}` }
    : {};

  return (
    <section id="ai-report" aria-label="Informe de IA" class="rounded-2xl border border-borderDark bg-cardDark p-4 sm:p-5 space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 class="text-base sm:text-lg font-extrabold text-white">Informe IA</h2>
          <p class="text-xs text-gray-400">
            Actualizado el {fmtDate(ai.date)} · modo {reportTone === 'simple' ? 'Sencillo' : 'Técnico'}
            {toneChanged && <span class="text-amberGold"> (cambiado a {activeTone === 'simple' ? 'Sencillo' : 'Técnico'} · pulsa Actualizar)</span>}
          </p>
          <p class="mt-1 text-xs text-gray-400">Datos analizados: {coverage.join(' · ')}</p>
          {limitedData && <p class="mt-1 text-xs text-amber-200">Confianza limitada: añade más registros para obtener tendencias más fiables.</p>}
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <AiToneToggle tone={activeTone} onChange={onToneChange} />
          <button type="button" class="btn-sm" data-act="ai" disabled={state.busy === 'ai'} onClick={onGenerate}>
            <Icon name="refresh" className="h-3.5 w-3.5" /> {state.busy === 'ai' ? 'Analizando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      <AiJobStatusBanner job={state.aiJob} onRetry={onRetry} onDismiss={onDismiss} />

      {steps.length > 1 && (
        <div role="tablist" aria-label="Secciones del informe IA" class="flex flex-wrap gap-1.5">
          {steps.map((st, idx) => (
            <button
              key={st.label}
              id={`ai-tab-${idx}`}
              type="button"
              role="tab"
              aria-selected={idx === activeIdx ? 'true' : 'false'}
              aria-controls="ai-tabpanel"
              tabIndex={idx === activeIdx ? 0 : -1}
              data-act="aiTab"
              data-arg={String(idx)}
              class={`tab whitespace-nowrap min-h-[44px] sm:min-h-[36px] px-3 py-1.5 text-xs sm:text-sm inline-flex items-center gap-2 ${idx === activeIdx ? 'tab-on' : ''}`}
              onClick={() => onSelectTab(idx)}
            >
              <span class={`h-1.5 w-1.5 rounded-full ${st.dot}`} aria-hidden="true" />
              <span>{st.label}</span>
            </button>
          ))}
        </div>
      )}

      <div {...tabPanelAttrs} class="space-y-3 pt-1">
        {current.kind === 'summary' ? (
          <div class={`grid grid-cols-1 gap-4 ${current.highlights.length ? 'lg:grid-cols-12 lg:items-start' : ''}`}>
            <div class={`space-y-2 ${current.highlights.length ? 'lg:col-span-5' : ''}`}>
              {current.overallStatus && <p class="text-sm sm:text-[15px] font-semibold text-emerald-400">{current.overallStatus}</p>}
              {current.summary && <p class="text-sm sm:text-[15px] text-gray-100 leading-relaxed">{current.summary}</p>}
            </div>
            {current.highlights.length > 0 && (
              <ul class="border-t border-white/10 pt-3 space-y-2 lg:col-span-7 lg:border-t-0 lg:border-l lg:border-white/10 lg:pt-0 lg:pl-6">
                {current.highlights.map((h, i) => (
                  <li key={i} class="flex items-start gap-2.5 text-xs sm:text-sm text-gray-300 leading-relaxed">
                    <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-electricBlue" aria-hidden="true" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <>
            <h3 class={`text-base sm:text-lg font-bold ${current.titleColor}`}>{current.title}</h3>
            <p class="text-[15px] sm:text-base text-gray-200 leading-7">{current.text}</p>
          </>
        )}
      </div>
    </section>
  );
}
