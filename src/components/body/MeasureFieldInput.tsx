import type { Measure, MEASURE_FIELDS } from '../../types';

export type MeasureFieldDef = (typeof MEASURE_FIELDS)[number];

interface MeasureFieldInputProps {
  /** Definición de etiqueta, clave y unidad del campo antropométrico. */
  field: MeasureFieldDef;
  /** Valor actual del borrador o registro activo. */
  value: string;
  /** Último valor conocido como referencia placeholder. */
  placeholder: string;
  /** Actualiza el campo en el borrador en memoria. */
  onUpdateDraft: (field: string, value: string) => void;
}

/** Campo numérico compacto para peso, porcentaje graso o perímetro corporal. */
export function MeasureFieldInput({ field, value, placeholder, onUpdateDraft }: MeasureFieldInputProps) {
  return (
    <label class="block">
      <span class="lbl">{field.label} ({field.unit})</span>
      <input
        class="inp tabular-nums font-medium"
        inputMode="decimal"
        name={field.key}
        value={value}
        placeholder={placeholder}
        onInput={(e) => onUpdateDraft(field.key, e.currentTarget.value)}
      />
    </label>
  );
}

interface MeasurePerimGroupsProps {
  /** Grupos de campos de perímetros organizados por zona corporal. */
  groups: { title: string; fields: MeasureFieldDef[] }[];
  /** Resuelve valor actual y placeholder histórico de cada campo métrico. */
  getFieldInputMeta: (key: keyof Measure) => { value: string; placeholder: string };
  /** Actualiza el borrador al escribir en cualquier campo. */
  onUpdateDraft: (field: string, value: string) => void;
}

/** Sección desplegable con grupos de perímetros medidos con cinta métrica. */
export function MeasurePerimGroups({ groups, getFieldInputMeta, onUpdateDraft }: MeasurePerimGroupsProps) {
  return (
    <div class="space-y-3 pt-3 border-t border-white/10">
      {groups.map((g) => (
        <div key={g.title} class="space-y-2">
          <p class="text-[11px] font-bold uppercase tracking-wider text-gray-400">{g.title}</p>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {g.fields.map((f) => {
              const meta = getFieldInputMeta(f.key);
              return (
                <MeasureFieldInput
                  key={f.key}
                  field={f}
                  value={meta.value}
                  placeholder={meta.placeholder}
                  onUpdateDraft={onUpdateDraft}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
