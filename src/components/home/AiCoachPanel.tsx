import { buildAiReportViewModel } from '../../store/homeSelectors';
import type { AiTone } from '../../types';
import { fmtDate, type State } from '../../ui/shared';
import { Icon } from '../common/Icon';
import { AiToneToggle } from '../common/StatusBadge';
import { AiJobStatusBanner } from './AiJobStatusBanner';

export { AiJobStatusBanner };

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
  /** Inicia sesión con Google para habilitar la generación IA. */
  onCloudLogin?: () => void;
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
  onCloudLogin = () => {},
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
        {!state.user ? (
          <button type="button" class="btn btn-accent w-full text-xs sm:text-sm" disabled={state.syncing} onClick={onCloudLogin}>
            <Icon name="login" className="h-3.5 w-3.5" /> Inicia sesión con Google para generar análisis IA
          </button>
        ) : (
          <button type="button" class="btn btn-accent w-full text-xs sm:text-sm" disabled={state.busy === 'ai'} onClick={onGenerate}>
            <Icon name="chart" className="h-3.5 w-3.5" /> {state.busy === 'ai' ? 'Analizando…' : 'Generar análisis IA'}
          </button>
        )}
      </section>
    );
  }

  const { ai, steps, activeIdx, current, activeTone, reportTone, toneChanged, coverage, limitedData } = vm;
  const sections = ai.overview?.sections ?? [];
  const hasWarning = sections.some((s) => s.verdict === 'warning');
  const allGood = sections.length > 0 && sections.every((s) => s.verdict === 'good');
  const statusToneCls = hasWarning ? 'text-amber-200' : allGood ? 'text-emerald-300' : 'text-white';

  const tabPanelAttrs = steps.length > 1
    ? { id: 'ai-tabpanel', role: 'tabpanel' as const, 'aria-labelledby': `ai-tab-${activeIdx}` }
    : {};

  const handleTabKeyDown = (e: KeyboardEvent, idx: number) => {
    let next = idx;
    if (e.key === 'ArrowRight') next = (idx + 1) % steps.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + steps.length) % steps.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = steps.length - 1;
    else return;

    e.preventDefault();
    onSelectTab(next);
    const tabs = (e.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs?.[next]?.focus();
  };

  return (
    <section id="ai-report" aria-label="Informe de IA" class="rounded-2xl border border-borderDark bg-cardDark p-4 sm:p-5 space-y-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 class="text-base sm:text-lg font-extrabold text-white">Informe IA</h2>
          <p class="text-xs text-gray-400">
            Actualizado el {fmtDate(ai.date)} · modo {reportTone === 'simple' ? 'Sencillo' : 'Técnico'}
            {toneChanged && <span class="text-amberGold"> · modo cambiado, pulsa Actualizar</span>}
          </p>
          <p class="mt-0.5 text-[11px] text-gray-400">{coverage.join(' · ')}</p>
          {limitedData && <p class="mt-1 text-xs text-amber-200">Confianza limitada: añade más registros para tendencias más fiables.</p>}
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <AiToneToggle tone={activeTone} onChange={onToneChange} />
          <button
            type="button"
            class={`btn-sm ${toneChanged ? 'border-amberGold/60 bg-amberGold/15 text-amber-200 hover:bg-amberGold/25' : ''}`}
            disabled={state.busy === 'ai'}
            onClick={onGenerate}
          >
            <Icon name="refresh" className="h-3.5 w-3.5" /> {state.busy === 'ai' ? 'Analizando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      <AiJobStatusBanner job={state.aiJob} onRetry={onRetry} onDismiss={onDismiss} />

      {steps.length > 1 && (
        <div role="tablist" aria-label="Secciones del informe IA" class="flex flex-nowrap sm:flex-wrap overflow-x-auto gap-1.5 pb-0.5">
          {steps.map((st, idx) => (
            <button
              key={`${idx}-${st.label}`}
              id={`ai-tab-${idx}`}
              type="button"
              role="tab"
              aria-selected={idx === activeIdx ? 'true' : 'false'}
              aria-controls="ai-tabpanel"
              tabIndex={idx === activeIdx ? 0 : -1}
              class={`tab shrink-0 whitespace-nowrap min-h-[44px] sm:min-h-[36px] px-3 py-1.5 text-xs sm:text-sm inline-flex items-center gap-2 ${idx === activeIdx ? 'tab-on' : ''}`}
              onClick={() => onSelectTab(idx)}
              onKeyDown={(e) => handleTabKeyDown(e, idx)}
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
              {current.overallStatus && <p class={`text-sm sm:text-[15px] font-semibold ${statusToneCls}`}>{current.overallStatus}</p>}
              {current.summary && <p class="max-w-prose text-sm sm:text-[15px] text-gray-100 leading-relaxed">{current.summary}</p>}
            </div>
            {current.highlights.length > 0 && (
              <ul class="border-t border-white/10 pt-3 space-y-2 lg:col-span-7 lg:border-t-0 lg:border-l lg:border-white/10 lg:pt-0 lg:pl-6">
                {current.highlights.map((h, i) => (
                  <li key={i} class="flex items-start gap-2.5 text-xs sm:text-sm text-gray-300 leading-relaxed">
                    <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-electricBlue" aria-hidden="true" />
                    <span class="max-w-prose">{h}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <>
            <h3 class={`text-base sm:text-lg font-bold ${current.titleColor}`}>{current.title}</h3>
            <p class="max-w-prose text-[15px] sm:text-base text-gray-200 leading-7">{current.text}</p>
          </>
        )}
      </div>
    </section>
  );
}
