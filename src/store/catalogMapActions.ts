import { musclesOf, resolveName } from '../lib/analysis';
import { deleteKey, putMany } from '../lib/db';
import { CATALOG_NORM_SET, isValidIsoDate, norm } from '../lib/seed';
import { markBucketDeletes, markBucketUpserts } from '../lib/sync';
import type { LiveWorkout, LogDraft, StrengthRow } from '../types';
import type { State } from '../ui/shared';
import { allExerciseNames } from './exerciseCatalog';
import type { ConfirmModalOpts } from './types';

/** Dependencias para gestionar catálogo muscular, renombrado, borrado, alias y fases de entrenamiento. */
export interface CatalogMapDeps {
  getState: () => State;
  persist: () => Promise<void>;
  askConfirm: (opts: ConfirmModalOpts) => Promise<boolean>;
  toast: (msg: string) => void;
  saveDraft?: (draft?: LogDraft) => void;
  saveLive?: (live?: LiveWorkout) => void;
  putStrength?: (rows: StrengthRow[]) => Promise<void>;
  deleteStrength?: (id: string) => Promise<void>;
}

function omitMatchingEntries<T>(rec: Record<string, T>, matchVal: (val: T, key: string) => boolean): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(rec)) {
    if (!matchVal(v, k)) out[k] = v;
  }
  return out;
}

function removeFromLiveWorkout(live: LiveWorkout | undefined, targetNorm: string): { next: LiveWorkout | undefined; changed: boolean } {
  if (!live || !live.exercises.some((e) => norm(e.name) === targetNorm)) return { next: live, changed: false };
  const kept: LiveWorkout['exercises'] = [];
  const idxMap = new Map<number, number>();
  live.exercises.forEach((ex, idx) => {
    if (norm(ex.name) !== targetNorm) {
      idxMap.set(idx, kept.length);
      kept.push(ex);
    }
  });
  if (!kept.length) return { next: undefined, changed: true };
  const mappedCur = idxMap.get(live.curIdx);
  const curIdx = mappedCur ?? Math.min(live.curIdx, kept.length - 1);
  const restIdx = live.restRef ? idxMap.get(live.restRef.ei) : undefined;
  const { restStartedAt: _rs, restUntil: _ru, restRef: _rr, ...restClean } = live;
  const next: LiveWorkout = restIdx != null && live.restRef
    ? { ...live, exercises: kept, curIdx, restRef: { ei: restIdx, si: live.restRef.si } }
    : { ...restClean, exercises: kept, curIdx };
  return { next, changed: true };
}

/**
 * Crea acciones inmutables de mapeo muscular, renombrado/borrado de ejercicios, unificación de alias y fases.
 *
 * @param deps - Puentes de estado, confirmación, avisos y persistencia.
 * @returns Manejadores tipados para catálogo de ejercicios y fases.
 */
export function createCatalogMapActions(deps: CatalogMapDeps) {
  const state = () => deps.getState();
  const putStrength = deps.putStrength ?? ((rows: StrengthRow[]) => putMany('strength', rows));
  const deleteStrength = deps.deleteStrength ?? ((id: string) => deleteKey('strength', id));

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

    async renameExercise(oldName: string, rawNewName: string): Promise<string | undefined> {
      const newName = rawNewName.trim().slice(0, 80);
      const oldNorm = norm(oldName);
      const newNorm = norm(newName);
      if (!newName || !newNorm) return 'Introduce un nombre válido.';
      if (newName === oldName) return undefined;

      const S = state();
      if (oldNorm !== newNorm) {
        const conflict = allExerciseNames(S).find((n) => norm(n) === newNorm);
        if (conflict) return `Ya existe «${conflict}». Usa "Unificar ejercicios duplicados" si quieres fusionarlos.`;
      }

      const nextRoutines: typeof S.settings.routines = {};
      for (const [day, list] of Object.entries(S.settings.routines)) {
        nextRoutines[day] = list.map((r) => (norm(r.name) === oldNorm ? { ...r, name: newName } : r));
      }

      let foundNote: string | undefined;
      const nextNotes: Record<string, string> = {};
      for (const [k, v] of Object.entries(S.settings.notes)) {
        if (norm(k) === oldNorm) foundNote ??= v;
        else nextNotes[k] = v;
      }
      if (foundNote !== undefined) nextNotes[newName] = foundNote;

      const curMuscle = musclesOf(oldName, S.settings);
      const nextMuscles = { ...S.settings.muscles };
      if (oldNorm !== newNorm) delete nextMuscles[oldNorm];
      if (curMuscle) nextMuscles[newNorm] = curMuscle;

      const nextCustomNames: Record<string, string> = {};
      for (const [k, v] of Object.entries(S.settings.customNames)) {
        if (oldNorm !== newNorm && k === `manual:${oldNorm}`) continue;
        nextCustomNames[k] = norm(v) === oldNorm ? newName : v;
      }
      const nextRefNames: Record<string, string> = {};
      for (const [k, v] of Object.entries(S.settings.refNames)) {
        nextRefNames[k] = norm(v) === oldNorm ? newName : v;
      }

      const updatedRows: StrengthRow[] = [];
      const nextStrength = S.strength.map((row) => {
        if (norm(resolveName(row.ref, S.settings)) !== oldNorm) return row;
        if (row.ref.startsWith('name:')) {
          const nextRow = { ...row, ref: `name:${newName}` };
          updatedRows.push(nextRow);
          return nextRow;
        }
        nextRefNames[row.ref] = newName;
        return row;
      });
      if (updatedRows.length) {
        await putStrength(updatedRows);
        markBucketUpserts('strength', updatedRows);
        S.strength = nextStrength;
      }

      const alreadyNamed =
        Object.values(nextCustomNames).some((v) => norm(v) === newNorm) ||
        Object.values(nextRefNames).some((v) => norm(v) === newNorm);
      if (!CATALOG_NORM_SET.has(newNorm) && !alreadyNamed) {
        nextCustomNames[`manual:${newNorm}`] = newName;
      }

      const nextAliases: Record<string, string> = {};
      for (const [k, v] of Object.entries(S.settings.aliases)) {
        const nk = norm(k) === oldNorm ? newName : k;
        const nv = norm(v) === oldNorm ? newName : v;
        if (norm(nk) !== norm(nv)) nextAliases[nk] = nv;
      }

      const hiddenSet = new Set((S.settings.hiddenExercises ?? []).map((h) => norm(h)).filter((h) => h && h !== newNorm));
      if (oldNorm !== newNorm && CATALOG_NORM_SET.has(oldNorm)) hiddenSet.add(oldNorm);

      let nextAi = S.settings.ai;
      if (S.settings.ai) {
        const nextByEx: typeof S.settings.ai.byExercise = {};
        for (const [k, v] of Object.entries(S.settings.ai.byExercise)) {
          nextByEx[k === oldName || norm(k) === oldNorm ? newName : k] = v;
        }
        nextAi = { ...S.settings.ai, byExercise: nextByEx };
      }

      const nextSettings: typeof S.settings = {
        ...S.settings,
        routines: nextRoutines,
        notes: nextNotes,
        muscles: nextMuscles,
        customNames: nextCustomNames,
        refNames: nextRefNames,
        aliases: nextAliases,
        ...(nextAi ? { ai: nextAi } : {}),
      };
      if (hiddenSet.size) nextSettings.hiddenExercises = [...hiddenSet];
      else delete nextSettings.hiddenExercises;
      S.settings = nextSettings;

      for (const [day, ex] of Object.entries(S.sel)) {
        if (norm(ex) === oldNorm) S.sel = { ...S.sel, [day]: newName };
      }
      if (S.liveWorkout?.exercises.some((e) => norm(e.name) === oldNorm)) {
        S.liveWorkout = {
          ...S.liveWorkout,
          exercises: S.liveWorkout.exercises.map((e) => (norm(e.name) === oldNorm ? { ...e, name: newName } : e)),
        };
        deps.saveLive?.(S.liveWorkout);
      }
      if (S.logDraft?.exercises.some((e) => norm(e.name) === oldNorm)) {
        S.logDraft = {
          ...S.logDraft,
          exercises: S.logDraft.exercises.map((e) => (norm(e.name) === oldNorm ? { ...e, name: newName } : e)),
        };
        deps.saveDraft?.(S.logDraft);
      }

      await deps.persist();
      deps.toast(`«${oldName}» renombrado a «${newName}».`);
      return undefined;
    },

    async deleteExercise(exName: string): Promise<boolean> {
      const S = state();
      const targetNorm = norm(exName);
      if (!targetNorm) return false;

      const affectedRoutines = Object.keys(S.settings.routines).filter((d) =>
        (S.settings.routines[d] ?? []).some((r) => norm(r.name) === targetNorm),
      );
      const matchedRows = S.strength.filter((r) => norm(resolveName(r.ref, S.settings)) === targetNorm);
      const affectedSessions = new Set(matchedRows.map((r) => r.sessionId || r.date)).size;

      const impacts: string[] = [];
      if (affectedRoutines.length > 0) {
        impacts.push(`${affectedRoutines.length} ${affectedRoutines.length === 1 ? 'rutina' : 'rutinas'}`);
      }
      if (affectedSessions > 0) {
        impacts.push(`${affectedSessions} ${affectedSessions === 1 ? 'sesión del historial' : 'sesiones del historial'}`);
      }
      const message = impacts.length
        ? `Se eliminará por completo de tu biblioteca y afectará a ${impacts.join(' y ')}. Esta acción no se puede deshacer.`
        : `Se eliminará «${exName}» por completo de tu biblioteca. Esta acción no se puede deshacer.`;

      const confirmed = await deps.askConfirm({
        title: `Eliminar "${exName}"`,
        message,
        confirmLabel: 'Eliminar por completo',
        danger: true,
      });
      if (!confirmed) return false;

      const curS = state();
      const rowsToDelete = curS.strength.filter((r) => norm(resolveName(r.ref, curS.settings)) === targetNorm);
      if (rowsToDelete.length) {
        for (const r of rowsToDelete) await deleteStrength(r.id);
        markBucketDeletes('strength', rowsToDelete.map((r) => ({ key: r.id, date: r.date })));
        const delIds = new Set(rowsToDelete.map((r) => r.id));
        curS.strength = curS.strength.filter((r) => !delIds.has(r.id));
      }

      const nextRoutines: typeof curS.settings.routines = {};
      for (const [day, list] of Object.entries(curS.settings.routines)) {
        nextRoutines[day] = list.filter((r) => norm(r.name) !== targetNorm);
      }

      const nextNotes = omitMatchingEntries(curS.settings.notes, (_v, k) => norm(k) === targetNorm);
      const nextMuscles = omitMatchingEntries(curS.settings.muscles, (_v, k) => norm(k) === targetNorm);
      const nextCustomNames = omitMatchingEntries(curS.settings.customNames, (v) => norm(v) === targetNorm);
      const nextRefNames = omitMatchingEntries(curS.settings.refNames, (v) => norm(v) === targetNorm);
      const nextAliases = omitMatchingEntries(
        curS.settings.aliases,
        (v, k) => norm(k) === targetNorm || norm(v) === targetNorm,
      );

      let nextAi = curS.settings.ai;
      if (curS.settings.ai) {
        nextAi = {
          ...curS.settings.ai,
          byExercise: omitMatchingEntries(curS.settings.ai.byExercise, (_v, k) => norm(k) === targetNorm),
        };
      }

      const hiddenSet = new Set((curS.settings.hiddenExercises ?? []).map((h) => norm(h)).filter(Boolean));
      if (CATALOG_NORM_SET.has(targetNorm)) hiddenSet.add(targetNorm);

      const nextSettings: typeof curS.settings = {
        ...curS.settings,
        routines: nextRoutines,
        notes: nextNotes,
        muscles: nextMuscles,
        customNames: nextCustomNames,
        refNames: nextRefNames,
        aliases: nextAliases,
        ...(nextAi ? { ai: nextAi } : {}),
      };
      if (hiddenSet.size) nextSettings.hiddenExercises = [...hiddenSet];
      else delete nextSettings.hiddenExercises;
      curS.settings = nextSettings;

      const cleanSel: typeof curS.sel = {};
      for (const [day, ex] of Object.entries(curS.sel)) {
        if (norm(ex) !== targetNorm) cleanSel[day] = ex;
      }
      curS.sel = cleanSel;

      const liveRes = removeFromLiveWorkout(curS.liveWorkout, targetNorm);
      if (liveRes.changed) {
        curS.liveWorkout = liveRes.next;
        deps.saveLive?.(curS.liveWorkout);
      }
      if (curS.logDraft?.exercises.some((e) => norm(e.name) === targetNorm)) {
        curS.logDraft = {
          ...curS.logDraft,
          exercises: curS.logDraft.exercises.filter((e) => norm(e.name) !== targetNorm),
        };
        deps.saveDraft?.(curS.logDraft);
      }

      await deps.persist();
      deps.toast(`Ejercicio «${exName}» eliminado.`);
      return true;
    },

    async restoreDefaultExercises(): Promise<void> {
      const S = state();
      if (!S.settings.hiddenExercises?.length) return;
      const { hiddenExercises: _removed, ...rest } = S.settings;
      S.settings = rest;
      await deps.persist();
      deps.toast('Ejercicios predeterminados restaurados.');
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
      if (S.liveWorkout) {
        S.liveWorkout = rename(S.liveWorkout);
        deps.saveLive?.(S.liveWorkout);
      }
      if (S.logDraft) {
        S.logDraft = rename(S.logDraft);
        deps.saveDraft?.(S.logDraft);
      }
      S.mergeFrom = undefined;
      S.mergeTo = undefined;
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
