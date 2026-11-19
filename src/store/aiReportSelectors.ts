import type { AiTone } from '../types';
import type { State } from '../ui/shared';
import { aiStepLabel } from './homeChartConfigs';

/** Prepara pestañas y estado derivado para el panel de Coach IA. */
export function buildAiReportViewModel(state: State) {
  const ai = state.settings.ai;
  if (!ai) return null;
  const steps = [
    {
      kind: 'summary' as const,
      label: 'Resumen',
      dot: 'bg-electricBlue',
      overallStatus: ai.overview?.overallStatus,
      summary: ai.summary,
      highlights: ai.overview?.highlights ?? [],
    },
    ...(ai.overview?.sections ?? []).map((s) => ({
      kind: 'section' as const,
      label: aiStepLabel(s.title),
      dot: s.verdict === 'good' ? 'bg-emeraldGreen' : s.verdict === 'warning' ? 'bg-coralRed' : 'bg-electricBlue',
      titleColor: s.verdict === 'good' ? 'text-emerald-300' : s.verdict === 'warning' ? 'text-rose-300' : 'text-blue-300',
      title: s.title,
      text: s.text,
    })),
  ];
  const activeIdx = Math.min(Math.max(0, state.aiTab ?? 0), steps.length - 1);
  const activeTone: AiTone = state.settings.aiTone === 'simple' ? 'simple' : 'technical';
  const reportTone: AiTone = ai.tone === 'simple' ? 'simple' : 'technical';
  return {
    ai,
    steps,
    activeIdx,
    current: steps[activeIdx],
    activeTone,
    reportTone,
    toneChanged: reportTone !== activeTone,
    coverage: [`${state.strength.length} registros de fuerza`, `${state.measures.length} medidas`, `${state.wellbeing.length} registros de recuperación`],
    limitedData: state.strength.length < 5 && state.measures.length < 2 && state.wellbeing.length < 3,
  };
}
