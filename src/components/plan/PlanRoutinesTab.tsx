import { useRef } from 'preact/hooks';
import { ROUTINE_TEMPLATES } from '../../lib/seed';
import type { PlanActions } from '../../store/planActions';
import { fmtDate, routineColor, routineNames, type State } from '../../ui/shared';
import { Icon } from '../common/Icon';
import { PlanSidebarWidgets } from './PlanSidebarWidgets';

interface PlanRoutinesTabProps {
  /** Estado global con rutinas, fases y catálogo. */
  state: State;
  /** Lista ordenada de todos los nombres de ejercicio conocidos. */
  allNames: string[];
  /** Acciones tipadas de planificación. */
  actions: PlanActions;
  /** Navega al detalle de una rutina concreta. */
  onOpenRoutineTab: (day: string) => void;
}

/**
 * Pestaña principal de `Plan y rutinas`: edición de días, plantillas, fases y simulador.
 */
export function PlanRoutinesTab({ state, allNames, actions, onOpenRoutineTab }: PlanRoutinesTabProps) {
  const s = state.settings;
  const routines = routineNames(s);
  const phaseNameRef = useRef<HTMLInputElement>(null);
  const phaseStartRef = useRef<HTMLInputElement>(null);

  return (
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
      <div class="lg:col-span-8 space-y-6">
        <div class="space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 class="font-bold text-white">Rutinas y objetivos (series × reps)</h3>
              <p class="text-xs text-gray-400">Define tus días de entrenamiento y objetivos, o aplica una plantilla rápida.</p>
            </div>
            <button type="button" class="btn-primary-sm" data-act="rtModalNew" onClick={actions.openRoutineModalNew}>+ Nueva rutina</button>
          </div>

          <div class="flex flex-wrap items-center gap-1.5 text-xs">
            <span class="font-semibold text-gray-400">Plantillas rápidas:</span>
            {Object.entries(ROUTINE_TEMPLATES).map(([k, tpl]) => (
              <button key={k} type="button" data-act="rtApplyTpl" data-arg={k} title={tpl.desc} class="inline-flex min-h-[44px] sm:min-h-[34px] items-center rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1 font-medium text-gray-300 hover:border-electricBlue/50 hover:text-white transition-colors" onClick={() => void actions.applyTemplate(k)}>
                {tpl.label}
              </button>
            ))}
          </div>

          <div class="grid grid-cols-1 gap-4">
            {routines.map((d, idx) => {
              const col = routineColor(d, s, idx);
              const sub = s.routineMeta?.[d]?.sub;
              const list = s.routines[d] ?? [];
              return (
                <div key={d} class="border-b border-white/10 pb-4">
                  <div class="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                    <h4 class="flex items-center gap-2 text-sm font-bold min-w-0" style={{ color: col }}>
                      <span class="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: col }} aria-hidden="true" />
                      <span class="truncate">{d}</span>
                      {sub && <span class="text-xs font-normal text-gray-400 truncate">· {sub}</span>}
                    </h4>
                    <div class="flex items-center gap-1">
                      <button type="button" class="inline-flex min-h-[44px] sm:min-h-[34px] items-center rounded-lg px-2.5 text-xs font-semibold text-gray-300 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" data-act="tab" data-arg={d} onClick={() => onOpenRoutineTab(d)}>
                        Detalle →
                      </button>
                      <button type="button" class="icon-btn" data-act="rtModalEdit" data-arg={d} aria-label={`Editar rutina ${d}`} onClick={() => actions.openRoutineModalEdit(d)}>
                        <Icon name="edit" className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" class="icon-btn text-coralRed hover:bg-coralRed/10" data-act="rtRemoveDay" data-arg={d} disabled={routines.length <= 1} aria-label={`Eliminar rutina ${d}`} onClick={() => void actions.removeRoutineDay(d)}>
                        <Icon name="trash" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div data-sort-list={`rt:${d}`} class="space-y-1.5">
                    {list.map((r, i) => {
                      const opts = [...new Set([...allNames, r.name].filter(Boolean))];
                      const exLbl = r.name || `ejercicio ${i + 1}`;
                      return (
                        <div key={`${i}-${r.name}`} data-sort-item data-sort-idx={i} class="flex flex-col sm:flex-row sm:items-center gap-1.5 rounded-xl bg-white/[0.02] p-1.5 sm:px-1.5 sm:py-1 transition-shadow">
                          <div class="flex min-w-0 flex-1 items-center gap-1.5">
                            <button type="button" data-sort-handle class="icon-btn touch-none cursor-grab active:cursor-grabbing select-none" aria-label={`Arrastrar ${exLbl} en ${d}`} title="Arrastrar para reordenar">
                              <Icon name="grip" className="h-3.5 w-3.5" />
                            </button>
                            <select class="inp min-w-0 flex-1" data-change="rtName" data-arg={`${d}|${i}`} aria-label={`Ejercicio ${i + 1} de ${d}`} value={r.name} onChange={(e) => void actions.changeRoutineExName(d, i, e.currentTarget.value)}>
                              <option value="" selected={!r.name}>—</option>
                              {opts.map((o) => <option key={o} value={o} selected={o === r.name}>{o}</option>)}
                              <option value="__new__">+ Crear nuevo ejercicio…</option>
                            </select>
                          </div>
                          <div class="flex shrink-0 items-center justify-end gap-1 pl-6 sm:pl-0">
                            <input class="inp w-12 px-1.5 text-center font-semibold tabular-nums" type="number" min="1" value={r.sets} data-change="rtSets" data-arg={`${d}|${i}`} aria-label={`Series objetivo de ${exLbl}`} onChange={(e) => void actions.changeRoutineExSets(d, i, e.currentTarget.value)} />
                            <span class="text-gray-400" aria-hidden="true">×</span>
                            <input class="inp w-12 px-1.5 text-center font-semibold tabular-nums" type="number" min="1" value={r.reps} data-change="rtReps" data-arg={`${d}|${i}`} aria-label={`Repeticiones objetivo de ${exLbl}`} onChange={(e) => void actions.changeRoutineExReps(d, i, e.currentTarget.value)} />
                            <div class="flex shrink-0 items-center">
                              <button type="button" class="icon-btn" data-act="rtMove" data-arg={`${d}|${i}|-1`} disabled={i === 0} aria-label={`Subir ${exLbl} en ${d}`} title="Subir" onClick={() => void actions.moveRoutineRow(d, i, -1)}>
                                <Icon name="caretUp" className="h-3.5 w-3.5" />
                              </button>
                              <button type="button" class="icon-btn" data-act="rtMove" data-arg={`${d}|${i}|1`} disabled={i === list.length - 1} aria-label={`Bajar ${exLbl} en ${d}`} title="Bajar" onClick={() => void actions.moveRoutineRow(d, i, 1)}>
                                <Icon name="caretDown" className="h-3.5 w-3.5" />
                              </button>
                              <button type="button" class="icon-btn text-coralRed hover:bg-coralRed/10" data-act="rtDel" data-arg={`${d}|${i}`} aria-label={`Eliminar ${exLbl} de ${d}`} onClick={() => void actions.deleteRoutineRow(d, i)}>
                                <Icon name="close" className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div class="mt-2.5 flex flex-wrap gap-2">
                    <button type="button" class="btn-sm" data-act="rtAdd" data-arg={d} onClick={() => void actions.addRoutineRow(d)}>+ Añadir fila</button>
                    <button type="button" class="btn-sm btn-accent" data-act="openExModal" data-arg={d} onClick={() => actions.openExerciseModal({ routine: d })}>+ Crear ejercicio</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div class="pt-5 border-t border-white/10 space-y-3">
          <div>
            <h3 class="font-bold text-white">Fases nutricionales y de entrenamiento</h3>
            <p class="text-xs text-gray-400">Permite contextualizar la evolución del peso y el informe de IA según la etapa (definición, mantenimiento, volumen…).</p>
          </div>
          {s.phases.length > 0 && (
            <div class="space-y-1.5">
              {[...s.phases].sort((a, b) => a.start.localeCompare(b.start)).map((p, i) => (
                <div key={`${p.name}-${p.start}`} class="flex items-center gap-2 text-sm">
                  <b>{p.name}</b> <span class="tabular-nums text-gray-400">desde {fmtDate(p.start)}</span>
                  <button type="button" class="icon-btn text-coralRed hover:bg-coralRed/10" data-act="phaseDel" data-arg={String(i)} aria-label={`Borrar fase ${p.name}`} onClick={() => void actions.deletePhase(i)}>
                    <Icon name="close" className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <form
            id="f-phase"
            class="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void actions.addPhase(phaseNameRef.current?.value ?? '', phaseStartRef.current?.value ?? '');
            }}
          >
            <input ref={phaseNameRef} class="inp w-44" name="name" placeholder="Ej. Volumen, Definición, Mantenimiento…" aria-label="Nombre de la fase" required />
            <input ref={phaseStartRef} class="inp w-40" type="date" name="start" aria-label="Fecha de inicio de la fase" required />
            <button class="btn" type="submit">Añadir fase</button>
          </form>
        </div>
      </div>

      <PlanSidebarWidgets
        state={state}
        onChangeTargetRoutine={actions.setTargetRoutine}
        onSearchChange={actions.setPlanSearch}
        onQuickAdd={(d, name) => void actions.quickAddToRoutine(d, name)}
        onOpenNewExercise={(r) => actions.openExerciseModal({ routine: r || undefined })}
      />
    </div>
  );
}
