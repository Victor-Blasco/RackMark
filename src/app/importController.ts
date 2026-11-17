import { BASIC_MEASURE_KEYS, MEASURE_FIELDS, type Measure } from '../types';
import {
  deleteKey,
  exportBackup,
  importBackup,
  mergeWellbeing,
  parseBackup,
  putMany,
  sanitizeSettings,
  saveSettings,
} from '../lib/db';
import { parseMeasuresCsv } from '../lib/measures';
import { importSamsungInWorker } from '../lib/samsung';
import { isValidIsoDate } from '../lib/seed';
import { markBucketDeletes, markBucketUpserts, markSettingsDirty } from '../lib/sync';
import { todayIso } from '../ui/shared';
import { arg, num, type AppContext } from './context';

const MAX_SINGLE_FILE_BYTES = 50 * 1024 * 1024;

function download(name: string, data: string, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ImportController {
  actions: Record<string, (el: HTMLElement) => void | Promise<void>>;
  changes: Record<string, (el: HTMLInputElement | HTMLSelectElement) => void | Promise<void>>;
  handleFileChange: (el: HTMLInputElement) => Promise<void>;
  handleInput: (el: HTMLInputElement) => boolean;
  handleSubmit: (f: HTMLFormElement, fd: FormData) => Promise<boolean>;
}

export function createImportController(ctx: AppContext): ImportController {
  const actions: Record<string, (el: HTMLElement) => void | Promise<void>> = {
    export: async () =>
      download(`gymapp-backup-${todayIso()}.json`, JSON.stringify(await exportBackup()), 'application/json'),
    delMeasure: async (el) => {
      const key = arg(el);
      if (
        !(await ctx.askConfirm({
          title: 'Borrar medición',
          message: `¿Seguro que quieres eliminar el registro corporal del ${key}?`,
          confirmLabel: 'Borrar',
          danger: true,
        }))
      ) {
        return;
      }
      await deleteKey('measures', key);
      markBucketDeletes('measures', [{ key, date: key }]);
      await ctx.reload();
      ctx.render();
      ctx.queueSync();
    },
    toggleMeasurePerim: () => {
      const S = ctx.state;
      const today = todayIso();
      const activeDate = S.measureDate ?? today;
      const entry = S.measures.find((m) => m.date === activeDate);
      const hasPerim = Boolean(
        entry && MEASURE_FIELDS.some((f) => !BASIC_MEASURE_KEYS.includes(f.key) && entry[f.key] != null),
      );
      S.measurePerimOpen = !(S.measurePerimOpen ?? hasPerim);
      ctx.render();
    },
    editMeasure: (el) => {
      const d = arg(el);
      if (!d) return;
      const S = ctx.state;
      S.measureDate = d;
      S.measurePerimOpen = undefined;
      S.measureDraft = undefined;
      ctx.render();
      ctx.root.querySelector<HTMLElement>('#f-measure')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    },
    clearMeasureDate: () => {
      const S = ctx.state;
      S.measureDate = undefined;
      S.measurePerimOpen = undefined;
      S.measureDraft = undefined;
      ctx.render();
    },
  };

  const changes: Record<string, (el: HTMLInputElement | HTMLSelectElement) => void | Promise<void>> = {
    measureDate: (el) => {
      const S = ctx.state;
      if (el.value && !isValidIsoDate(el.value)) {
        el.value = S.measureDate ?? '';
        ctx.toast('Introduce una fecha válida.');
        return;
      }
      S.measureDate = el.value || undefined;
      S.measurePerimOpen = undefined;
      S.measureDraft = undefined;
      ctx.render();
    },
  };

  async function handleFileChange(el: HTMLInputElement): Promise<void> {
    const kind = el.dataset.file;
    if (!kind || !el.files?.length) return;
    const files = [...el.files];
    const S = ctx.state;
    try {
      if (kind === 'samsung') {
        ctx.toast('Procesando exportación…');
        const imp = await importSamsungInWorker(files);
        const before = S.strength.length;
        await putMany('strength', imp.strength);
        await putMany('cardio', imp.cardio);
        await mergeWellbeing(imp.wellbeing);
        Object.assign(S.settings.customNames, imp.customNames);
        S.settings = sanitizeSettings(S.settings);
        await saveSettings(S.settings);
        markBucketUpserts('strength', imp.strength);
        markBucketUpserts('cardio', imp.cardio);
        markBucketUpserts('wellbeing', imp.wellbeing);
        markSettingsDirty();
        await ctx.reload();
        ctx.render();
        ctx.queueSync();
        const unresolvedCustomIds = imp.strength
          .map((row) => row.ref)
          .filter((ref) => !ref.startsWith('name:') && !ref.startsWith('type:') && !S.settings.customNames[ref])
          .filter((ref, index, refs) => refs.indexOf(ref) === index);
        const parts = [
          `${S.strength.length - before} ejercicios nuevos (${imp.strength.length} leídos)`,
          `${imp.cardio.length} cardio`,
          `${imp.wellbeing.length} días de bienestar`,
          `${Object.keys(imp.customNames).length} nombres`,
        ];
        ctx.toast(
          `Importado: ${parts.join(', ')}.${
            unresolvedCustomIds.length
              ? ` Faltan nombres personalizados para ${unresolvedCustomIds.length} ejercicios. Incluye el CSV exercise.custom_exercise en la exportación.`
              : ''
          }`,
        );
      } else if (kind === 'measures') {
        if (files[0].size > MAX_SINGLE_FILE_BYTES) throw new Error('Archivo demasiado grande (máx. 50 MB).');
        const m = parseMeasuresCsv(await files[0].text());
        await putMany('measures', m.measures);
        Object.assign(S.settings.profile, m.profile);
        S.settings = sanitizeSettings(S.settings);
        await saveSettings(S.settings);
        markBucketUpserts('measures', m.measures);
        markSettingsDirty();
        await ctx.reload();
        ctx.render();
        ctx.queueSync();
        ctx.toast(`Importadas ${m.measures.length} mediciones.`);
      } else if (kind === 'backup') {
        if (files[0].size > MAX_SINGLE_FILE_BYTES) throw new Error('Archivo demasiado grande (máx. 50 MB).');
        const b = parseBackup(await files[0].text());
        await importBackup(b);
        markBucketUpserts('strength', b.strength);
        markBucketUpserts('cardio', b.cardio);
        markBucketUpserts('measures', b.measures);
        if (b.wellbeing?.length) markBucketUpserts('wellbeing', b.wellbeing);
        markSettingsDirty();
        await ctx.reload();
        ctx.render();
        ctx.queueSync();
        ctx.toast('Copia restaurada.');
      }
    } catch (err) {
      ctx.toast(`Error al importar: ${(err as Error).message}`);
    }
    el.value = '';
  }

  function handleInput(el: HTMLInputElement): boolean {
    if (el.closest?.('#f-measure') && el.name && el.name !== 'date') {
      (ctx.state.measureDraft ??= {})[el.name] = el.value;
      return true;
    }
    return false;
  }

  async function handleSubmit(f: HTMLFormElement, fd: FormData): Promise<boolean> {
    if (f.id !== 'f-measure') return false;
    const S = ctx.state;
    const date = String(fd.get('date') ?? '').trim();
    if (!isValidIsoDate(date)) {
      ctx.toast('Introduce una fecha válida.');
      return true;
    }
    const existing = S.measures.find((x) => x.date === date);
    const m: Measure = { date };
    let metricCount = 0;
    for (const { key } of MEASURE_FIELDS) {
      if (fd.has(key)) {
        const v = num(String(fd.get(key) ?? ''));
        if (v != null) {
          (m as unknown as Record<string, number>)[key] = v;
          metricCount++;
        }
      } else if (typeof existing?.[key] === 'number') {
        (m as unknown as Record<string, number>)[key] = existing[key] as number;
        metricCount++;
      }
    }
    if (!metricCount) {
      ctx.toast('Introduce al menos una métrica numérica (por ejemplo, peso o % de grasa).');
      return true;
    }
    const note = fd.has('note') ? String(fd.get('note') ?? '').trim() : (existing?.note ?? '');
    if (note) m.note = note;
    await putMany('measures', [m]);
    markBucketUpserts('measures', [m]);
    S.measureDate = date;
    S.measurePerimOpen = undefined;
    S.measureDraft = undefined;
    await ctx.reload();
    ctx.render();
    ctx.queueSync();
    ctx.toast('Medición guardada.');
    return true;
  }

  return { actions, changes, handleFileChange, handleInput, handleSubmit };
}
