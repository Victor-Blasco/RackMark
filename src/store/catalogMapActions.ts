import { musclesOf } from '../lib/analysis';
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
      const cur = musclesOf(exName, S.settings) ?? { p: '', s: [] };
      const s = cur.s.filter((m) => m !== primary);
      S.settings = { ...S.settings, muscles: { ...S.settings.muscles, [key]: { p: primary, s } } };
      await deps.persist();
    },

    async toggleSecondaryMuscle(exName: string, muscle: string) {
      const S = state();
      const key = norm(exName);
      const cur = musclesOf(exName, S.settings) ?? { p: '', s: [] };
      if (!muscle || muscle === cur.p) return;
      const s = cur.s.includes(muscle) ? cur.s.filter((m) => m !== muscle) : [...cur.s, muscle];
      S.settings = { ...S.settings, muscles: { ...S.settings.muscles, [key]: { p: cur.p, s } } };
      await deps.persist();
    },

    async mergeExercises(rawFrom: string, rawTo: string) {
      const from = rawFrom.trim();
      const to = rawTo.trim();
      if (!from || !to || norm(from) === norm(to)) return;
      const S = state();
      let target = to;
      for (let seen = new Set<string>([norm(target)]); S.settings.aliases[target]; seen.add(norm(target))) {
        target = S.settings.aliases[target];
        if (norm(target) === norm(from) || seen.has(norm(target))) {
          deps.toast('No se puede crear un ciclo al unificar ejercicios.');
          return;
        }
      }
      const nextAliases: Record<string, string> = {};
      for (const [k, v] of Object.entries(S.settings.aliases)) nextAliases[k] = norm(v) === norm(from) ? target : v;
      nextAliases[from] = target;
      delete nextAliases[target];

      const nextRoutines: typeof S.settings.routines = {};
      for (const [day, list] of Object.entries(S.settings.routines)) {
        const used = new Set<string>();
        nextRoutines[day] = list
          .map((r) => (norm(r.name) === norm(from) ? { ...r, name: target } : r))
          .filter((r) => !used.has(norm(r.name)) && Boolean(used.add(norm(r.name))));
      }
      const nextNotes = { ...S.settings.notes };
      if (nextNotes[from]) {
        if (!nextNotes[target]) nextNotes[target] = nextNotes[from];
        delete nextNotes[from];
      }
      const rename = <T extends { exercises: { name: string }[] }>(b?: T): T | undefined =>
        b && { ...b, exercises: b.exercises.map((e) => (norm(e.name) === norm(from) ? { ...e, name: target } : e)) };
      S.settings = { ...S.settings, aliases: nextAliases, routines: nextRoutines, notes: nextNotes };
      S.liveWorkout = rename(S.liveWorkout);
      S.logDraft = rename(S.logDraft);
      await deps.persist();
      deps.toast(`«${from}» unificado con «${target}».`);
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
