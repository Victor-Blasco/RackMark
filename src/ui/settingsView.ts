import type { AiTone } from '../types';
import { icon } from './icons';
import { esc, fmtDate, type State } from './shared';

/**
 * Renderiza la vista de cuenta de usuario, perfil biométrico y preferencias del Coach IA.
 *
 * @param S - Estado global de la aplicación.
 * @returns HTML completo de la pestaña `Cuenta y ajustes`.
 */
export function viewSettings(S: State): string {
  const s = S.settings;
  const tone: AiTone = s.aiTone === 'simple' ? 'simple' : 'technical';
  const syncWhen = S.lastSync
    ? new Date(S.lastSync).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : null;
  const initial = (S.user?.displayName ?? S.user?.email ?? 'U').trim().charAt(0).toUpperCase() || 'U';

  const cloudCard = S.user
    ? `<div class="space-y-4 pb-5 border-b border-white/10 xl:pb-0 xl:border-b-0 xl:border-r xl:border-white/10 xl:pr-6">
        <div class="flex items-start gap-3">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-electricBlue text-sm font-extrabold text-white shadow-sm">${esc(initial)}</div>
          <div class="min-w-0 flex-1">
            <h2 class="font-bold text-white">Cuenta y sincronización</h2>
            <p class="text-sm text-gray-200 truncate mt-0.5">${esc(S.user.displayName ?? 'Usuario')}</p>
            <p class="text-xs text-gray-400 truncate">${esc(S.user.email ?? '')}</p>
            <p class="text-xs text-emerald-400 mt-1">${S.syncing ? 'Sincronizando…' : syncWhen ? `Última sincronización: ${esc(syncWhen)}` : 'Conectado'}</p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2 border-t border-white/5 pt-3">
          <button class="btn" data-act="cloudSync" ${S.syncing ? 'disabled' : ''}>${icon('refresh', 'h-4 w-4')} Sincronizar ahora</button>
          <button class="btn btn-danger" data-act="cloudLogout" ${S.syncing ? 'disabled' : ''}>Cerrar sesión</button>
        </div>
      </div>`
    : `<div class="flex flex-col justify-between gap-4 pb-5 border-b border-white/10 xl:pb-0 xl:border-b-0 xl:border-r xl:border-white/10 xl:pr-6">
        <div class="space-y-1.5">
          <h2 class="font-bold text-white">Cuenta y sincronización</h2>
          <p class="text-xs text-gray-400 leading-relaxed">Inicia sesión con Google para sincronizar tus entrenamientos, medidas, sueño/FC y preferencias entre dispositivos, además de activar los informes de IA.</p>
        </div>
        <div>
          <button class="btn-primary" data-act="cloudLogin" ${S.syncing ? 'disabled' : ''}>${icon('login', 'h-4 w-4')} Iniciar sesión con Google</button>
        </div>
      </div>`;

  const toneCard = (id: AiTone, title: string, desc: string, badgeText: string) => {
    const active = tone === id;
    return `
      <button type="button" data-act="setAiTone" data-arg="${id}" aria-pressed="${active}" class="rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${active ? 'border-electricBlue bg-electricBlue/15' : 'border-white/10 bg-gray-900/50 hover:border-white/25'}">
        <div class="flex items-center justify-between gap-2">
          <span class="text-sm font-bold text-white">${title}</span>
          <span class="rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? 'bg-electricBlue text-white' : 'bg-gray-800 text-gray-400'}">${badgeText}</span>
        </div>
        <p class="mt-1.5 text-xs text-gray-300 leading-relaxed">${desc}</p>
      </button>`;
  };

  return `
  <div class="grid grid-cols-1 gap-6 xl:grid-cols-2 pb-5 border-b border-white/10">
    ${cloudCard}

    <div class="space-y-3">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 class="font-bold text-white">Perfil del atleta</h2>
          <p class="text-xs text-gray-400 mt-0.5">Se utiliza para calcular tu gasto energético diario y contextualizar el informe de IA.</p>
        </div>
        <button type="button" class="btn-sm btn-accent" data-act="openWizard">Asistente inicial</button>
      </div>
      <div class="grid grid-cols-3 gap-3">
        <label class="block"><span class="lbl">Sexo</span><select class="inp" data-change="pfSex"><option value="hombre" ${s.profile.sex === 'hombre' ? 'selected' : ''}>Hombre</option><option value="mujer" ${s.profile.sex === 'mujer' ? 'selected' : ''}>Mujer</option>${s.profile.sex && s.profile.sex !== 'hombre' && s.profile.sex !== 'mujer' ? `<option value="${esc(s.profile.sex)}" selected>${esc(s.profile.sex)}</option>` : ''}</select></label>
        <label class="block"><span class="lbl">Edad</span><input class="inp tabular-nums font-medium" type="number" min="12" max="110" value="${esc(s.profile.age)}" data-change="pfAge"></label>
        <label class="block"><span class="lbl">Altura (cm)</span><input class="inp tabular-nums font-medium" type="number" min="100" max="250" value="${esc(s.profile.height)}" data-change="pfHeight"></label>
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label class="block"><span class="lbl">Objetivo</span><select class="inp" data-change="pfGoal">
          <option value="" ${!s.profile.goal ? 'selected' : ''}>Sin definir</option>
          <option value="bulk" ${s.profile.goal === 'bulk' ? 'selected' : ''}>Ganar músculo</option>
          <option value="cut" ${s.profile.goal === 'cut' ? 'selected' : ''}>Definición</option>
          <option value="recomp" ${s.profile.goal === 'recomp' ? 'selected' : ''}>Perder grasa y ganar músculo</option>
          <option value="strength" ${s.profile.goal === 'strength' ? 'selected' : ''}>Fuerza máxima</option>
        </select></label>
        <label class="block"><span class="lbl">Experiencia</span><select class="inp" data-change="pfExp">
          <option value="" ${!s.profile.experience ? 'selected' : ''}>Sin definir</option>
          <option value="beginner" ${s.profile.experience === 'beginner' ? 'selected' : ''}>Principiante (&lt;1 año)</option>
          <option value="intermediate" ${s.profile.experience === 'intermediate' ? 'selected' : ''}>Intermedio (1–3 años)</option>
          <option value="advanced" ${s.profile.experience === 'advanced' ? 'selected' : ''}>Avanzado (+3 años)</option>
        </select></label>
        <label class="block"><span class="lbl">Días / semana</span><select class="inp tabular-nums" data-change="pfDays">
          <option value="" ${!s.profile.daysPerWeek ? 'selected' : ''}>Sin definir</option>
          ${[2, 3, 4, 5, 6].map((d) => `<option value="${d}" ${s.profile.daysPerWeek === d ? 'selected' : ''}>${d} días</option>`).join('')}
        </select></label>
      </div>
    </div>
  </div>

  <div class="pb-5 border-b border-white/10 space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 class="font-bold text-white">Preferencias del Coach IA</h2>
        <p class="text-xs text-gray-400 mt-0.5">Elige con qué profundidad y vocabulario redacta tu Coach IA tus resúmenes y recomendaciones.</p>
      </div>
      <span class="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${S.user ? 'border-emeraldGreen/40 bg-emeraldGreen/10 text-emerald-300' : 'border-amberGold/40 bg-amberGold/10 text-amber-300'}">${S.user ? 'Coach IA activo' : 'Requiere iniciar sesión'}</span>
    </div>

    <div class="grid grid-cols-1 gap-3 md:grid-cols-2" role="group" aria-label="Nivel técnico de la IA">
      ${toneCard(
        'simple',
        'Sencillo y generalista',
        'Tono cercano y directo sin tecnicismos. Resume peso, progresión de fuerza y descanso en recomendaciones prácticas fáciles de aplicar.',
        tone === 'simple' ? 'Activo' : 'Seleccionar',
      )}
      ${toneCard(
        'technical',
        'Técnico y detallado',
        'Análisis completo con fuerza máxima estimada (e1RM), recuperación (HRV), pulso, actividad diaria y consejos técnicos.',
        tone === 'technical' ? 'Activo' : 'Seleccionar',
      )}
    </div>

    <div class="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3 text-xs text-gray-400">
      <div class="space-y-0.5">
        ${s.ai ? `<p>Último informe guardado: ${fmtDate(s.ai.date)} · modo <span class="font-semibold text-gray-200">${s.ai.tone === 'simple' ? 'Sencillo' : 'Técnico'}</span></p>` : '<p>Genera resúmenes personalizados cuando registres tus entrenos.</p>'}
      </div>
      <button class="btn-sm" data-act="ai" ${S.busy === 'ai' ? 'disabled' : ''}>${icon('chart', 'h-3.5 w-3.5')} ${S.busy === 'ai' ? 'Analizando…' : 'Regenerar informe IA'}</button>
    </div>
  </div>

  <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
    <div>
      <h2 class="text-sm font-bold text-white">Accesos relacionados</h2>
      <p class="text-xs text-gray-400">La configuración de rutinas e importación de archivos tienen sus propias secciones dedicadas.</p>
    </div>
    <div class="flex flex-wrap gap-2">
      <button class="btn-sm" data-act="tab" data-arg="plan">Plan y rutinas</button>
      <button class="btn-sm" data-act="tab" data-arg="data">Datos y copias</button>
    </div>
  </div>`;
}
