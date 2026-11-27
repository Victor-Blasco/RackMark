import type { PhaseAnalyticsModel } from '../../store/phaseSelectors';
import { r1 } from '../../ui/shared';

interface PhaseKpiRowProps {
  /** Modelo calculado de la fase seleccionada. */
  vm: PhaseAnalyticsModel;
}

/**
 * Fila de 4 KPIs neutros de la etapa (peso/cintura, constancia, volumen semanal y fuerza) más básicos.
 */
export function PhaseKpiRow({ vm }: PhaseKpiRowProps) {
  const maxBar = Math.max(1, ...vm.weeklyBars);
  const strColor = vm.avgStrengthPct == null
    ? 'text-white'
    : vm.avgStrengthPct > 1
      ? 'text-emerald-300'
      : vm.avgStrengthPct < -2
        ? 'text-rose-300'
        : 'text-white';
  const strSign = vm.avgStrengthPct != null && vm.avgStrengthPct > 0 ? '+' : vm.avgStrengthPct != null && vm.avgStrengthPct < 0 ? '−' : '';

  return (
    <>
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4 py-1 border-b border-white/10 pb-4">
        <div>
          <span class="block text-xs text-gray-400">Peso y cintura</span>
          <span class="tabular-nums text-xl font-extrabold text-white">{vm.weightDeltaLabel}</span>
          <span class="block text-xs text-blue-300 tabular-nums">{vm.weightSubLabel}</span>
        </div>
        <div>
          <span class="block text-xs text-gray-400">Constancia · {vm.sessionsCount} ses.</span>
          <span class="tabular-nums text-xl font-extrabold text-white">{vm.daysPerWeekLabel}</span>
          <div class="mt-1.5 h-1 w-24 rounded-full bg-white/10 overflow-hidden">
            <div class="h-full rounded-full bg-electricBlue" style={{ width: `${vm.adherencePct}%` }} />
          </div>
        </div>
        <div>
          <span class="block text-xs text-gray-400">Volumen semanal</span>
          <span class="tabular-nums text-xl font-extrabold text-white">{vm.avgWeeklySetsLabel}</span>
          <div class="mt-1.5 flex items-end gap-1 h-3.5" aria-hidden="true">
            {vm.weeklyBars.map((b, i) => (
              <span key={i} class="w-2 rounded-sm bg-electricBlue/70" style={{ height: `${Math.max(4, Math.round((b / maxBar) * 14))}px` }} />
            ))}
          </div>
        </div>
        <div>
          <span class="block text-xs text-gray-400">Fuerza en la etapa</span>
          <span class={`tabular-nums text-xl font-extrabold ${strColor}`}>
            {vm.avgStrengthPct == null ? '—' : `${strSign}${r1(Math.abs(vm.avgStrengthPct))} %`}
          </span>
          <span class="block text-xs text-gray-400 tabular-nums">
            {vm.avgStrengthPct == null ? 'Requiere ≥2 sesiones' : `${vm.upCount} suben · ${vm.stableCount} estables`}
          </span>
        </div>
      </div>

      {vm.lifts.length > 0 && (
        <div class="divide-y divide-white/10">
          {vm.lifts.map((l) => (
            <div key={l.name} class="flex items-center justify-between py-2 text-xs">
              <span class="text-gray-200">{l.name}</span>
              <span class={`tabular-nums font-bold ${l.deltaPct > 1 ? 'text-emerald-300' : l.deltaPct < -1 ? 'text-rose-300' : 'text-gray-300'}`}>{l.label}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
