import type { ComponentChildren } from 'preact';

interface ViewHeaderProps {
  /** Título principal de la vista analítica. */
  title: string;
  /** Subtítulo descriptivo con contexto o rango activo. */
  subtitle: ComponentChildren;
  /** Control opcional alineado a la derecha (p. ej. `RangePicker`). */
  right?: ComponentChildren;
}

/** Cabecera plana estándar para vistas analíticas con separador inferior de 1 px. */
export function ViewHeader({ title, subtitle, right }: ViewHeaderProps) {
  return (
    <div class="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
      <div>
        <h1 class="text-lg font-extrabold text-white">{title}</h1>
        <p class="text-xs text-gray-400">{subtitle}</p>
      </div>
      {right}
    </div>
  );
}
