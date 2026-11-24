import { useEffect, useState } from 'preact/hooks';
import { MUSCLES } from '../../lib/seed';
import type { ExerciseMapItem } from '../../store/planSelectors';
import { Collapsible } from '../common/Collapsible';
import { Icon } from '../common/Icon';

interface PlanExerciseMapRowProps {
  /** Ejercicio con su músculo principal y secundarios. */
  item: ExerciseMapItem;
  /** Índice visual para enlazar `aria-controls`. */
  idx: number;
  /** Indica si el desplegable está abierto. */
  open: boolean;
  /** Alterna apertura del desplegable. */
  onToggle: () => void;
  /** Actualiza `expandedEx` tras renombrar para mantener el panel abierto. */
  onRenamed?: (newName: string) => void;
  /** Renombra el ejercicio en catálogo, rutinas e historial. */
  onRename?: (oldName: string, newName: string) => Promise<string | undefined>;
  /** Elimina por completo el ejercicio tras confirmación. */
  onDelete?: (exName: string) => Promise<boolean> | void;
  /** Cambia el músculo principal del ejercicio. */
  onChangePrimary?: (exName: string, primary: string) => void;
  /** Alterna un músculo secundario del ejercicio. */
  onToggleSecondary?: (exName: string, muscle: string) => void;
}

const CHIP_BASE = 'inline-flex min-h-[44px] sm:min-h-[32px] items-center rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue';

/** Fila desplegable de ejercicio con edición de nombre, músculos y eliminación. */
export function PlanExerciseMapRow({
  item, idx, open, onToggle, onRenamed, onRename, onDelete, onChangePrimary, onToggleSecondary,
}: PlanExerciseMapRowProps) {
  const [draftName, setDraftName] = useState(item.name);
  const [renameErr, setRenameErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setDraftName(item.name);
      setRenameErr('');
    }
  }, [open, item.name]);

  const submitRename = async () => {
    const trimmed = draftName.trim();
    if (!onRename || !trimmed || trimmed === item.name || busy) return;
    setBusy(true);
    try {
      const err = await onRename(item.name, trimmed);
      if (err) setRenameErr(err);
      else {
        setRenameErr('');
        onRenamed?.(trimmed.slice(0, 80));
      }
    } catch {
      setRenameErr('No se pudo renombrar el ejercicio.');
    } finally { setBusy(false); }
  };

  const handleDelete = async () => {
    if (!onDelete || busy) return;
    setBusy(true);
    try { await onDelete(item.name); } finally { setBusy(false); }
  };

  return (
    <div class="border-b border-white/10">
      <button
        type="button"
        aria-expanded={open ? 'true' : 'false'}
        aria-controls={`ex-map-panel-${idx}`}
        class="flex min-h-[56px] w-full items-start justify-between gap-3 px-1 py-3 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue rounded-lg"
        onClick={onToggle}
      >
        <div class="min-w-0 space-y-1.5">
          <p class="text-sm font-semibold text-white leading-snug">{item.name}</p>
          <div class="flex flex-wrap items-center gap-1.5 text-[11px]">
            {item.primary ? (
              <span class="rounded-md border border-electricBlue/35 bg-electricBlue/15 px-2 py-0.5 font-bold text-blue-200">{item.primary}</span>
            ) : (
              <span class="rounded-md border border-amberGold/40 bg-amberGold/10 px-2 py-0.5 font-semibold text-amberGold">Sin músculo principal</span>
            )}
            {item.secondary.map((sec) => (
              <span key={sec} class="rounded-md bg-white/[0.06] px-2 py-0.5 text-gray-300">{sec}</span>
            ))}
          </div>
        </div>
        <Icon name="caretDown" className={`mt-1 h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180 text-white' : ''}`} />
      </button>

      <Collapsible open={open}>
        <div id={`ex-map-panel-${idx}`} class="space-y-3 border-t border-white/5 px-1 pb-3.5 pt-2.5">
          {onRename && (
            <div class="space-y-1.5">
              <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400" for={`ex-rename-${idx}`}>Nombre del ejercicio</label>
              <div class="flex items-center gap-2">
                <input
                  id={`ex-rename-${idx}`}
                  type="text"
                  class="inp min-w-0 flex-1"
                  maxLength={80}
                  value={draftName}
                  aria-label={`Nombre de ${item.name}`}
                  onInput={(e) => { setDraftName(e.currentTarget.value); if (renameErr) setRenameErr(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void submitRename(); } }}
                />
                <button type="button" class="btn-sm btn-accent min-h-[44px] sm:min-h-[34px] shrink-0" disabled={busy || !draftName.trim() || draftName.trim() === item.name} onClick={() => void submitRename()}>Guardar</button>
              </div>
              {renameErr && <p role="alert" class="text-xs text-coralRed">{renameErr}</p>}
            </div>
          )}

          <div class="space-y-1.5">
            <span class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Músculo principal (1 serie)</span>
            <div class="flex flex-wrap gap-1.5" role="group" aria-label={`Músculo principal de ${item.name}`}>
              {MUSCLES.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={item.primary === m ? 'true' : 'false'}
                  class={`${CHIP_BASE} ${item.primary === m ? 'border-electricBlue bg-electricBlue/20 text-blue-200' : 'border-white/10 bg-gray-900/70 text-gray-300 hover:border-white/25 hover:text-white'}`}
                  onClick={() => onChangePrimary?.(item.name, m)}
                >{m}</button>
              ))}
            </div>
          </div>

          <div class="space-y-1.5">
            <span class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Músculos secundarios (0,5 series c/u)</span>
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
                  >{m}</button>
                );
              })}
            </div>
          </div>

          {onDelete && (
            <div class="border-t border-white/10 pt-2.5 flex justify-end">
              <button type="button" class="btn-sm btn-danger min-h-[44px] sm:min-h-[34px]" disabled={busy} onClick={() => void handleDelete()}>
                <Icon name="trash" className="h-3.5 w-3.5" /> Eliminar ejercicio
              </button>
            </div>
          )}
        </div>
      </Collapsible>
    </div>
  );
}
