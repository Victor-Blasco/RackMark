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

/**
 * Campo numérico compacto para peso, porcentaje graso o perímetro corporal.
 */
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
