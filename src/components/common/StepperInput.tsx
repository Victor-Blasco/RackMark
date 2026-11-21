import { useEffect, useRef, useState } from 'preact/hooks';

interface StepperInputProps {
  /** Etiqueta visible encima del control numérico. */
  label: string;
  /** Valor numérico actual mostrado en el campo. */
  value: number;
  /** Incremento HTML nativo para validación y flechas del input. */
  step: string;
  /** Modo de teclado virtual en móvil (`decimal` o `numeric`). */
  inputMode: 'decimal' | 'numeric';
  /** Etiqueta accesible del `<input>`. */
  inputAria: string;
  /** Delta aplicado al pulsar los botones `−` o `+`. */
  delta: number;
  /** Etiqueta accesible del botón de decremento. */
  decAria: string;
  /** Etiqueta accesible del botón de incremento. */
  incAria: string;
  /** Clases opcionales del contenedor exterior. */
  wrapClass?: string;
  /** Clases opcionales de la etiqueta superior. */
  labelClass?: string;
  /** Clases opcionales de los botones laterales `−` y `+`. */
  btnClass?: string;
  /** Clases opcionales del `<input>` central. */
  inputClass?: string;
  /** Callback al pulsar `−` o `+` con el delta firmado. */
  onStep?: (delta: number) => void;
  /** Callback al escribir en el campo de texto. */
  onInputValue?: (raw: string) => void;
  /** Callback al perder el foco para consolidar valores vacíos o parciales. */
  onBlurValue?: (raw: string) => void;
}

const DEFAULT_BTN = 'flex h-11 w-11 shrink-0 items-center justify-center border border-white/15 bg-white/5 text-base font-bold text-gray-200 hover:border-electricBlue active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue';

/**
 * Control numérico táctil `− | valor | +` con etiqueta explícita y targets de 44 px.
 */
export function StepperInput(props: StepperInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const focusedRef = useRef(false);
  const btn = props.btnClass ?? DEFAULT_BTN;
  const inp = props.inputClass ?? 'inp-stepper min-w-[44px]';

  useEffect(() => {
    if (!focusedRef.current) setDraft(null);
  }, [props.value]);

  const handleStep = (delta: number) => {
    setDraft(null);
    props.onStep?.(delta);
  };

  return (
    <div class={props.wrapClass ?? 'flex-1 min-w-[132px]'}>
      <span class={props.labelClass ?? 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400'}>
        {props.label}
      </span>
      <div class="flex items-center">
        <button
          type="button"
          class={`${btn} rounded-l-xl`}
          style={{ touchAction: 'manipulation' }}
          aria-label={props.decAria}
          onClick={() => handleStep(-props.delta)}
        >
          −
        </button>
        <input
          class={inp}
          type="number"
          step={props.step}
          min="0"
          inputMode={props.inputMode}
          enterKeyHint="done"
          value={draft ?? props.value}
          aria-label={props.inputAria}
          onFocus={() => {
            focusedRef.current = true;
          }}
          onInput={(e) => {
            const raw = e.currentTarget.value;
            setDraft(raw);
            props.onInputValue?.(raw);
          }}
          onBlur={(e) => {
            focusedRef.current = false;
            setDraft(null);
            props.onBlurValue?.(e.currentTarget.value);
          }}
        />
        <button
          type="button"
          class={`${btn} rounded-r-xl`}
          style={{ touchAction: 'manipulation' }}
          aria-label={props.incAria}
          onClick={() => handleStep(props.delta)}
        >
          +
        </button>
      </div>
    </div>
  );
}
