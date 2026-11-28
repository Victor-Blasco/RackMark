import { useState } from 'preact/hooks';
import { Collapsible } from '../common/Collapsible';
import { Icon } from '../common/Icon';

interface PlanMergeSectionProps {
  /** Ejercicio origen seleccionado para fusionar. */
  mergeFrom: string;
  /** Ejercicio destino que conservará el histórico. */
  mergeTo: string;
  /** Alias activos guardados en `settings.aliases`. */
  aliases: Record<string, string>;
  /** Abre el selector modal de origen o destino. */
  onOpenPicker: (slot: 'from' | 'to') => void;
  /** Ejecuta la fusión de historiales entre origen y destino. */
  onMerge: (from: string, to: string) => void;
  /** Deshace una fusión registrada previamente. */
  onUnmerge: (alias: string) => void;
}

/** Sección colapsable de unificación y alias de ejercicios duplicados en Catálogo. */
export function PlanMergeSection({
  mergeFrom,
  mergeTo,
  aliases,
  onOpenPicker,
  onMerge,
  onUnmerge,
}: PlanMergeSectionProps) {
  const [open, setOpen] = useState(() => Boolean(mergeFrom || mergeTo));
  const [aliasesOpen, setAliasesOpen] = useState(false);
  const aliasEntries = Object.entries(aliases);

  return (
    <div class="border-t border-white/10 pt-2">
      <button
        type="button"
        aria-expanded={open ? 'true' : 'false'}
        class="flex min-h-[44px] w-full items-center justify-between gap-3 py-2 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div class="min-w-0">
          <h2 class="font-bold text-white">Unificar ejercicios duplicados</h2>
          <p class="text-xs text-gray-400">
            Une historiales si cambiaste de máquina o nombre{aliasEntries.length > 0 ? ` · ${aliasEntries.length} ${aliasEntries.length === 1 ? 'fusión activa' : 'fusiones activas'}` : ''}.
          </p>
        </div>
        <Icon name={open ? 'caretUp' : 'caretDown'} className="h-4 w-4 shrink-0 text-gray-400" />
      </button>

      <Collapsible open={open} keepMounted>
        <div class="pt-2 pb-4 space-y-3">
          <div class="flex flex-wrap items-center gap-2">
            <button
              id="mergeFrom"
              type="button"
              class="inp inline-flex w-full sm:w-auto sm:min-w-[210px] max-w-full items-center justify-between gap-2 text-left"
              aria-label={`Ejercicio origen a fusionar${mergeFrom ? `: ${mergeFrom}` : ''}`}
              onClick={() => onOpenPicker('from')}
            >
              <span class={`truncate ${mergeFrom ? 'font-semibold text-white' : 'text-gray-400'}`}>
                {mergeFrom || 'Duplicado a eliminar…'}
              </span>
              <Icon name="caretDown" className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            </button>
            <span aria-hidden="true" class="text-gray-400">→</span>
            <button
              id="mergeTo"
              type="button"
              class="inp inline-flex w-full sm:w-auto sm:min-w-[210px] max-w-full items-center justify-between gap-2 text-left"
              aria-label={`Ejercicio destino${mergeTo ? `: ${mergeTo}` : ''}`}
              onClick={() => onOpenPicker('to')}
            >
              <span class={`truncate ${mergeTo ? 'font-semibold text-white' : 'text-gray-400'}`}>
                {mergeTo || 'Ejercicio que se conserva…'}
              </span>
              <Icon name="caretDown" className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            </button>
            <button type="button" class="btn" disabled={!mergeFrom || !mergeTo || mergeFrom === mergeTo} onClick={() => onMerge(mergeFrom, mergeTo)}>
              Fusionar
            </button>
          </div>

          {mergeFrom && mergeTo && mergeFrom !== mergeTo && (
            <p class="text-xs text-gray-300">
              Todo el historial de <b class="text-white">{mergeFrom}</b> pasará a <b class="text-white">{mergeTo}</b> y{' '}
              <b class="text-coralRed">{mergeFrom}</b> se eliminará.
            </p>
          )}

          {aliasEntries.length > 0 && (
            <div class="border-t border-white/10 pt-2">
              <button
                type="button"
                aria-expanded={aliasesOpen ? 'true' : 'false'}
                class="flex min-h-[40px] items-center gap-2 text-xs font-semibold text-gray-300 hover:text-white"
                onClick={() => setAliasesOpen((v) => !v)}
              >
                <Icon name={aliasesOpen ? 'caretUp' : 'caretDown'} className="h-3.5 w-3.5 text-gray-400" />
                <span>Fusiones activas ({aliasEntries.length})</span>
              </button>
              <Collapsible open={aliasesOpen} keepMounted>
                <div class="pt-1 space-y-1">
                  {aliasEntries.map(([a, b]) => (
                    <div key={a} class="flex items-center gap-2 text-xs text-gray-400">
                      <span>{a} → {b}</span>
                      <button type="button" class="icon-btn text-coralRed hover:bg-coralRed/10" aria-label={`Deshacer fusión ${a}`} onClick={() => onUnmerge(a)}>
                        <Icon name="close" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </Collapsible>
            </div>
          )}
        </div>
      </Collapsible>
    </div>
  );
}
