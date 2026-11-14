import { epley, isoWeekStart, weeklyVolume } from '../lib/analysis';
import { MUSCLES } from '../lib/seed';
import { BASIC_MEASURE_KEYS, MEASURE_FIELDS, type DayName, type Measure } from '../types';
import { icon } from './icons';
import { chart, esc, fmtDate, kpi, noData, r1, routineColor, routineNames, routineShort, short, type State } from './shared';

const PERIM: Record<string, { label: string; keys: (keyof Measure)[] }> = {
  arms: { label: 'Brazos', keys: ['armL', 'armR'] },
  thighs: { label: 'Muslos', keys: ['thighL', 'thighR'] },
  trunk: { label: 'Torso / Cintura / Hombros / Glúteo', keys: ['torso', 'waist', 'shoulders', 'glute'] },
  calves: { label: 'Gemelos y rodillas', keys: ['calfL', 'calfR', 'kneeL', 'kneeR'] },
};
const PERIM_GROUPS: { title: string; keys: (keyof Measure)[] }[] = [
  { title: 'Torso y cadera', keys: ['torso', 'shoulders', 'glute'] },
  { title: 'Brazos', keys: ['armL', 'armR'] },
  { title: 'Piernas', keys: ['thighL', 'thighR', 'kneeL', 'kneeR', 'calfL', 'calfR'] },
];
const PERIM_ALL_KEYS: (keyof Measure)[] = PERIM_GROUPS.flatMap((g) => g.keys);
const PAL = ['#3B82F6', '#10B981', '#F59E0B', '#F43F5E', '#A78BFA', '#22D3EE'];

/** Renderiza la vista de medidas antropométricas y composición corporal. */
export function viewBody(S: State): string {
  const ms = S.measures;
  const today = new Date().toISOString().slice(0, 10);
  const activeDate = S.measureDate ?? today;
  const currentEntry = ms.find((m) => m.date === activeDate);
  const comp = ms.filter((m) => m.weight != null || m.bf != null || m.muscle != null);
  if (comp.length) {
    chart('c-comp', {
      type: 'line',
      data: {
        labels: comp.map((m) => short(m.date)),
        datasets: [
          { label: 'Peso (kg)', data: comp.map((m) => m.weight ?? null), borderColor: '#3B82F6', yAxisID: 'y', tension: 0.25, spanGaps: true },
          { label: 'Masa muscular (kg)', data: comp.map((m) => m.muscle ?? null), borderColor: '#10B981', yAxisID: 'y', tension: 0.25, spanGaps: true },
          { label: '% Grasa', data: comp.map((m) => m.bf ?? null), borderColor: '#F43F5E', yAxisID: 'y1', tension: 0.25, spanGaps: true },
        ],
      },
      options: { scales: { y1: { position: 'right', grid: { drawOnChartArea: false } } } },
    });
  }
  const pk = PERIM[S.perimeter] ?? PERIM.arms;
  const hasGroupPerim = ms.some((m) => pk.keys.some((k) => m[k] != null));
  if (hasGroupPerim) {
    chart('c-perim', {
      type: 'line',
      data: {
        labels: ms.map((m) => short(m.date)),
        datasets: pk.keys.map((k, i) => ({
          label: MEASURE_FIELDS.find((f) => f.key === k)!.label,
          data: ms.map((m) => (m[k] as number | undefined) ?? null),
          borderColor: PAL[i],
          tension: 0.25,
          spanGaps: true,
        })),
      },
    });
  }

  const basicFields = MEASURE_FIELDS.filter((f) => BASIC_MEASURE_KEYS.includes(f.key));
  const hasPerimsInCurrent = Boolean(currentEntry && PERIM_ALL_KEYS.some((k) => currentEntry[k] != null));
  const perimOpen = S.measurePerimOpen ?? hasPerimsInCurrent;
  const fieldInput = (f: (typeof MEASURE_FIELDS)[number]) => {
    const val = currentEntry?.[f.key] != null ? String(currentEntry[f.key]) : '';
    const lastKnown = [...ms].reverse().find((m) => m[f.key] != null)?.[f.key];
    const ph = typeof lastKnown === 'number' ? `Últ: ${r1(lastKnown)}` : '—';
    return `<label class="block"><span class="lbl">${f.label} (${f.unit})</span><input class="inp font-mono tabular-nums" inputmode="decimal" name="${f.key}" value="${esc(val)}" placeholder="${esc(ph)}"></label>`;
  };
  const visibleCols = MEASURE_FIELDS.filter((f) => ms.some((m) => m[f.key] != null));
  const tableCols = visibleCols.length ? visibleCols : basicFields;

  return `
  <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
    <div class="card"><h3 class="mb-2 font-bold text-white">Composición corporal (${comp.length} registros)</h3>
      ${comp.length ? `<div class="chart-box"><canvas id="c-comp"></canvas></div>` : `<p class="py-12 text-center text-sm text-gray-500">Añade tu peso o % de grasa abajo para ver la evolución.</p>`}</div>
    <div class="card"><div class="mb-2 flex items-center justify-between gap-2"><h3 class="font-bold text-white">Perímetros (cm)</h3>
      <select class="inp !w-auto" data-change="selPerim" aria-label="Grupo de perímetros">${Object.entries(PERIM).map(([k, v]) => `<option value="${k}" ${k === S.perimeter ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div>
      ${hasGroupPerim ? `<div class="chart-box"><canvas id="c-perim"></canvas></div>` : `<p class="py-12 text-center text-sm text-gray-500">Sin registros en ${esc(pk.label.toLowerCase())}. Puedes añadir medidas con cinta abajo si las controlas.</p>`}</div>
  </div>
  <form id="f-measure" class="card space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 class="font-bold text-white">Añadir / editar medición</h3>
        <p class="text-xs text-gray-400">Rellena solo lo que hayas medido hoy (el resto se muestra como referencia). Si guardas otro dato en la misma fecha, se combina sin borrar los anteriores.</p>
      </div>
      ${currentEntry ? `<div class="flex items-center gap-2"><span class="rounded-full border border-electricBlue/40 bg-electricBlue/15 px-2.5 py-0.5 text-[11px] font-semibold text-blue-200">Editando ${fmtDate(activeDate)}</span>${activeDate !== today ? `<button type="button" class="btn !py-1 !text-xs" data-act="clearMeasureDate">Ir a hoy</button>` : ''}</div>` : ''}
    </div>

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <label class="block"><span class="lbl">Fecha</span><input class="inp font-mono" type="date" name="date" value="${esc(activeDate)}" data-change="measureDate" required></label>
      ${basicFields.map(fieldInput).join('')}
      <label class="col-span-2 sm:col-span-1 lg:col-span-1 block"><span class="lbl">Nota (opcional)</span><input class="inp" name="note" value="${esc(currentEntry?.note ?? '')}" placeholder="p. ej. en ayunas…"></label>
    </div>

    <div>
      <button type="button" data-act="toggleMeasurePerim" aria-expanded="${perimOpen}" class="btn !py-1.5 !text-xs">
        ${perimOpen ? '− Ocultar perímetros con cinta' : '+ Añadir perímetros con cinta (opcional)'}
      </button>
    </div>

    ${perimOpen ? `
    <div class="space-y-3 rounded-xl border border-white/10 bg-gray-900/40 p-3.5">
      ${PERIM_GROUPS.map((g) => `
        <div class="space-y-2">
          <p class="text-[11px] font-bold uppercase tracking-wider text-gray-400">${esc(g.title)}</p>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            ${g.keys.map((k) => fieldInput(MEASURE_FIELDS.find((f) => f.key === k)!)).join('')}
          </div>
        </div>`).join('')}
    </div>` : ''}

    <div class="flex flex-wrap items-center gap-2">
      <button class="btn-primary" type="submit">${icon('save', 'h-4 w-4')} ${currentEntry ? 'Actualizar medición' : 'Guardar medición'}</button>
    </div>
  </form>
  <div class="card overflow-x-auto"><h3 class="mb-2 font-bold text-white">Registro histórico (N = ${ms.length})</h3>
    ${ms.length ? `<table class="w-full text-right text-xs"><thead class="text-gray-400"><tr><th class="py-1.5 pr-3 text-left">Fecha</th>${tableCols.map((f) => `<th class="px-2">${f.label}</th>`).join('')}<th class="pl-2"></th></tr></thead><tbody>
    ${[...ms].reverse().map((m) => `<tr class="border-t border-gray-800 font-mono tabular-nums ${m.date === activeDate ? 'bg-electricBlue/10' : ''}"><td class="py-1.5 pr-3 text-left whitespace-nowrap">${fmtDate(m.date)}${m.note ? `<div class="font-sans text-[10px] text-amberGold">${esc(m.note)}</div>` : ''}</td>${tableCols.map((f) => `<td class="px-2">${esc(m[f.key] ?? '')}</td>`).join('')}<td class="pl-2 whitespace-nowrap"><button class="rounded p-1 text-blue-300 hover:bg-electricBlue/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" data-act="editMeasure" data-arg="${esc(m.date)}" aria-label="Editar medición del ${fmtDate(m.date)}">${icon('edit', 'h-3.5 w-3.5')}</button><button class="rounded p-1 text-coralRed hover:bg-coralRed/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue" data-act="delMeasure" data-arg="${esc(m.date)}" aria-label="Borrar medición del ${fmtDate(m.date)}">${icon('close', 'h-3.5 w-3.5')}</button></td></tr>`).join('')}
    </tbody></table>` : `<p class="py-6 text-center text-sm text-gray-500">Todavía no hay mediciones guardadas.</p>`}</div>`;
}

/** Renderiza la matriz de series efectivas semanales por grupo muscular. */
export function viewVolume(S: State): string {
  const vol = weeklyVolume(S.strength, S.settings);
  const wk0 = isoWeekStart(new Date().toISOString().slice(0, 10));
  const weeks: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(wk0 + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - i * 7);
    weeks.push(d.toISOString().slice(0, 10));
  }
  const color = (v: number) => (v === 0 ? 'text-gray-600' : v < 8 ? 'text-coralRed' : v <= 20 ? 'text-emeraldGreen' : 'text-amberGold');
  const mark = (v: number) => (v === 0 ? '' : v < 8 ? '<span class="sr-only"> (bajo)</span><span aria-hidden="true">↓</span>' : v > 20 ? '<span class="sr-only"> (alto)</span><span aria-hidden="true">↑</span>' : '');
  const sel = S.muscleSel || 'Pecho';
  chart('c-vol', { type: 'bar', data: { labels: weeks.map(short), datasets: [{ label: `Series efectivas · ${sel}`, data: weeks.map((w) => vol.get(sel)?.get(w) ?? 0), backgroundColor: '#3B82F6' }] } });
  return `${noData(S)}
  <div class="card overflow-x-auto"><h3 class="mb-1 font-bold text-white">Series efectivas por músculo y semana</h3>
    <p class="mb-2 text-xs text-gray-400">Músculo principal = 1 serie, secundario = 0,5. <span class="text-coralRed">&lt;8↓ bajo</span> · <span class="text-emeraldGreen">8–20 óptimo</span> · <span class="text-amberGold">&gt;20↑ alto</span>. La última columna es la semana en curso.</p>
    <table class="w-full min-w-[640px] text-center text-xs"><thead class="text-gray-400"><tr><th class="py-1.5 text-left">Músculo</th>${weeks.map((w) => `<th class="font-mono tabular-nums">${short(w)}</th>`).join('')}</tr></thead><tbody>
    ${MUSCLES.map((m) => `<tr class="border-t border-gray-800"><td class="py-1.5 text-left font-semibold"><button data-act="selMuscle" data-arg="${m}" aria-pressed="${m === sel}" class="rounded px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricBlue ${m === sel ? 'text-electricBlue' : 'hover:text-white'}">${m}</button></td>${weeks.map((w) => { const v = vol.get(m)?.get(w) ?? 0; return `<td class="font-mono tabular-nums font-bold ${color(v)}">${v ? `${r1(v)}${mark(v)}` : '·'}</td>`; }).join('')}</tr>`).join('')}
    </tbody></table></div>
  <div class="card"><h3 class="mb-2 font-bold text-white">Tendencia · ${sel}</h3><div class="chart-box"><canvas id="c-vol"></canvas></div></div>`;
}

/** Renderiza el calendario de adherencia semanal y rachas de entrenamiento. */
export function viewAdherence(S: State): string {
  const routines = routineNames(S.settings);
  const byDate = new Map<string, DayName | null>();
  S.analysis.sessions.forEach((s) => { if (!byDate.has(s.date) || s.day) byDate.set(s.date, s.day ?? byDate.get(s.date) ?? null); });
  const wk0 = isoWeekStart(new Date().toISOString().slice(0, 10));
  const W = 20;
  const cols: string[] = [];
  for (let i = W - 1; i >= 0; i--) {
    const d = new Date(wk0 + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - i * 7);
    cols.push(d.toISOString().slice(0, 10));
  }
  const dn = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const cell = (w: string, di: number) => {
    const d = new Date(w + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + di);
    const iso = d.toISOString().slice(0, 10);
    const t = byDate.get(iso);
    const has = byDate.has(iso);
    const rIdx = t ? routines.indexOf(t) : -1;
    const bg = has ? (t ? routineColor(t, S.settings, Math.max(0, rIdx)) : '#6B7280') : 'rgba(255,255,255,0.05)';
    const label = `${fmtDate(iso)}: ${has ? (t ?? 'Otro entrenamiento') : 'Sin sesión'}`;
    const code = has ? (t ? routineShort(t) : '·') : '';
    return `<div role="img" aria-label="${esc(label)}" title="${esc(label)}" class="flex h-5 w-5 items-center justify-center rounded-[4px] text-[9px] font-extrabold text-white/95" style="background:${bg}">${code}</div>`;
  };
  const perWeek = new Map<string, number>();
  byDate.forEach((_, d) => { const w = isoWeekStart(d); perWeek.set(w, (perWeek.get(w) ?? 0) + 1); });
  const last8 = cols.slice(-9, -1);
  const avg = last8.reduce((a, w) => a + (perWeek.get(w) ?? 0), 0) / 8;
  let streak = 0;
  for (let i = cols.length - 2; i >= 0 && (perWeek.get(cols[i]) ?? 0) >= 3; i--) streak++;
  const counts: Record<string, number> = Object.fromEntries(routines.map((r) => [r, 0]));
  const lim = cols[cols.length - 9];
  byDate.forEach((t, d) => { if (t && d >= lim) counts[t] = (counts[t] ?? 0) + 1; });
  const cardio = S.cardio.filter((c) => c.date >= lim);
  const well56 = S.wellbeing.filter((w) => w.date >= lim);
  const hasSleep = well56.some((w) => w.sleepMin != null || w.hrv != null);
  const hasSteps = well56.some((w) => w.steps != null);
  if (hasSleep) {
    chart('c-well-sleep', {
      type: 'line',
      data: {
        labels: well56.map((w) => short(w.date)),
        datasets: [
          { label: 'Sueño (h)', data: well56.map((w) => (w.sleepMin != null ? Math.round((w.sleepMin / 60) * 10) / 10 : null)), borderColor: '#3B82F6', yAxisID: 'y', tension: 0.25, spanGaps: true },
          { label: 'HRV (ms)', data: well56.map((w) => w.hrv ?? null), borderColor: '#10B981', yAxisID: 'y1', tension: 0.25, spanGaps: true },
        ],
      },
      options: { interaction: { mode: 'index', intersect: false }, scales: { y: { position: 'left' }, y1: { position: 'right', grid: { drawOnChartArea: false } } } },
    });
  }
  if (hasSteps) {
    chart('c-well-steps', {
      type: 'bar',
      data: {
        labels: well56.map((w) => short(w.date)),
        datasets: [{ label: 'Pasos diarios', data: well56.map((w) => w.steps ?? 0), backgroundColor: '#F59E0B' }],
      },
    });
  }
  return `${noData(S)}
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    ${kpi('Media semanal (8 sem.)', r1(avg), 'días entrenados')}
    ${kpi('Racha ≥3 días/sem.', String(streak), 'semanas completas')}
    ${kpi('Reparto (8 sem.)', routines.map((r) => counts[r] ?? 0).join('/'), routines.map((r) => routineShort(r)).join(' / '))}
    ${kpi('Cardio (8 sem.)', String(cardio.length), `${r1(cardio.reduce((a, c) => a + c.distKm, 0))} km · ${Math.round(cardio.reduce((a, c) => a + c.durMin, 0))} min`)}
  </div>
  <div class="card overflow-x-auto"><h3 class="mb-2 font-bold text-white">Calendario (últimas ${W} semanas)</h3>
    <div class="flex gap-1.5"><div class="flex flex-col gap-1.5 pr-1 text-[10px] text-gray-500">${dn.map((x) => `<div class="flex h-5 items-center">${x}</div>`).join('')}</div>
    ${cols.map((w) => `<div class="flex flex-col gap-1.5">${[0, 1, 2, 3, 4, 5, 6].map((i) => cell(w, i)).join('')}</div>`).join('')}</div>
    <div class="mt-3 flex flex-wrap gap-3 text-xs text-gray-400">${routines.map((d, idx) => `<span class="inline-flex items-center gap-1"><span class="inline-flex h-4 w-4 items-center justify-center rounded text-[9px] font-extrabold text-white" style="background:${routineColor(d, S.settings, idx)}">${esc(routineShort(d))}</span>${esc(d)}</span>`).join('')}<span class="inline-flex items-center gap-1"><span class="inline-flex h-4 w-4 items-center justify-center rounded bg-gray-500 text-[9px] font-extrabold text-white">·</span>Otro</span></div></div>
  ${hasSleep || hasSteps ? `
  <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
    ${hasSleep ? `<div class="card"><h3 class="mb-2 font-bold text-white">Sueño y HRV nocturna (8 sem.)</h3><div class="chart-box"><canvas id="c-well-sleep"></canvas></div></div>` : ''}
    ${hasSteps ? `<div class="card"><h3 class="mb-2 font-bold text-white">Pasos diarios · NEAT (8 sem.)</h3><div class="chart-box"><canvas id="c-well-steps"></canvas></div></div>` : ''}
  </div>` : ''}
  ${S.cardio.length ? `
  <div class="card overflow-x-auto"><h3 class="mb-2 font-bold text-white">Últimas sesiones de cardio (${S.cardio.length})</h3>
    <table class="w-full text-left text-xs"><thead class="uppercase text-gray-400"><tr><th class="py-1.5 pr-3">Fecha</th><th class="pr-3 text-right">Duración</th><th class="pr-3 text-right">Distancia</th><th class="pr-3 text-right">FC media</th><th class="pr-3 text-right">Kcal</th><th class="text-right">VO2 máx</th></tr></thead><tbody>
    ${[...S.cardio].reverse().slice(0, 12).map((c) => `<tr class="border-t border-gray-800 font-mono tabular-nums"><td class="py-1.5 pr-3">${fmtDate(c.date)}</td><td class="pr-3 text-right">${r1(c.durMin)} min</td><td class="pr-3 text-right">${r1(c.distKm)} km</td><td class="pr-3 text-right text-cyan-300">${c.avgHr ? `${Math.round(c.avgHr)} lpm` : '—'}</td><td class="pr-3 text-right">${c.kcal || '—'}</td><td class="text-right text-emeraldGreen">${c.vo2 ? r1(c.vo2) : '—'}</td></tr>`).join('')}
    </tbody></table></div>` : ''}`;
}

/** Renderiza la calculadora de 1RM y el planificador nutricional Katch-McArdle. */
export function viewCalc(S: State): string {
  const w = [...S.measures].reverse().find((m) => m.weight != null)?.weight ?? 70;
  const bf = [...S.measures].reverse().find((m) => m.bf != null)?.bf ?? 15;
  const presets = routineNames(S.settings).flatMap((d) => S.analysis.byDay[d] ?? []).filter((e) => e.last).map((e) => {
    const best = e.last!.sets.filter((s) => s.w === e.last!.top).sort((a, b) => b.r - a.r)[0];
    return { n: e.name, w: best.w, r: best.r };
  });
  const first = presets[0] ?? { w: 50, r: 9 };
  return `<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
  <div class="card space-y-3"><h3 class="font-bold text-white">Calculadora de 1RM</h3>
    <label class="block"><span class="lbl">Cargar marca de tu última sesión</span><select id="calcPreset" class="inp" data-change="calcPreset">${presets.map((p) => `<option value="${esc(p.w)}|${esc(p.r)}">${esc(p.n)} (${esc(p.w)} kg × ${esc(p.r)})</option>`).join('')}</select></label>
    <div class="grid grid-cols-3 gap-3">
      <label class="block"><span class="lbl">Peso (kg)</span><input id="calcW" class="inp font-mono tabular-nums" type="number" step="0.5" value="${first.w}" data-input="calc"></label>
      <label class="block"><span class="lbl">Reps</span><input id="calcR" class="inp font-mono tabular-nums" type="number" min="1" max="30" value="${first.r}" data-input="calc"></label>
      <label class="block"><span class="lbl">RIR (0-5)</span><input id="calcRir" class="inp font-mono tabular-nums" type="number" min="0" max="5" value="1" data-input="calc"></label></div>
    <div class="grid grid-cols-3 gap-3 text-center" id="calcOut"></div>
    <div class="grid grid-cols-2 gap-2 text-center text-xs font-mono tabular-nums sm:grid-cols-4" id="calcZones"></div></div>
  <div class="card space-y-3"><h3 class="font-bold text-white">Planificador nutricional (${r1(w)} kg · ${r1(bf)}% BF)</h3>
    <p class="text-xs text-gray-400">Katch-McArdle con tu masa libre de grasa real (${r1(w * (1 - bf / 100))} kg). Usa tu última medición.</p>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label class="block"><span class="lbl">Actividad</span><select id="nuAct" class="inp" data-change="nutri"><option value="1.55">Fuerza 3-4 días (×1,55)</option><option value="1.65" selected>Fuerza 5-6 días + pasos (×1,65)</option><option value="1.75">Intenso (×1,75)</option></select></label>
      <label class="block"><span class="lbl">Fase energética</span><select id="nuGoal" class="inp" data-change="nutri"><option value="0">Mantenimiento (+0)</option><option value="225" selected>Lean bulk (+225)</option><option value="350">Superávit estándar (+350)</option><option value="-350">Mini-cut (−350)</option></select></label></div>
    <input type="hidden" id="nuW" value="${w}"><input type="hidden" id="nuBf" value="${bf}">
    <div class="grid grid-cols-3 gap-3 text-center" id="nuOut"></div><div class="grid grid-cols-3 gap-3" id="nuMacros"></div></div></div>`;
}

/** Recalcula los resultados de 1RM y macros en la vista de Calculadoras. */
export function runCalc() {
  const g = (id: string) => document.getElementById(id) as HTMLInputElement | null;
  if (g('calcW')) {
    const w = parseFloat(g('calcW')!.value) || 0, r = parseInt(g('calcR')!.value, 10) || 1, rir = parseInt(g('calcRir')!.value, 10) || 0;
    const e = epley(w, r), e2 = w * (1 + (r + rir) / 30);
    document.getElementById('calcOut')!.innerHTML = [['1RM (Epley)', e, 'text-electricBlue'], ['1RM ajustado RIR', e2, 'text-emeraldGreen']]
      .map(([l, v, c]) => `<div class="rounded-xl border border-gray-800 bg-gray-900 p-3"><span class="block text-xs text-gray-400">${l}</span><span class="font-mono tabular-nums text-xl font-extrabold ${c}">${r1(v as number)} kg</span></div>`).join('') +
      `<div class="rounded-xl border border-gray-800 bg-gray-900 p-3"><span class="block text-xs text-gray-400">Ratio / peso</span><span class="font-mono tabular-nums text-xl font-extrabold text-amberGold">${(e / (parseFloat(g('nuW')?.value ?? '70') || 70)).toFixed(2)}×</span></div>`;
    document.getElementById('calcZones')!.innerHTML = [[0.85, '5–6 reps'], [0.8, '7–8 reps'], [0.75, '9–10 reps'], [0.7, '11–12 reps']]
      .map(([p, l]) => `<div class="rounded-lg border border-gray-800 bg-gray-900 p-2"><span class="block text-[11px] text-gray-400">${Math.round((p as number) * 100)}% · ${l}</span><b>${r1(e * (p as number))} kg</b></div>`).join('');
  }
  if (g('nuW')) {
    const w = parseFloat(g('nuW')!.value), bf = parseFloat(g('nuBf')!.value);
    const lbm = w * (1 - bf / 100), bmr = Math.round(370 + 21.6 * lbm);
    const tdee = Math.round(bmr * parseFloat((document.getElementById('nuAct') as HTMLSelectElement).value));
    const target = tdee + parseInt((document.getElementById('nuGoal') as HTMLSelectElement).value, 10);
    const p = Math.round(w * 2.2), f = Math.round(w), pk = p * 4, fk = f * 9, ck = Math.max(0, target - pk - fk);
    const box = (l: string, v: string, c = 'text-white') => `<div class="rounded-xl border border-gray-800 bg-gray-900 p-3 text-center"><span class="block text-[11px] text-gray-400">${l}</span><span class="font-mono tabular-nums text-lg font-extrabold ${c}">${v}</span></div>`;
    document.getElementById('nuOut')!.innerHTML = box('TMB', `${bmr} kcal`) + box('TDEE', `${tdee} kcal`, 'text-electricBlue') + box('Objetivo', `${target} kcal`, 'text-emeraldGreen');
    document.getElementById('nuMacros')!.innerHTML = box('Proteína 2,2 g/kg', `${p} g`, 'text-coralRed') + box('Grasas 1 g/kg', `${f} g`, 'text-amberGold') + box('Carbohidratos', `${Math.round(ck / 4)} g`, 'text-electricBlue');
  }
}
