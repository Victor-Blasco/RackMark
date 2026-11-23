import { Chart } from 'chart.js';
import type { ThemeMode } from '../types';

export const THEME_STORAGE_KEY = 'gymapp_theme';

/** Color principal de las gráficas según el tema efectivo del DOM (`#2DD4BF` oscuro, `#0F766E` claro). */
export function chartAccentColor(): string {
  if (typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light') {
    return '#0F766E';
  }
  return '#2DD4BF';
}

/** Lee el tema guardado en `localStorage` para evitar parpadeos antes de cargar IndexedDB. */
export function readStoredTheme(): ThemeMode {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_STORAGE_KEY) : null;
    if (raw === 'dark' || raw === 'light' || raw === 'system') return raw;
  } catch {
    // Almacenamiento local no disponible (SSR o navegación privada restrictiva)
  }
  return 'dark';
}

/** Resuelve el tema efectivo (`'dark'` o `'light'`) teniendo en cuenta la preferencia del sistema. */
export function resolveEffectiveTheme(mode: ThemeMode = 'dark'): 'dark' | 'light' {
  if (mode === 'system') {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    return 'dark';
  }
  return mode === 'light' ? 'light' : 'dark';
}

/** Aplica el tema efectivo en `<html>`, `<meta name="theme-color">` y defaults de Chart.js. */
export function applyTheme(mode: ThemeMode = 'dark'): 'dark' | 'light' {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Ignorar error de cuota o modo privado
  }

  const resolved = resolveEffectiveTheme(mode);

  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.dataset.theme = resolved;
    root.classList.toggle('dark', resolved === 'dark');
    root.classList.toggle('light', resolved === 'light');
    root.style.colorScheme = resolved;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'light' ? '#F3F7F8' : '#0A0D0E');
  }

  Chart.defaults.color = resolved === 'light' ? '#4B5E65' : '#94A3A8';
  Chart.defaults.borderColor = resolved === 'light' ? 'rgba(15, 23, 26, 0.08)' : 'rgba(238, 243, 245, 0.07)';

  return resolved;
}

/** Aplica el tema inicial y escucha cambios del sistema cuando el usuario elige `system`. */
export function initThemeListener(getMode: () => ThemeMode, onSystemChange?: () => void): () => void {
  applyTheme(readStoredTheme());
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const mq = window.matchMedia('(prefers-color-scheme: light)');
  const handler = () => {
    if (getMode() === 'system') {
      applyTheme('system');
      onSystemChange?.();
    }
  };
  mq.addEventListener?.('change', handler);
  return () => mq.removeEventListener?.('change', handler);
}
