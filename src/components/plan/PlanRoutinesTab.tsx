import { useState } from 'preact/hooks';
import { ROUTINE_TEMPLATES, norm } from '../../lib/seed';
import type { PlanActions } from '../../store/planActions';
import { routineColor, routineNames, type State } from '../../ui/shared';
import { Collapsible } from '../common/Collapsible';
import { Icon } from '../common/Icon';
import { PlanSidebarWidgets } from './PlanSidebarWidgets';

interface PlanRoutinesTabProps {
  /** Estado global con rutinas y catálogo. */
  state: State;
  /** Acciones tipadas de planificación. */
  actions: PlanActions;
  /** Navega al detalle de progreso de una rutina concreta. */
  onOpenRoutineTab: (day: string) => void;
}

/** Editor enfocado en una rutina a la vez con plantillas plegables y barra lateral de volumen. */
export function PlanRoutinesTab({ state, actions, onOpenRoutineTab }: PlanRoutinesTabProps) {
  const [tplOpen, setTplOpen] = useState(false);
  const s = state.settings;
  const routines = routineNames(s);
  const activeRoutine = state.planRoutine && routines.includes(state.planRoutine) ? state.planRoutine : (routines[0] ?? '');
  const activeIdx = Math.max(0, routines.indexOf(activeRoutine));
  const col = activeRoutine ? routineColor(activeRoutine, s, activeIdx) : '#3B82F6';
  const sub = activeRoutine ? s.routineMeta?.[activeRoutine]?.sub : undefined;
  const list = activeRoutine ? (s.routines[activeRoutine] ?? []) : [];

  return (
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
      <div class="lg:col-span-8 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-base font-bold text-white">Editor de rutinas</h2>
            <p class="text-xs text-gray-400">Edita ejercicios y objetivos (series × reps) de una rutina a la vez.</p>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" class="btn-sm" aria-expanded={tplOpen} aria-controls="plan-templates-panel" onClick={() => setTplOpen((v) => !v)}>
              <span>Plantillas</span>
              <Icon name="caretDown" className={`h-3.5 w-3.5 transition-transform duration-200 motion-reduce:transition-none ${tplOpen ? 'rotate-180' : ''}`} />
            </button>
            <button type="button" class="btn-primary-sm" onClick={actions.openRoutineModalNew}>+ Nueva rutina</button>
          </div>
        </div>

        <Collapsible open={tplOpen}>
          <div id="plan-templates-panel" class="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
            <span class="font-semibold text-gray-400">Aplicar plantilla:</span>
            {Object.entries(ROUTINE_TEMPLATES).map(([k, tpl]) => (
              <button key={k} type="button" title={tpl.desc} class="inline-flex min-h-[44px] sm:min-h-[34px] items-center rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1 font-medium text-gray-300 hover:border-electricBlue/50 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" onClick={() => void actions.applyTemplate(k)}>
                {tpl.label}
              </button>
            ))}
          </div>
        </Collapsible>

        <div role="tablist" aria-label="Rutina a editar" class="flex gap-1 overflow-x-auto no-scrollbar rounded-xl border border-borderDark/80 bg-navDark p-1">
          {routines.map((d, idx) => {
            const active = d === activeRoutine;
            const count = (s.routines[d] ?? []).length;
            return (
              <button key={d} type="button" role="tab" aria-selected={active} class={`flex min-h-[44px] sm:min-h-[38px] flex-1 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${active ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`} onClick={() => actions.setPlanRoutine(d)}>
                <span class="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: routineColor(d, s, idx) }} aria-hidden="true" />
                <span class="truncate">{d}</span>
                <span class="tabular-nums text-[11px] font-semibold text-gray-400">({count})</span>
              </button>
            );
          })}
        </div>

        {activeRoutine && (
          <div key={activeRoutine} id={`plan-routine-${norm(activeRoutine)}`} class="border-b border-white/10 pb-4 scroll-mt-4">
            <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 class="flex items-center gap-2 text-sm font-bold min-w-0" style={{ color: col }}>
                <span class="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: col }} aria-hidden="true" />
                <span class="truncate">{activeRoutine}</span>
                {sub && <span class="text-xs font-normal text-gray-400 truncate">· {sub}</span>}
              </h3>
              <div class="flex items-center gap-1">
                <button type="button" class="inline-flex min-h-[44px] sm:min-h-[34px] items-center rounded-lg px-2.5 text-xs font-semibold text-gray-300 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" onClick={() => onOpenRoutineTab(activeRoutine)}>Ver progreso →</button>
                <button type="button" class="icon-btn" aria-label={`Editar rutina ${activeRoutine}`} onClick={() => actions.openRoutineModalEdit(activeRoutine)}><Icon name="edit" className="h-3.5 w-3.5" /></button>
                <button type="button" class="icon-btn text-coralRed hover:bg-coralRed/10" disabled={routines.length <= 1} aria-label={`Eliminar rutina ${activeRoutine}`} onClick={() => void actions.removeRoutineDay(activeRoutine)}><Icon name="trash" className="h-3.5 w-3.5" /></button>
              </div>
            </div>

            {list.length === 0 ? (
              <p class="rounded-xl border border-dashed border-white/10 px-3 py-4 text-xs text-gray-400">Esta rutina aún no tiene ejercicios. Pulsa «+ Añadir ejercicio» para buscar en tu catálogo o crear uno nuevo.</p>
            ) : (
              <div data-sort-list={`rt:${activeRoutine}`} class="space-y-1.5">
                {list.map((r, i) => {
                  const exLbl = r.name || `ejercicio ${i + 1}`;
                  return (
                    <div key={`${activeRoutine}-${i}-${r.name}`} data-sort-item data-sort-idx={i} class="flex min-w-0 flex-col sm:flex-row sm:items-center gap-1.5 rounded-xl bg-white/[0.02] p-1.5 sm:px-1.5 sm:py-1 transition-shadow">
                      <div class="grid w-full min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] items-center gap-1.5">
                        <button type="button" data-sort-handle class="icon-btn rounded-md touch-none cursor-grab active:cursor-grabbing select-none" aria-label={`Arrastrar ${exLbl} en ${activeRoutine}`} title="Arrastrar para reordenar"><Icon name="grip" className="h-3.5 w-3.5" /></button>
                        <button
                          type="button"
                          class="inp flex min-w-0 max-w-full items-center justify-between gap-2 rounded-md text-left"
                          aria-label={`Cambiar ejercicio ${i + 1} de ${activeRoutine}: ${exLbl}`}
                          onClick={() => actions.openRoutineExercisePicker(activeRoutine, i)}
                        >
                          <span class={`truncate ${r.name ? 'text-white' : 'text-gray-400'}`}>{r.name || 'Elegir ejercicio…'}</span>
                          <Icon name="caretDown" className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        </button>
                      </div>
                      <div class="flex shrink-0 items-center justify-end gap-1 pl-6 sm:pl-0">
                        <input class="inp w-12 rounded-md px-1.5 text-center font-semibold tabular-nums" type="number" inputMode="numeric" enterKeyHint="done" min="1" value={r.sets} aria-label={`Series objetivo de ${exLbl}`} onChange={(e) => void actions.changeRoutineExSets(activeRoutine, i, e.currentTarget.value)} />
                        <span class="text-gray-400" aria-hidden="true">×</span>
                        <input class="inp w-12 rounded-md px-1.5 text-center font-semibold tabular-nums" type="number" inputMode="numeric" enterKeyHint="done" min="1" value={r.reps} aria-label={`Repeticiones objetivo de ${exLbl}`} onChange={(e) => void actions.changeRoutineExReps(activeRoutine, i, e.currentTarget.value)} />
                        <div class="flex shrink-0 items-center">
                          <button type="button" class="icon-btn rounded-md" disabled={i === 0} aria-label={`Subir ${exLbl} en ${activeRoutine}`} title="Subir" onClick={() => void actions.moveRoutineRow(activeRoutine, i, -1)}><Icon name="caretUp" className="h-3.5 w-3.5" /></button>
                          <button type="button" class="icon-btn rounded-md" disabled={i === list.length - 1} aria-label={`Bajar ${exLbl} en ${activeRoutine}`} title="Bajar" onClick={() => void actions.moveRoutineRow(activeRoutine, i, 1)}><Icon name="caretDown" className="h-3.5 w-3.5" /></button>
                          <button type="button" class="icon-btn rounded-md text-coralRed hover:bg-coralRed/10" aria-label={`Eliminar ${exLbl} de ${activeRoutine}`} onClick={() => void actions.deleteRoutineRow(activeRoutine, i)}><Icon name="close" className="h-4 w-4" /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div class="mt-3">
              <button type="button" class="btn-sm btn-accent" onClick={() => actions.openRoutineExercisePicker(activeRoutine)}>+ Añadir ejercicio</button>
            </div>
          </div>
        )}
      </div>

      <PlanSidebarWidgets state={state} />
    </div>
  );
}
