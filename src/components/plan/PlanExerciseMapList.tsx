import { useState } from 'preact/hooks';
import { MUSCLES } from '../../lib/seed';
import type { ExerciseMapItem } from '../../store/planSelectors';
import { Collapsible } from '../common/Collapsible';
import { Icon } from '../common/Icon';

interface PlanExerciseMapListProps {
  /** Ejercicios visibles en el editor de mapa muscular. */
  items: ExerciseMapItem[];
  /** Cambia el músculo principal de un ejercicio. */
  onChangePrimary?: (exName: string, primary: string) => void;
  /** Alterna un músculo secundario de un ejercicio en un toque. */
  onToggleSecondary?: (exName: string, muscle: string) => void;
}

const CHIP_BASE = 'inline-flex min-h-[44px] sm:min-h-[32px] items-center rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue';

/** Lista desplegable táctil por ejercicio para asignar músculo principal y secundarios mediante chips. */
export function PlanExerciseMapList({ items, onChangePrimary, onToggleSecondary }: PlanExerciseMapListProps) {
  const [expandedEx, setExpandedEx] = useState<string | null>(null);

  if (!items.length) {
    return <p class="py-4 text-center text-xs text-gray-400">Sin ejercicios que coincidan con la búsqueda.</p>;
  }

  return (
    <div class="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-8 items-start border-t border-white/10">
      {items.map((item) => {
        const open = expandedEx === item.name;
        return (
          <div key={item.name} class="border-b border-white/10">
            <button
              type="button"
              aria-expanded={open ? 'true' : 'false'}
              class="flex min-h-[56px] w-full items-start justify-between gap-3 px-1 py-3 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue rounded-lg"
              onClick={() => setExpandedEx((cur) => (cur === item.name ? null : item.name))}
            >
              <div class="min-w-0 space-y-1.5">
                <p class="text-sm font-semibold text-white leading-snug">{item.name}</p>
                <div class="flex flex-wrap items-center gap-1.5 text-[11px]">
                  {item.primary ? (
                    <span class="rounded-md border border-electricBlue/35 bg-electricBlue/15 px-2 py-0.5 font-bold text-blue-200">
                      {item.primary}
                    </span>
                  ) : (
                    <span class="rounded-md border border-amberGold/40 bg-amberGold/10 px-2 py-0.5 font-semibold text-amberGold">
                      Sin músculo principal
                    </span>
                  )}
                  {item.secondary.map((sec) => (
                    <span key={sec} class="rounded-md bg-white/[0.06] px-2 py-0.5 text-gray-300">
                      {sec}
                    </span>
                  ))}
                </div>
              </div>
              <Icon
                name="caretDown"
                className={`mt-1 h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180 text-white' : ''}`}
              />
            </button>

            <Collapsible open={open}>
              <div class="space-y-3 border-t border-white/5 px-1 pb-3.5 pt-2.5">
                <div class="space-y-1.5">
                  <span class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    Músculo principal (1 serie)
                  </span>
                  <div class="flex flex-wrap gap-1.5" role="group" aria-label={`Músculo principal de ${item.name}`}>
                    {MUSCLES.map((m) => {
                      const active = item.primary === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          aria-pressed={active ? 'true' : 'false'}
                          class={`${CHIP_BASE} ${active ? 'border-electricBlue bg-electricBlue/20 text-blue-200' : 'border-white/10 bg-gray-900/70 text-gray-300 hover:border-white/25 hover:text-white'}`}
                          onClick={() => onChangePrimary?.(item.name, m)}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div class="space-y-1.5">
                  <span class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    Músculos secundarios (0,5 series c/u)
                  </span>
                  <div class="flex flex-wrap gap-1.5" role="group" aria-label={`Músculos secundarios de ${item.name}`}>
                    {MUSCLES.map((m) => {
                      const isPrim = item.primary === m;
                      const active = !isPrim && item.secondary.includes(m);
                      return (
                        <button
                          key={m}
                          type="button"
                          disabled={isPrim}
                          aria-pressed={active ? 'true' : 'false'}
                          class={`${CHIP_BASE} ${isPrim ? 'border-white/5 bg-white/[0.02] text-gray-400 opacity-40 cursor-not-allowed' : active ? 'border-emeraldGreen/50 bg-emeraldGreen/15 text-emerald-200' : 'border-white/10 bg-gray-900/70 text-gray-300 hover:border-white/25 hover:text-white'}`}
                          onClick={() => onToggleSecondary?.(item.name, m)}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Collapsible>
          </div>
        );
      })}
    </div>
  );
}
