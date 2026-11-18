import { deleteKey, putMany } from '../lib/db';
import { isValidIsoDate } from '../lib/seed';
import { markBucketDeletes, markBucketUpserts } from '../lib/sync';
import { BASIC_MEASURE_KEYS, MEASURE_FIELDS, type Measure } from '../types';
import { todayIso, type State } from '../ui/shared';
import { createProfileActions } from './profileActions';

/** Dependencias para acciones de Cuerpo, Volumen, Calculadoras y Perfil. */
export interface AnalyticsActionDeps {
  getState: () => State;
  persist: () => Promise<void>;
  reload: () => Promise<void>;
  render: () => void;
  queueSync: () => void;
  toast: (msg: string) => void;
  askConfirm: (opts: { title: string; message: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
}

/** Tipo de retorno completo de las acciones analíticas y biométricas. */
export type AnalyticsActions = ReturnType<typeof createAnalyticsActions>;

const parseDecimal = (v: string): number | undefined => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Crea acciones reactivas para composición corporal, medidas, volumen, calculadoras y perfil.
 *
 * @param deps - Puentes al estado, IndexedDB, persistencia, avisos y confirmaciones.
 * @returns Conjunto tipado de acciones para las vistas de Bloque C.
 */
export function createAnalyticsActions(deps: AnalyticsActionDeps) {
  const state = () => deps.getState();

  return {
    ...createProfileActions(deps),

    setBodyMetric(mode: 'weight' | 'muscle') {
      state().bodyMetric = mode;
      deps.render();
    },

    setPerimeter(perim: string) {
      state().perimeter = perim;
      deps.render();
    },

    setMeasureDate(rawDate: string) {
      const S = state();
      if (rawDate && !isValidIsoDate(rawDate)) {
        deps.toast('Introduce una fecha válida.');
        deps.render();
        return;
      }
      S.measureDate = rawDate || undefined;
      S.measurePerimOpen = undefined;
      S.measureDraft = undefined;
      deps.render();
    },

    clearMeasureDate() {
      const S = state();
      S.measureDate = undefined;
      S.measurePerimOpen = undefined;
      S.measureDraft = undefined;
      deps.render();
    },

    toggleMeasurePerim() {
      const S = state();
      const activeDate = S.measureDate ?? todayIso();
      const entry = S.measures.find((m) => m.date === activeDate);
      const hasPerim = Boolean(
        entry && MEASURE_FIELDS.some((f) => !BASIC_MEASURE_KEYS.includes(f.key) && entry[f.key] != null),
      );
      S.measurePerimOpen = !(S.measurePerimOpen ?? hasPerim);
      deps.render();
    },

    updateMeasureDraft(field: string, value: string) {
      const S = state();
      S.measureDraft = { ...(S.measureDraft ?? {}), [field]: value };
      deps.render();
    },

    async saveMeasure(fd: FormData) {
      const S = state();
      const date = String(fd.get('date') ?? '').trim();
      if (!isValidIsoDate(date)) {
        deps.toast('Introduce una fecha válida.');
        return;
      }
      const existing = S.measures.find((x) => x.date === date);
      const m: Measure = { date };
      let metricCount = 0;
      for (const { key } of MEASURE_FIELDS) {
        if (fd.has(key)) {
          const v = parseDecimal(String(fd.get(key) ?? ''));
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
        deps.toast('Introduce al menos una métrica numérica (por ejemplo, peso o % de grasa).');
        return;
      }
      const note = fd.has('note') ? String(fd.get('note') ?? '').trim() : (existing?.note ?? '');
      if (note) m.note = note;
      await putMany('measures', [m]);
      markBucketUpserts('measures', [m]);
      S.measureDate = date;
      S.measurePerimOpen = undefined;
      S.measureDraft = undefined;
      await deps.reload();
      deps.render();
      deps.queueSync();
      deps.toast('Medición guardada.');
    },

    editMeasure(date: string) {
      if (!date) return;
      const S = state();
      S.measureDate = date;
      S.measurePerimOpen = undefined;
      S.measureDraft = undefined;
      S.measureScrollTs = Date.now();
      deps.render();
    },

    async deleteMeasure(date: string) {
      if (!date) return;
      const ok = await deps.askConfirm({
        title: 'Borrar medición',
        message: `¿Seguro que quieres eliminar el registro corporal del ${date}?`,
        confirmLabel: 'Borrar',
        danger: true,
      });
      if (!ok) return;
      await deleteKey('measures', date);
      markBucketDeletes('measures', [{ key: date, date }]);
      await deps.reload();
      deps.render();
      deps.queueSync();
    },

    selectMuscle(muscle: string) {
      state().muscleSel = muscle;
      deps.render();
    },

    applyCalcPreset(raw: string) {
      const [w, r] = raw.split('|');
      const S = state();
      S.calcDraft = { ...S.calcDraft, w, r };
      deps.render();
    },

    updateCalcField(
      field: 'w' | 'r' | 'rir' | 'act' | 'goal' | 'protein' | 'fat' | 'meals',
      value: string,
    ) {
      const S = state();
      S.calcDraft = { ...S.calcDraft, [field]: value };
      deps.render();
    },
  };
}
