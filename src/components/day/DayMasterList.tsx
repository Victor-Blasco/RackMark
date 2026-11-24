import type { ChartConfiguration } from 'chart.js';
import type { ExStats } from '../../lib/analysis';
import { norm } from '../../lib/seed';
import type { AiEntry, RoutineEx } from '../../types';
import { short } from '../../ui/shared';
import { DayDesktopOption } from './DayDesktopOption';
import { DayExerciseDetail } from './DayExerciseDetail';
import { DayMobileAccordion } from './DayMobileAccordion';

interface DayMasterListProps {
  /** Nombre de la rutina mostrada. */
  day: string;
  /** Lista de ejercicios visibles según el ámbito seleccionado. */
  exercises: ExStats[];
  /** Filas planificadas reales de `settings.routines[day]` para edición directa. */
  routineRows?: RoutineEx[];
  /** Muestra botones de reordenamiento y borrado por fila. */
  organizeMode?: boolean;
  /** Ejercicio seleccionado actualmente en escritorio. */
  desktopCur?: string;
  /** Ejercicio desplegado actualmente en el acordeón móvil. */
  mobileCur?: string;
  /** Datos del ejercicio mostrado en el panel derecho de escritorio. */
  desktopEx?: ExStats;
  /** Config Chart.js para escritorio. */
  desktopChartCfg: ChartConfiguration | null;
  /** Config Chart.js para móvil. */
  mobileChartCfg: ChartConfiguration | null;
  /** Etiqueta del filtro temporal activo. */
  rangeLabel: string;
  /** Fecha de informe IA vigente. */
  aiDate?: string;
  /** Notas fijas del usuario por nombre de ejercicio. */
  userNotes: Record<string, string>;
  /** Resuelve consejo IA para cada ejercicio si aplica. */
  aiFor: (ex: ExStats) => AiEntry | undefined;
  /** Selecciona o repliega un ejercicio en lista o acordeón. */
  onSelectEx: (name: string) => void;
  /** Inicia entrenamiento en vivo de esta rutina. */
  onStartWorkout: () => void;
  /** Abre el modal de nota permanente. */
  onEditNote: (exName: string) => void;
  /** Guarda series × reps objetivo editadas in-situ. */
  onUpdateTarget?: (idx: number, setsRaw: string, repsRaw: string) => void;
  /** Mueve una fila arriba (`-1`) o abajo (`+1`). */
  onMoveRow?: (idx: number, dir: number) => void;
  /** Elimina una fila de la rutina. */
  onDeleteRow?: (idx: number) => void;
}

const lastSummary = (x: ExStats, rangeLabel: string) => {
  if (x.last) return `${short(x.last.date)} · ${x.last.sets.map((s) => `${s.w}×${s.r}`).join(' · ')}`;
  if (x.n === 0 && x.target) return `Objetivo ${x.target.sets}×${x.target.reps} · Sin estrenar`;
  return `Sin registros en ${rangeLabel}`;
};

/**
 * Maestro-detalle adaptable: acordeón vertical en móvil y `role="listbox"` + panel fijo en escritorio.
 */
export function DayMasterList(props: DayMasterListProps) {
  const {
    day, exercises, routineRows = [], organizeMode = false, desktopCur, desktopEx, desktopChartCfg,
    rangeLabel, aiDate, userNotes, aiFor, onSelectEx, onStartWorkout, onEditNote, onUpdateTarget, onMoveRow, onDeleteRow,
  } = props;

  const onOptionKeyDown = (e: KeyboardEvent, idx: number, name: string) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
      e.preventDefault();
      onSelectEx(name);
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key) || !exercises.length) return;
    e.preventDefault();
    e.stopPropagation();
    const nextIdx = e.key === 'ArrowDown'
      ? (idx + 1) % exercises.length
      : e.key === 'ArrowUp'
        ? (idx - 1 + exercises.length) % exercises.length
        : e.key === 'Home' ? 0 : exercises.length - 1;
    const next = exercises[nextIdx];
    if (!next) return;
    onSelectEx(next.name);
    const el = document.getElementById(`day-opt-${nextIdx}`);
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: 'nearest' });
  };

  return (
    <>
      <DayMobileAccordion {...props} />

      <div class="hidden lg:grid lg:grid-cols-12 lg:gap-5 xl:gap-6 lg:items-start">
        <div
          class="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-6 space-y-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue rounded-2xl"
          role="listbox"
          aria-orientation="vertical"
          aria-label={`Ejercicios de ${day}`}
          onKeyDown={(ev) => {
            const curIdx = Math.max(0, exercises.findIndex((x) => x.name === desktopCur));
            onOptionKeyDown(ev, curIdx, exercises[curIdx]?.name ?? '');
          }}
        >
          {exercises.map((x, idx) => {
            const rIdx = routineRows.findIndex((r) => norm(r.name) === norm(x.name));
            return (
              <DayDesktopOption
                key={x.name}
                idx={idx}
                exercise={x}
                selected={x.name === desktopCur}
                summary={lastSummary(x, rangeLabel)}
                advice={aiFor(x)}
                routineRow={rIdx >= 0 ? routineRows[rIdx] : undefined}
                routineIdx={rIdx}
                routineTotal={routineRows.length}
                organizeMode={organizeMode}
                onSelect={() => onSelectEx(x.name)}
                onKeyDown={(ev) => onOptionKeyDown(ev, idx, x.name)}
                onUpdateTarget={onUpdateTarget}
                onMoveRow={onMoveRow}
                onDeleteRow={onDeleteRow}
              />
            );
          })}
        </div>
        <div class="lg:col-span-7 xl:col-span-8 lg:sticky lg:top-6">
          {desktopEx && (
            <DayExerciseDetail
              exercise={desktopEx}
              aiAdvice={aiFor(desktopEx)}
              userNote={userNotes[desktopEx.name]?.trim() ?? ''}
              aiDate={aiDate}
              canvasId="c-day"
              historyLimit={20}
              rangeLabel={rangeLabel}
              chartConfig={desktopChartCfg}
              onStartWorkout={onStartWorkout}
              onEditNote={() => onEditNote(desktopEx.name)}
            />
          )}
        </div>
      </div>
    </>
  );
}
