import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { analyze } from './lib/analysis';
import { generateAnalysis } from './lib/ai';
import { deleteKey, exportBackup, getAll, importBackup, loadSettings, putMany, saveSettings, wipeAll, type Backup } from './lib/db';
import { importSamsungFiles } from './lib/samsung';
import { parseMeasuresCsv } from './lib/measures';
import { MEASURE_FIELDS, type CardioRow, type DayName, type LogDraft, type Measure, type StrengthRow } from './types';
import { norm } from './lib/seed';
import { icon } from './ui/icons';
import { defaultSetsForEx, initLogDraft, resetCharts, runChartJobs, runCalc, viewAdherence, viewBody, viewCalc, viewDay, viewHome, viewLog, viewSettings, viewVolume, type State } from './ui/views';

registerSW({ immediate: true });

const TABS: [string, string][] = [
  ['home', 'Resumen'], ['log', '+ Entrenar'], ['Push', 'Push'], ['Pull', 'Pull'], ['Leg', 'Leg'],
  ['body', 'Cuerpo'], ['volume', 'Volumen'], ['adherence', 'Adherencia'], ['calc', 'Calculadoras'], ['settings', 'Ajustes'],
];
const TAB_IDS = new Set(TABS.map(([k]) => k));
const initialTab = () => {
  const hash = location.hash.slice(1);
  return TAB_IDS.has(hash) ? hash : 'home';
};

const DRAFT_KEY = 'gymapp_log_draft';
function loadDraft(): LogDraft | undefined {
  try { const raw = localStorage.getItem(DRAFT_KEY); return raw ? (JSON.parse(raw) as LogDraft) : undefined; }
  catch { return undefined; }
}
function saveDraft(d?: LogDraft) {
  try { if (d) localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); else localStorage.removeItem(DRAFT_KEY); }
  catch { /* ignore quota errors */ }
}

const S = { tab: initialTab(), sel: {}, perimeter: 'arms', muscleSel: 'Pecho', logDraft: loadDraft() } as State;
const root = document.getElementById('app')!;

function setTab(tab: string) {
  S.tab = TAB_IDS.has(tab) ? tab : 'home';
  if (location.hash.slice(1) !== S.tab) history.replaceState(null, '', `#${S.tab}`);
}

async function reload() {
  S.settings = await loadSettings();
  S.strength = (await getAll<StrengthRow>('strength')).sort((a, b) => a.ts - b.ts);
  S.cardio = (await getAll<CardioRow>('cardio')).sort((a, b) => a.ts - b.ts);
  S.measures = (await getAll<Measure>('measures')).sort((a, b) => a.date.localeCompare(b.date));
  S.analysis = analyze(S.strength, S.settings);
}

function toast(msg: string) {
  S.toast = msg; render();
  setTimeout(() => { if (S.toast === msg) { S.toast = undefined; render(); } }, 5000);
}

function view(): string {
  switch (S.tab) {
    case 'home': return viewHome(S);
    case 'log': return viewLog(S);
    case 'Push': case 'Pull': case 'Leg': return viewDay(S, S.tab as DayName);
    case 'body': return viewBody(S);
    case 'volume': return viewVolume(S);
    case 'adherence': return viewAdherence(S);
    case 'calc': return viewCalc(S);
    default: return viewSettings(S);
  }
}

function focusSelector(el: Element | null): string | null {
  if (!(el instanceof HTMLElement)) return null;
  if (el.id) return `#${CSS.escape(el.id)}`;
  if (el.dataset.act) {
    const argVal = el.dataset.arg != null ? `[data-arg="${CSS.escape(el.dataset.arg)}"]` : '';
    return `[data-act="${CSS.escape(el.dataset.act)}"]${argVal}`;
  }
  if (el.dataset.change) {
    const argVal = el.dataset.arg != null ? `[data-arg="${CSS.escape(el.dataset.arg)}"]` : '';
    return `[data-change="${CSS.escape(el.dataset.change)}"]${argVal}`;
  }
  return null;
}

/** Re-renderiza el panel preservando posición de scroll y foco del control activo. */
function render() {
  const y = window.scrollY;
  const activeSel = focusSelector(document.activeElement);
  resetCharts();
  const html = view();
  root.innerHTML = `
  <header class="sticky top-0 z-30 border-b border-gray-800 bg-bgDark/90 px-3 pb-2 pt-[max(env(safe-area-inset-top),0.5rem)] backdrop-blur">
    <div class="mx-auto flex max-w-6xl items-center gap-2.5 pb-2">
      <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-electricBlue to-emeraldGreen text-white shadow-sm">${icon('barbell', 'h-5 w-5')}</div>
      <div><h1 class="text-base font-extrabold leading-tight text-white">Panel de rendimiento PPL</h1><p class="text-[11px] text-gray-500 tabular-nums">${S.strength.length ? `${S.analysis.sessions.length} sesiones · ${S.measures.length} medidas` : 'sin datos importados'}</p></div></div>
    <nav role="tablist" aria-label="Secciones del panel" class="mx-auto flex max-w-6xl gap-2 overflow-x-auto pb-1">${TABS.map(([k, l]) => `<button role="tab" aria-selected="${S.tab === k}" data-act="tab" data-arg="${k}" class="tab ${S.tab === k ? 'tab-on' : ''}">${l}</button>`).join('')}</nav></header>
  <main id="main-content" tabindex="-1" class="mx-auto max-w-6xl space-y-4 p-3 pb-24 sm:p-5 focus:outline-none">${html}</main>
  ${S.toast ? `<div role="status" aria-live="polite" class="fixed inset-x-3 bottom-4 z-40 mx-auto max-w-md rounded-xl border border-electricBlue/40 bg-gray-900 p-3 text-sm shadow-xl">${S.toast}</div>` : ''}`;
  runChartJobs(); runCalc();
  window.scrollTo(0, y);
  if (activeSel) root.querySelector<HTMLElement>(activeSel)?.focus({ preventScroll: true });
}

const num = (v: string) => { const n = parseFloat(v.replace(',', '.')); return Number.isFinite(n) ? n : undefined; };
const arg = (el: HTMLElement) => el.dataset.arg ?? '';
async function persist() { await saveSettings(S.settings); S.analysis = analyze(S.strength, S.settings); render(); }
function download(name: string, data: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; a.click();
}

function addExToDraft(name: string) {
  const clean = name.trim();
  if (!clean) return;
  const today = new Date().toISOString().slice(0, 10);
  const draft = S.logDraft ?? (S.logDraft = initLogDraft(S, 'Push', today));
  const existing = draft.exercises.find((e) => norm(e.name) === norm(clean));
  if (existing) existing.done = true;
  else draft.exercises.push({ name: clean, done: true, sets: defaultSetsForEx(S, clean), note: '' });
  saveDraft(draft);
  render();
}

const actions: Record<string, (el: HTMLElement) => void | Promise<void>> = {
  tab: (el) => { setTab(arg(el)); render(); window.scrollTo(0, 0); },
  goLog: (el) => {
    const day = arg(el) as DayName | '';
    const today = new Date().toISOString().slice(0, 10);
    if (day) {
      S.logDraft = initLogDraft(S, day, S.logDraft?.date ?? today);
      saveDraft(S.logDraft);
    } else if (!S.logDraft) {
      S.logDraft = initLogDraft(S, 'Push', today);
      saveDraft(S.logDraft);
    }
    setTab('log'); render(); window.scrollTo(0, 0);
  },
  logDay: (el) => {
    const day = arg(el) as DayName | 'Libre';
    const date = S.logDraft?.date ?? new Date().toISOString().slice(0, 10);
    S.logDraft = initLogDraft(S, day, date);
    saveDraft(S.logDraft);
    render();
  },
  logReset: () => {
    if (!confirm('¿Reiniciar el borrador actual a los valores por defecto de la rutina?')) return;
    const day = S.logDraft?.day ?? 'Push';
    const date = S.logDraft?.date ?? new Date().toISOString().slice(0, 10);
    S.logDraft = initLogDraft(S, day, date);
    saveDraft(S.logDraft);
    render();
  },
  logToggleEx: (el) => {
    const ex = S.logDraft?.exercises[+arg(el)];
    if (!ex) return;
    ex.done = !ex.done;
    saveDraft(S.logDraft);
    render();
  },
  logRemoveEx: (el) => {
    if (!S.logDraft) return;
    S.logDraft.exercises.splice(+arg(el), 1);
    saveDraft(S.logDraft);
    render();
  },
  logAddEx: () => {
    const sel = document.getElementById('logAddSelect') as HTMLSelectElement | null;
    if (sel?.value) addExToDraft(sel.value);
  },
  logAddCustomEx: () => {
    const inp = document.getElementById('logNewExName') as HTMLInputElement | null;
    if (inp?.value.trim()) addExToDraft(inp.value);
  },
  logAddQuick: (el) => addExToDraft(arg(el)),
  logAddSet: (el) => {
    const ex = S.logDraft?.exercises[+arg(el)];
    if (!ex) return;
    const last = ex.sets[ex.sets.length - 1];
    ex.sets.push(last ? { ...last } : { w: 0, r: 10 });
    saveDraft(S.logDraft);
    render();
  },
  logDelSet: (el) => {
    const [ei, si] = arg(el).split('|').map(Number);
    const ex = S.logDraft?.exercises[ei];
    if (!ex) return;
    ex.sets.splice(si, 1);
    if (!ex.sets.length) ex.done = false;
    saveDraft(S.logDraft);
    render();
  },
  logStepW: (el) => {
    const [ei, si, step] = arg(el).split('|').map(Number);
    const s = S.logDraft?.exercises[ei]?.sets[si];
    if (!s) return;
    s.w = Math.max(0, Math.round((s.w + step) * 10) / 10);
    saveDraft(S.logDraft);
    render();
  },
  logStepR: (el) => {
    const [ei, si, step] = arg(el).split('|').map(Number);
    const s = S.logDraft?.exercises[ei]?.sets[si];
    if (!s) return;
    s.r = Math.max(0, s.r + step);
    saveDraft(S.logDraft);
    render();
  },
  logSave: async () => {
    const draft = S.logDraft;
    if (!draft) return;
    const active = draft.exercises.filter((e) => e.done);
    const rows: StrengthRow[] = [];
    const ts = Date.parse(`${draft.date}T12:00:00Z`) || Date.now();
    for (const ex of active) {
      const sets = ex.sets.filter((s) => s.r > 0).map((s) => ({ w: Math.max(0, Number(s.w) || 0), r: Math.max(1, Math.round(Number(s.r) || 0)) }));
      if (!sets.length) continue;
      rows.push({
        id: `manual-${draft.date}-${norm(ex.name)}`,
        sessionId: `manual-${draft.date}`,
        ts,
        date: draft.date,
        ref: `name:${ex.name.trim()}`,
        sets,
        ...(ex.note.trim() ? { note: ex.note.trim() } : {}),
        ...(draft.day !== 'Libre' ? { day: draft.day } : {}),
      });
    }
    if (!rows.length) { toast('Marca al menos un ejercicio con series y repeticiones (> 0).'); return; }
    const oldManual = S.strength.filter((r) => r.id.startsWith('manual-') && r.date === draft.date);
    for (const r of oldManual) await deleteKey('strength', r.id);
    await putMany('strength', rows);
    const savedDay = draft.day;
    S.logDraft = undefined;
    saveDraft(undefined);
    await reload();
    if (savedDay !== 'Libre') setTab(savedDay);
    toast(`Sesión guardada: ${rows.length} ejercicios.`);
  },
  logEditSession: (el) => {
    const [date, day] = arg(el).split('|');
    S.logDraft = initLogDraft(S, (day as DayName | 'Libre') || 'Libre', date);
    saveDraft(S.logDraft);
    render();
    window.scrollTo(0, 0);
  },
  logDelSession: async (el) => {
    const [sessionId, date] = arg(el).split('|');
    if (!confirm(`¿Borrar la sesión manual del ${date}?`)) return;
    const toDel = S.strength.filter((r) => r.id.startsWith('manual-') && (r.sessionId === sessionId || r.date === date));
    for (const r of toDel) await deleteKey('strength', r.id);
    await reload();
    toast('Sesión manual borrada.');
  },
  selEx: (el) => { const [d, n] = arg(el).split('|'); S.sel[d] = n; render(); },
  selMuscle: (el) => { S.muscleSel = arg(el); render(); },
  delMeasure: async (el) => { if (!confirm('¿Borrar esta medición?')) return; await deleteKey('measures', arg(el)); await reload(); render(); },
  editNote: async (el) => {
    const n = arg(el); const v = prompt(`Nota biomecánica para «${n}»`, S.settings.notes[n] ?? '');
    if (v == null) return; S.settings.notes[n] = v; await persist();
  },
  ai: async () => {
    if (S.busy) return; S.busy = 'ai'; render();
    try { S.settings.ai = await generateAnalysis(S.analysis, S.measures, S.settings); await saveSettings(S.settings); toast('Análisis generado.'); }
    catch (e) { toast(`Error de IA: ${(e as Error).message}`); }
    S.busy = undefined; render();
  },
  export: async () => download(`gymapp-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(await exportBackup()), 'application/json'),
  wipe: async () => { if (!confirm('Se borrarán todos los datos de este dispositivo. ¿Seguro?')) return; await wipeAll(); await reload(); toast('Datos borrados.'); },
  rtAdd: async (el) => { S.settings.routines[arg(el) as DayName].push({ name: '', sets: 2, reps: 10 }); await persist(); },
  rtDel: async (el) => { const [d, i] = arg(el).split('|'); S.settings.routines[d as DayName].splice(+i, 1); await persist(); },
  merge: async () => {
    const f = (document.getElementById('mergeFrom') as HTMLSelectElement).value; const t = (document.getElementById('mergeTo') as HTMLSelectElement).value;
    if (!f || !t || f === t) return; S.settings.aliases[f] = t; await persist();
  },
  unmerge: async (el) => { delete S.settings.aliases[arg(el)]; await persist(); },
  phaseDel: async (el) => { const sorted = [...S.settings.phases].sort((a, b) => a.start.localeCompare(b.start)); sorted.splice(+arg(el), 1); S.settings.phases = sorted; await persist(); },
};

const changes: Record<string, (el: HTMLInputElement | HTMLSelectElement) => void | Promise<void>> = {
  selHome: (el) => { S.sel.home = el.value; render(); },
  logDate: (el) => {
    const day = S.logDraft?.day ?? 'Push';
    S.logDraft = initLogDraft(S, day, el.value);
    saveDraft(S.logDraft);
    render();
  },
  selPerim: (el) => { S.perimeter = el.value; render(); },
  calcPreset: (el) => { const [w, r] = el.value.split('|'); (document.getElementById('calcW') as HTMLInputElement).value = w; (document.getElementById('calcR') as HTMLInputElement).value = r; runCalc(); },
  nutri: () => runCalc(),
  geminiKey: async (el) => { S.settings.geminiKey = el.value.trim() || undefined; await saveSettings(S.settings); toast('Clave guardada.'); },
  rtName: async (el) => { const [d, i] = arg(el).split('|'); S.settings.routines[d as DayName][+i].name = el.value; await persist(); },
  rtSets: async (el) => { const [d, i] = arg(el).split('|'); S.settings.routines[d as DayName][+i].sets = Math.max(1, +el.value || 1); await persist(); },
  rtReps: async (el) => { const [d, i] = arg(el).split('|'); S.settings.routines[d as DayName][+i].reps = Math.max(1, +el.value || 1); await persist(); },
  refName: async (el) => { if (!el.value.trim()) return; S.settings.refNames[arg(el)] = el.value.trim(); await persist(); },
  musP: async (el) => { const n = norm(arg(el)); const cur = S.settings.muscles[n] ?? { p: '', s: [] }; S.settings.muscles[n] = { ...cur, p: el.value }; await persist(); },
  musS: async (el) => {
    const n = norm(arg(el)); const cur = S.settings.muscles[n] ?? { p: '', s: [] };
    S.settings.muscles[n] = { ...cur, p: cur.p || (document.querySelector(`select[data-arg="${CSS.escape(arg(el))}"]`) as HTMLSelectElement | null)?.value || '', s: el.value.split(',').map((x) => x.trim()).filter(Boolean) };
    await persist();
  },
  pfSex: async (el) => { S.settings.profile.sex = el.value; await persist(); },
  pfAge: async (el) => { S.settings.profile.age = +el.value; await persist(); },
  pfHeight: async (el) => { S.settings.profile.height = +el.value; await persist(); },
};

root.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (el) void actions[el.dataset.act!]?.(el);
});
root.addEventListener('change', async (e) => {
  const el = e.target as HTMLInputElement;
  if (el.dataset.change) { await changes[el.dataset.change]?.(el); return; }
  const kind = el.dataset.file;
  if (!kind || !el.files?.length) return;
  const files = [...el.files];
  try {
    if (kind === 'samsung') {
      toast('Procesando exportación…');
      const imp = await importSamsungFiles(files);
      const before = S.strength.length;
      await putMany('strength', imp.strength); await putMany('cardio', imp.cardio);
      Object.assign(S.settings.customNames, imp.customNames);
      await saveSettings(S.settings); await reload();
      toast(`Importado: ${S.strength.length - before} ejercicios nuevos (${imp.strength.length} leídos), ${imp.cardio.length} cardio, ${Object.keys(imp.customNames).length} nombres.${!Object.keys(S.settings.customNames).length ? ' Falta custom_exercise.csv para los nombres.' : ''}`);
    } else if (kind === 'measures') {
      const m = parseMeasuresCsv(await files[0].text());
      await putMany('measures', m.measures);
      Object.assign(S.settings.profile, m.profile);
      await saveSettings(S.settings); await reload();
      toast(`Importadas ${m.measures.length} mediciones.`);
    } else if (kind === 'backup') {
      await importBackup(JSON.parse(await files[0].text()) as Backup); await reload(); toast('Copia restaurada.');
    }
  } catch (err) { toast(`Error al importar: ${(err as Error).message}`); }
  el.value = '';
});
root.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  if (el.dataset.input === 'calc') { runCalc(); return; }
  if (!S.logDraft) return;
  if (el.dataset.logW) {
    const [ei, si] = el.dataset.logW.split('|').map(Number);
    const s = S.logDraft.exercises[ei]?.sets[si];
    if (s) { s.w = Math.max(0, parseFloat(el.value.replace(',', '.')) || 0); saveDraft(S.logDraft); }
  } else if (el.dataset.logR) {
    const [ei, si] = el.dataset.logR.split('|').map(Number);
    const s = S.logDraft.exercises[ei]?.sets[si];
    if (s) { s.r = Math.max(0, parseInt(el.value, 10) || 0); saveDraft(S.logDraft); }
  } else if (el.dataset.logNote != null) {
    const ex = S.logDraft.exercises[+el.dataset.logNote];
    if (ex) { ex.note = el.value; saveDraft(S.logDraft); }
  }
});
root.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target as HTMLFormElement; const fd = new FormData(f);
  if (f.id === 'f-measure') {
    const m: Measure = { date: String(fd.get('date')) };
    for (const { key } of MEASURE_FIELDS) { const v = num(String(fd.get(key) ?? '')); if (v != null) (m as unknown as Record<string, number>)[key] = v; }
    const note = String(fd.get('note') ?? '').trim(); if (note) m.note = note;
    await putMany('measures', [m]); await reload(); toast('Medición guardada.');
  } else if (f.id === 'f-phase') {
    S.settings.phases.push({ name: String(fd.get('name')), start: String(fd.get('start')) }); await persist();
  }
});
window.addEventListener('hashchange', () => {
  const next = initialTab();
  if (next !== S.tab) { S.tab = next; render(); }
});

reload().then(() => {
  const first = !S.strength.length && !S.measures.length;
  if (first && !location.hash) setTab('settings');
  render();
});
