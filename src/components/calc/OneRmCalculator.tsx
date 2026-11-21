import { r1 } from '../../ui/shared';

interface CalcPresetOption {
  n: string;
  w: number;
  r: number;
}

interface OneRmCalculatorProps {
  /** Indica si se están usando marcas de ejemplo por falta de entrenamientos previos. */
  usingSampleStrength: boolean;
  /** Lista de marcas recientes por ejercicio para precargar en el selector. */
  presets: CalcPresetOption[];
  /** Peso introducido en kg. */
  cW: string;
  /** Repeticiones introducidas. */
  cR: string;
  /** Repeticiones en reserva (0–5). */
  cRir: string;
  /** Estimación 1RM según fórmula Epley. */
  oneRm: number;
  /** Estimación 1RM ajustada por RIR. */
  oneRmRir: number;
  /** Ratio fuerza/peso corporal formateado. */
  ratio: string;
  /** Zonas porcentuales derivadas del 1RM estimado. */
  zones: { pctLabel: string; weightLabel: string }[];
  /** Aplica una marca preseleccionada de la lista de presets. */
  onSelectPreset: (raw: string) => void;
  /** Actualiza un campo numérico de cálculo (`w`, `r` o `rir`). */
  onUpdateField: (field: 'w' | 'r' | 'rir', val: string) => void;
}

/**
 * Calculadora interactiva de 1RM (Epley) y zonas de trabajo por porcentaje.
 */
export function OneRmCalculator({
  usingSampleStrength,
  presets,
  cW,
  cR,
  cRir,
  oneRm,
  oneRmRir,
  ratio,
  zones,
  onSelectPreset,
  onUpdateField,
}: OneRmCalculatorProps) {
  return (
    <div class="pb-5 border-b border-white/10 lg:border-b-0 lg:pb-0 lg:border-r lg:border-white/10 lg:pr-6 space-y-3">
      <div>
        <h2 class="font-bold text-white">Calculadora de fuerza máxima (1RM)</h2>
        <p class="text-xs text-gray-400 mt-0.5">
          Estima el peso máximo que podrías mover a 1 repetición y tus zonas de carga según tus series.
        </p>
        {usingSampleStrength && (
          <p class="text-xs text-amberGold mt-0.5">Valores de ejemplo (registra una sesión para cargar tus marcas)</p>
        )}
      </div>

      {!usingSampleStrength && (
        <label class="block">
          <span class="lbl">Cargar marca de tu última sesión</span>
          <select id="calcPreset" class="inp" onChange={(e) => onSelectPreset(e.currentTarget.value)}>
            {presets.map((p) => (
              <option key={`${p.n}-${p.w}-${p.r}`} value={`${p.w}|${p.r}`}>
                {p.n} ({p.w} kg × {p.r})
              </option>
            ))}
          </select>
        </label>
      )}

      <div class="grid grid-cols-3 items-stretch gap-3">
        <label class="flex h-full flex-col">
          <span class="lbl leading-4">Peso (kg)</span>
          <input id="calcW" class="inp mt-auto tabular-nums font-medium" type="number" step="0.5" inputMode="decimal" enterKeyHint="next" value={cW} onInput={(e) => onUpdateField('w', e.currentTarget.value)} />
        </label>
        <label class="flex h-full flex-col">
          <span class="lbl leading-4">Reps</span>
          <input id="calcR" class="inp mt-auto tabular-nums font-medium" type="number" min="1" max="30" inputMode="numeric" enterKeyHint="next" value={cR} onInput={(e) => onUpdateField('r', e.currentTarget.value)} />
        </label>
        <label class="flex h-full flex-col">
          <span class="lbl leading-4">Reps en reserva (RIR 0-5)</span>
          <input id="calcRir" class="inp mt-auto tabular-nums font-medium" type="number" min="0" max="5" inputMode="numeric" enterKeyHint="done" value={cRir} onInput={(e) => onUpdateField('rir', e.currentTarget.value)} />
        </label>
      </div>

      <div id="calcOut" class="grid grid-cols-3 divide-x divide-white/10 border-t border-b border-white/10 py-3 text-center">
        <div class="px-2">
          <span class="block text-[11px] text-gray-400">1RM (Epley)</span>
          <span class="tabular-nums text-lg sm:text-xl font-extrabold text-electricBlue">{r1(oneRm)} kg</span>
        </div>
        <div class="px-2">
          <span class="block text-[11px] text-gray-400">1RM ajustado RIR</span>
          <span class="tabular-nums text-lg sm:text-xl font-extrabold text-emeraldGreen">{r1(oneRmRir)} kg</span>
        </div>
        <div class="px-2">
          <span class="block text-[11px] text-gray-400">Ratio / peso</span>
          <span class="tabular-nums text-lg sm:text-xl font-extrabold text-amberGold">{ratio}×</span>
        </div>
      </div>

      <div id="calcZones" class="grid grid-cols-2 gap-x-4 gap-y-2 border-b border-white/10 pb-3 text-sm tabular-nums sm:grid-cols-4 sm:gap-0 sm:divide-x sm:divide-white/10 sm:text-center">
        {zones.map((z) => (
          <div key={z.pctLabel} class="py-1 sm:px-2">
            <span class="block text-[11px] text-gray-400">{z.pctLabel}</span>
            <b class="text-white">{z.weightLabel}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
