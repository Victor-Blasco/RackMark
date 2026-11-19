import { isValidIsoDate, norm } from '../lib/seed';
import type { State } from '../ui/shared';
import type { ConfirmModalOpts } from './types';

/** Dependencias para gestionar catálogo muscular, alias y fases de entrenamiento. */
export interface CatalogMapDeps {
  getState: () => State;
  persist: () => Promise<void>;
  askConfirm: (opts: ConfirmModalOpts) => Promise<boolean>;
  toast: (msg: string) => void;
}

/**
 * Crea acciones inmutables de mapeo muscular, unificación de alias y fases del bloque.
 *
 * @param deps - Puentes de estado, confirmación, avisos y persistencia.
 * @returns Manejadores tipados para catálogo de ejercicios y fases.
 */
export function createCatalogMapActions(deps: CatalogMapDeps) {
  const state = () => deps.getState();

  return {
    async assignRefName(ref: string, val: string) {
      const trimmed = val.trim();
      if (!trimmed) return;
      const S = state();
      S.settings = {
        ...S.settings,
        refNames: { ...S.settings.refNames, [ref]: trimmed },
      };
      await deps.persist();
    },

    async changePrimaryMuscle(exName: string, primary: string) {
      const S = state();
      const key = norm(exName);
      const cur = S.settings.muscles[key] ?? { p: '', s: [] };
      S.settings = {
        ...S.settings,
        muscles: { ...S.settings.muscles, [key]: { ...cur, p: primary } },
      };
      await deps.persist();
    },

    async changeSecondaryMuscles(exName: string, rawSec: string) {
      const S = state();
      const key = norm(exName);
      const cur = S.settings.muscles[key] ?? { p: '', s: [] };
      const s = rawSec.split(',').map((x) => x.trim()).filter(Boolean);
      S.settings = {
        ...S.settings,
        muscles: { ...S.settings.muscles, [key]: { ...cur, s } },
      };
      await deps.persist();
    },

    async mergeExercises(from: string, to: string) {
      if (!from || !to || from === to) return;
      const S = state();
      S.settings = {
        ...S.settings,
        aliases: { ...S.settings.aliases, [from]: to },
      };
      await deps.persist();
    },

    async unmergeExercise(alias: string) {
      const S = state();
      const { [alias]: _removed, ...aliases } = S.settings.aliases;
      S.settings = { ...S.settings, aliases };
      await deps.persist();
    },

    async addPhase(rawName: string, rawStart: string) {
      const name = rawName.trim().slice(0, 80);
      const start = rawStart.trim();
      if (!name || !isValidIsoDate(start)) {
        deps.toast('Introduce un nombre y una fecha válida para la fase.');
        return;
      }
      const S = state();
      S.settings = {
        ...S.settings,
        phases: [...S.settings.phases, { name, start }],
      };
      await deps.persist();
    },

    async deletePhase(sortedIdx: number) {
      const S = state();
      const sortedBefore = [...S.settings.phases].sort((a, b) => a.start.localeCompare(b.start));
      const target = sortedBefore[sortedIdx];
      if (!target) return;
      const d = target.start;
      const confirmed = await deps.askConfirm({
        title: `Eliminar fase "${target.name}"`,
        message: `Se eliminará la fase "${target.name}" (desde ${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}). Esta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar fase',
        danger: true,
      });
      if (!confirmed) return;
      const sortedAfter = [...state().settings.phases].sort((a, b) => a.start.localeCompare(b.start));
      let delIdx = sortedAfter.indexOf(target);
      if (delIdx < 0) delIdx = sortedAfter.findIndex((p) => p.name === target.name && p.start === target.start);
      if (delIdx < 0) return;
      state().settings = {
        ...state().settings,
        phases: sortedAfter.filter((_, i) => i !== delIdx),
      };
      await deps.persist();
    },
  };
}
