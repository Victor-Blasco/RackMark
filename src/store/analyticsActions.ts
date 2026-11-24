import { deleteKey, putMany } from '../lib/db';
import { isValidIsoDate } from '../lib/seed';
import { markBucketDeletes, markBucketUpserts } from '../lib/sync';
import { BASIC_MEASURE_KEYS, MEASURE_FIELDS } from '../types';
import { todayIso, type State } from '../ui/shared';
import { parseMeasureFormData } from './bodySelectors';
import { createProfileActions } from './profileActions';
import type { ConfirmModalOpts } from './types';

/** Dependencias para acciones de Cuerpo, Volumen, Calculadoras y Perfil. */
export interface AnalyticsActionDeps {
  getState: () => State;
  persist: () => Promise<void>;
  reload: () => Promise<void>;
  render: () => void;
  queueSync: () => void;
  toast: (msg: string) => void;
  askConfirm: (opts: ConfirmModalOpts) => Promise<boolean>;
}

/** Tipo de retorno completo de las acciones analíticas y biométricas. */
export type AnalyticsActions = ReturnType<typeof createAnalyticsActions>;

/**
 * Crea acciones reactivas para composición corporal, medidas, volumen, calculadoras y perfil.
 *
 * @param deps - Puentes al estado, IndexedDB, persistencia, avisos y confirmaciones.
 * @returns Conjunto tipado de acciones para las vistas de analítica y ajustes.
 */
export function createAnalyticsActions(deps: AnalyticsActionDeps) {
  const state = () => deps.getState();

  const resetMeasureDraft = (date?: string) => {
    const S = state();
    S.measureDate = date;
    S.measurePerimOpen = undefined;
    S.measureDraft = undefined;
  };

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
      if (rawDate && !isValidIsoDate(rawDate)) {
        deps.toast('Introduce una fecha válida.');
        deps.render();
        return;
      }
      resetMeasureDraft(rawDate || undefined);
      deps.render();
    },

    clearMeasureDate() {
      resetMeasureDraft(undefined);
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
      const parsed = parseMeasureFormData(fd, (date) => S.measures.find((x) => x.date === date));
      if ('error' in parsed) {
        deps.toast(parsed.error);
        return;
      }
      await putMany('measures', [parsed.measure]);
      markBucketUpserts('measures', [parsed.measure]);
      resetMeasureDraft(parsed.date);
      await deps.reload();
      deps.render();
      deps.queueSync();
      deps.toast('Medición guardada.');
    },

    editMeasure(date: string) {
      if (!date) return;
      resetMeasureDraft(date);
      state().measureScrollTs = Date.now();
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
  };
}
