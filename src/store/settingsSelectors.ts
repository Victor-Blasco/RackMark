import type { AiTone, ThemeMode } from '../types';
import type { State } from '../ui/shared';

export type SettingsSecId = 'account' | 'profile' | 'ai' | 'data';

export interface SettingsSectionMeta {
  id: SettingsSecId;
  title: string;
  summary: string;
  titleCls?: string;
}

export const THEME_OPTIONS: ReadonlyArray<{ id: ThemeMode; label: string }> = [
  { id: 'dark', label: 'Oscuro' },
  { id: 'light', label: 'Claro' },
  { id: 'system', label: 'Sistema' },
];

const GOAL_LABELS: Record<string, string> = {
  bulk: 'Ganar músculo',
  cut: 'Definición',
  recomp: 'Recomposición',
  strength: 'Fuerza máxima',
};

/**
 * Construye los resúmenes de una línea para las secciones de `Cuenta y ajustes`.
 *
 * @param state - Estado global de la aplicación.
 * @param unsynced - Si existen cambios locales pendientes de subir.
 * @param tone - Tono activo del Coach IA.
 * @returns Lista ordenada de metadatos de sección con título y resumen.
 */
export function buildSettingsSections(
  state: State,
  unsynced: boolean,
  tone: AiTone,
): ReadonlyArray<SettingsSectionMeta> {
  const p = state.settings.profile;
  const quota = state.user?.emailVerified ? state.aiQuota : undefined;

  const accountSummary = !state.user
    ? 'Sin sesión iniciada · modo local'
    : !state.user.emailVerified
      ? `${state.user.email ?? 'Cuenta'} · Verifica tu correo`
      : `${state.user.displayName ?? state.user.email ?? 'Conectado'} · ${unsynced ? 'Pendiente' : 'Sincronizado'}`;

  const profileSummary = [
    p.sex === 'mujer' ? 'Mujer' : p.sex === 'hombre' ? 'Hombre' : p.sex,
    p.age ? `${p.age} años` : null,
    p.height ? `${p.height} cm` : null,
    p.goal ? GOAL_LABELS[p.goal] ?? p.goal : null,
  ].filter(Boolean).join(' · ') || 'Sin completar';

  const aiSummary = `${tone === 'simple' ? 'Sencillo y generalista' : 'Técnico y detallado'}${quota ? ` · ${quota.used}/${quota.limit} hoy` : ''}`;

  return [
    { id: 'account', title: 'Cuenta y sincronización', summary: accountSummary },
    { id: 'profile', title: 'Perfil del atleta', summary: profileSummary },
    { id: 'ai', title: 'Preferencias del Coach IA', summary: aiSummary },
    { id: 'data', title: 'Accesos relacionados', summary: 'Datos, rutinas y privacidad', titleCls: 'text-sm font-bold text-white' },
  ];
}
