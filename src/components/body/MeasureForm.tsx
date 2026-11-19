import { useEffect, useRef } from 'preact/hooks';
import type { Measure } from '../../types';
import { fmtDate } from '../../ui/shared';
import { Icon } from '../common/Icon';
import { MeasureFieldInput, MeasurePerimGroups, type MeasureFieldDef } from './MeasureFieldInput';

interface MeasureFormProps {
  /** Fecha actualmente seleccionada en el formulario (`YYYY-MM-DD`). */
  activeDate: string;
  /** Fecha local actual para mostrar el acceso rápido `Ir a hoy`. */
  today: string;
  /** Medición existente para `activeDate`, si hay alguna guardada. */
  currentEntry?: Measure;
  /** Campos básicos (`Peso`, `% Grasa`, `Masa muscular`, `Cintura`). */
  basicFields: MeasureFieldDef[];
  /** Indica si el bloque expandible de perímetros con cinta está abierto. */
  perimOpen: boolean;
  /** Grupos de campos de perímetros organizados por zona corporal. */
  perimGroups: { title: string; fields: MeasureFieldDef[] }[];
  /** Valor actual de la nota de medición. */
  noteValue: string;
  /** Marca temporal emitida al pulsar editar en el historial para desplazar el formulario a la vista. */
  scrollSignal?: number;
  /** Resuelve valor actual y placeholder histórico de cada campo métrico. */
  getFieldInputMeta: (key: keyof Measure) => { value: string; placeholder: string };
  /** Cambia la fecha activa del formulario. */
  onChangeDate: (date: string) => void;
  /** Restablece el formulario a la fecha de hoy. */
  onClearDate: () => void;
  /** Muestra u oculta los campos opcionales de perímetros con cinta. */
  onTogglePerim: () => void;
  /** Actualiza el borrador en memoria al escribir en cualquier campo. */
  onUpdateDraft: (field: string, value: string) => void;
  /** Guarda la medición combinando los campos enviados con los ya existentes en esa fecha. */
  onSubmitMeasure: (fd: FormData) => void | Promise<void>;
}

/** Formulario de alta y edición incremental de medidas antropométricas y perímetros. */
export function MeasureForm(props: MeasureFormProps) {
  const { activeDate, today, currentEntry, basicFields, perimOpen, perimGroups, noteValue, scrollSignal, getFieldInputMeta, onChangeDate, onClearDate, onTogglePerim, onUpdateDraft, onSubmitMeasure } = props;
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (scrollSignal) formRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [scrollSignal]);

  return (
    <form
      ref={formRef}
      id="f-measure"
      class="pb-5 border-b border-white/10 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmitMeasure(new FormData(e.currentTarget));
      }}
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 class="font-bold text-white">Añadir / editar medición</h3>
          <p class="text-xs text-gray-400">
            Rellena solo lo que hayas medido hoy (el resto se muestra como referencia). Si guardas otro dato en la misma fecha, se combina sin borrar los anteriores.
          </p>
        </div>
        {currentEntry && (
          <div class="flex items-center gap-2">
            <span class="rounded-full border border-electricBlue/40 bg-electricBlue/15 px-2.5 py-0.5 text-[11px] font-semibold text-blue-200">
              Editando {fmtDate(activeDate)}
            </span>
            {activeDate !== today && <button type="button" class="btn-sm" onClick={onClearDate}>Ir a hoy</button>}
          </div>
        )}
      </div>

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <label class="block">
          <span class="lbl">Fecha</span>
          <input class="inp tabular-nums" type="date" name="date" value={activeDate} required onChange={(e) => onChangeDate(e.currentTarget.value)} />
        </label>
        {basicFields.map((f) => {
          const meta = getFieldInputMeta(f.key);
          return <MeasureFieldInput key={f.key} field={f} value={meta.value} placeholder={meta.placeholder} onUpdateDraft={onUpdateDraft} />;
        })}
        <label class="col-span-2 sm:col-span-1 lg:col-span-1 block">
          <span class="lbl">Nota (opcional)</span>
          <input class="inp" name="note" value={noteValue} placeholder="p. ej. en ayunas…" onInput={(e) => onUpdateDraft('note', e.currentTarget.value)} />
        </label>
      </div>

      <div>
        <button type="button" aria-expanded={perimOpen ? 'true' : 'false'} class="btn-sm" onClick={onTogglePerim}>
          {perimOpen ? '− Ocultar perímetros con cinta' : '+ Añadir perímetros con cinta (opcional)'}
        </button>
      </div>

      {perimOpen && <MeasurePerimGroups groups={perimGroups} getFieldInputMeta={getFieldInputMeta} onUpdateDraft={onUpdateDraft} />}

      <div class="flex flex-wrap items-center gap-2">
        <button class="btn-primary" type="submit">
          <Icon name="save" className="h-4 w-4" /> {currentEntry ? 'Actualizar medición' : 'Guardar medición'}
        </button>
      </div>
    </form>
  );
}
