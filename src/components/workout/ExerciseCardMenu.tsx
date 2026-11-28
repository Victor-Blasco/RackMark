import type { LoadType } from '../../types';
import { fmtMMSS } from '../../ui/restAudio';
import { Icon } from '../common/Icon';

interface ExerciseCardMenuProps {
  /** Nombre del ejercicio actual. */
  exName: string;
  /** Número de sesiones previas registradas (`0` si no hay historial). */
  historyCount: number;
  /** Descanso objetivo en segundos para el inicio manual. */
  targetRestSec: number;
  /** Tipo de carga configurado actualmente para el ejercicio. */
  loadType: LoadType;
  /** Abre el drawer/sheet de historial rápido. */
  onOpenHistory: () => void;
  /** Inicia manualmente el temporizador de descanso. */
  onStartRest: () => void;
  /** Abre el selector para cambiar o añadir ejercicio. */
  onOpenPicker: (mode: 'swap' | 'add') => void;
  /** Abre el modal de nota permanente. */
  onOpenFixedNote: () => void;
  /** Cambia el tipo de carga (`external`, `weighted`, `assisted`). */
  onSetLoadType: (loadType: LoadType) => void;
}

const MENU_ITEM =
  'min-h-[44px] sm:min-h-[36px] w-full flex items-center gap-2 rounded-lg px-2.5 text-left text-xs font-semibold text-gray-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue';

const LOAD_OPTS: ReadonlyArray<{ id: LoadType; label: string }> = [
  { id: 'external', label: 'Externa' },
  { id: 'weighted', label: '+BW' },
  { id: 'assisted', label: '−BW' },
];

/** Menú contextual `⋯` del ejercicio activo en `En vivo`. */
export function ExerciseCardMenu({
  exName,
  historyCount,
  targetRestSec,
  loadType,
  onOpenHistory,
  onStartRest,
  onOpenPicker,
  onOpenFixedNote,
  onSetLoadType,
}: ExerciseCardMenuProps) {
  return (
    <div
      role="menu"
      aria-label={`Acciones de ${exName}`}
      class="absolute right-0 top-11 z-30 w-56 rounded-xl border border-white/10 bg-modalDark p-1.5 shadow-2xl space-y-0.5"
    >
      <button type="button" role="menuitem" class={MENU_ITEM} onClick={onOpenHistory}>
        <Icon name="chart" className="h-3.5 w-3.5 text-emerald-300" /> Historial ({historyCount})
      </button>
      <button type="button" role="menuitem" class={MENU_ITEM} onClick={onStartRest}>
        <Icon name="play" className="h-3.5 w-3.5 text-blue-300" /> Iniciar descanso ({fmtMMSS(targetRestSec)})
      </button>
      <button type="button" role="menuitem" class={MENU_ITEM} onClick={() => onOpenPicker('swap')}>
        <Icon name="refresh" className="h-3.5 w-3.5 text-blue-300" /> Cambiar ejercicio
      </button>
      <button type="button" role="menuitem" class={MENU_ITEM} onClick={() => onOpenPicker('add')}>
        <Icon name="plus" className="h-3.5 w-3.5 text-blue-300" /> Añadir ejercicio
      </button>
      <button type="button" role="menuitem" class={MENU_ITEM} onClick={onOpenFixedNote}>
        <Icon name="edit" className="h-3.5 w-3.5 text-gray-400" /> Nota fija (siempre)
      </button>
      <div class="border-t border-white/10 pt-1.5 mt-1 px-1.5 pb-1">
        <span class="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Tipo de carga</span>
        <div class="grid grid-cols-3 gap-1" role="group" aria-label={`Tipo de carga de ${exName}`}>
          {LOAD_OPTS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              aria-pressed={loadType === opt.id ? 'true' : 'false'}
              class={`min-h-[36px] rounded-lg border text-[11px] font-bold transition-colors ${loadType === opt.id ? 'border-electricBlue bg-electricBlue/20 text-blue-200' : 'border-white/10 text-gray-400 hover:text-white'}`}
              onClick={() => onSetLoadType(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
