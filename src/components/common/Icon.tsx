import { ICON_PATHS, type IconName } from '../../ui/icons';

interface IconProps {
  /** Identificador del icono dentro del diccionario `ICON_PATHS`. */
  name: IconName;
  /** Clases Tailwind de tamaño y color para el `<svg>`. */
  className?: string;
}

/**
 * Renderiza un icono SVG inline de Phosphor Icons (Bold) marcado como decorativo.
 */
export function Icon({ name, className = 'h-4 w-4' }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      fill="currentColor"
      class={`inline-block shrink-0 ${className}`}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }}
    />
  );
}
