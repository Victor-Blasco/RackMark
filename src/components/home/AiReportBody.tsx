import type { buildAiReportViewModel } from '../../store/homeSelectors';

type AiReportVm = NonNullable<ReturnType<typeof buildAiReportViewModel>>;

interface AiReportBodyProps {
  /** Paso/pestaña actualmente visible en el informe IA. */
  current: AiReportVm['current'];
  /** Clase de color para el estado general del resumen. */
  statusToneCls: string;
  /** Atributos ARIA del panel cuando hay múltiples pestañas. */
  tabPanelAttrs?: Record<string, string>;
}

/** Cuerpo tabular del informe IA: vista resumen en dos columnas o sección temática individual. */
export function AiReportBody({ current, statusToneCls, tabPanelAttrs }: AiReportBodyProps) {
  return (
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
  );
}
