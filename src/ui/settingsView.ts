import { isAppCheckConfigured } from '../lib/firebase';
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
            <h3 class="font-bold text-white">Cuenta y nube (Firebase)</h3>
            <p class="text-sm text-gray-200 truncate mt-0.5">${esc(S.user.displayName ?? 'Usuario')}</p>
            <p class="text-xs text-gray-400 truncate">${esc(S.user.email ?? '')}</p>
            <p class="text-xs text-emerald-400 mt-1">${S.syncing ? 'Sincronizando…' : syncWhen ? `Última sincronización: ${esc(syncWhen)}` : 'Conectado'}</p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2 border-t border-white/5 pt-3">
          <button class="btn" data-act="cloudSync" ${S.syncing ? 'disabled' : ''}>${icon('refresh', 'h-4 w-4')} Sincronizar ahora</button>
          <button class="btn !border-coralRed/50 text-coralRed" data-act="cloudLogout" ${S.syncing ? 'disabled' : ''}>Cerrar sesión</button>
        </div>
      </div>`
    : `<div class="flex flex-col justify-between gap-4 pb-5 border-b border-white/10 xl:pb-0 xl:border-b-0 xl:border-r xl:border-white/10 xl:pr-6">
        <div class="space-y-1.5">
          <h3 class="font-bold text-white">Cuenta y nube (Firebase)</h3>
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
      <div>
        <h3 class="font-bold text-white">Perfil del atleta</h3>
        <p class="text-xs text-gray-400 mt-0.5">Se utiliza para calcular tu gasto energético (Katch-McArdle) y contextualizar el informe de IA.</p>
      </div>
      <div class="grid grid-cols-3 gap-3">
        <label class="block"><span class="lbl">Sexo</span><input class="inp" value="${esc(s.profile.sex)}" data-change="pfSex"></label>
        <label class="block"><span class="lbl">Edad</span><input class="inp tabular-nums font-medium" type="number" value="${esc(s.profile.age)}" data-change="pfAge"></label>
        <label class="block"><span class="lbl">Altura (cm)</span><input class="inp tabular-nums font-medium" type="number" value="${esc(s.profile.height)}" data-change="pfHeight"></label>
      </div>
    </div>
  </div>

  <div class="pb-5 border-b border-white/10 space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 class="font-bold text-white">Preferencias del Coach IA</h3>
        <p class="text-xs text-gray-400 mt-0.5">Elige con qué profundidad y vocabulario redacta Gemini tus resúmenes y recomendaciones.</p>
      </div>
      <span class="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${S.user ? 'border-emeraldGreen/40 bg-emeraldGreen/10 text-emerald-300' : 'border-amberGold/40 bg-amberGold/10 text-amber-300'}">${S.user ? 'Conectado · Firebase AI Logic' : 'Requiere iniciar sesión'}</span>
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
        'Análisis fisiológico completo con e1RM, HRV, pulso intra-entreno, fatiga del SNC, NEAT, biomecánica y estrategia por mesociclo.',
        tone === 'technical' ? 'Activo' : 'Seleccionar',
      )}
    </div>

    <div class="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3 text-xs text-gray-400">
      <div class="space-y-0.5">
        <p>App Check (reCAPTCHA Enterprise): <span class="${isAppCheckConfigured ? 'text-emerald-400' : 'text-amberGold'} font-semibold">${isAppCheckConfigured ? 'configurado' : 'pendiente de VITE_RECAPTCHA_SITE_KEY'}</span></p>
        ${s.ai ? `<p>Último informe guardado: ${fmtDate(s.ai.date)} · modo <span class="font-semibold text-gray-200">${s.ai.tone === 'simple' ? 'Sencillo' : 'Técnico'}</span></p>` : ''}
      </div>
      <button class="btn !py-1.5 !text-xs" data-act="ai" ${S.busy === 'ai' ? 'disabled' : ''}>${icon('chart', 'h-3.5 w-3.5')} ${S.busy === 'ai' ? 'Analizando…' : 'Regenerar informe IA'}</button>
    </div>
  </div>

  <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
    <div>
      <h3 class="text-sm font-bold text-white">Accesos relacionados</h3>
      <p class="text-xs text-gray-400">La configuración de rutinas e importación de archivos tienen sus propias secciones dedicadas.</p>
    </div>
    <div class="flex flex-wrap gap-2">
      <button class="btn !py-1.5 !text-xs" data-act="tab" data-arg="plan">Plan y rutinas</button>
      <button class="btn !py-1.5 !text-xs" data-act="tab" data-arg="data">Importar y backups</button>
    </div>
  </div>`;
}
