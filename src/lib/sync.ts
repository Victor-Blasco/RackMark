import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import type { CardioRow, DailyWellbeing, DataKind, DataRecord, Measure, Settings, StrengthRow } from '../types';
import { deleteKey, getAll, loadSettings, putMany, sanitizeDataRecord, sanitizeSettings, saveSettings, wipeAll } from './db';
import { fs } from './firebase';
import { DEFAULT_SETTINGS } from './seed';

export type { DataKind, DataRecord };

export interface RemoteBucket {
  kind: DataKind;
  items: Record<string, DataRecord>;
  deleted?: Record<string, number>;
  updatedAt: number;
}

export interface RemoteSettingsDoc {
  data: Settings;
  updatedAt: number;
  wipedAt?: number;
}

export interface SyncMeta {
  uid?: string;
  lastSyncAt?: number;
  settingsDirtyAt?: number;
  pendingWipeAt?: number;
  dirtyKeys: Record<string, Record<string, number>>;
  deleted: Record<string, Record<string, number>>;
  remoteUpdated: Record<string, number>;
}

const META_KEY = 'gymapp_sync_meta_v1';
const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_BATCH_OPS = 450;
const KINDS: DataKind[] = ['strength', 'cardio', 'measures', 'wellbeing'];

function clearLocalDrafts(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem('gymapp_log_draft');
  localStorage.removeItem('gymapp_live_workout');
}

const emptyMeta = (uid?: string): SyncMeta => ({
  uid,
  dirtyKeys: {},
  deleted: {},
  remoteUpdated: {},
});

export function loadSyncMeta(): SyncMeta {
  if (typeof localStorage === 'undefined') return emptyMeta();
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return emptyMeta();
    const parsed = JSON.parse(raw) as Partial<SyncMeta>;
    return {
      ...emptyMeta(parsed.uid),
      ...parsed,
      dirtyKeys: parsed.dirtyKeys ?? {},
      deleted: parsed.deleted ?? {},
      remoteUpdated: parsed.remoteUpdated ?? {},
    };
  } catch {
    return emptyMeta();
  }
}

export function saveSyncMeta(meta: SyncMeta): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

export function clearSyncMeta(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(META_KEY);
}

export function hasUnsyncedChanges(meta: SyncMeta = loadSyncMeta()): boolean {
  if (meta.settingsDirtyAt || meta.pendingWipeAt) return true;
  const hasKeys = (buckets: Record<string, Record<string, number>>) =>
    Object.values(buckets).some((m) => Object.keys(m).length > 0);
  return hasKeys(meta.dirtyKeys) || hasKeys(meta.deleted);
}

export function bucketIdFor(kind: DataKind, date: string): string {
  if (kind === 'cardio' || kind === 'measures') return `${kind}_all`;
  const year = /^\d{4}/.test(date) ? date.slice(0, 4) : 'legacy';
  return `${kind}_${year}`;
}

export function recordKey(kind: DataKind, item: DataRecord): string {
  return kind === 'strength' || kind === 'cardio'
    ? (item as StrengthRow | CardioRow).id
    : (item as Measure | DailyWellbeing).date;
}

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function stripUndefined<T>(val: T): T {
  if (typeof val === 'number') return (Number.isFinite(val) ? val : undefined) as T;
  if (Array.isArray(val)) return val.map(stripUndefined).filter((x) => x !== undefined) as T;
  if (val && typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) {
      if (UNSAFE_KEYS.has(k) || v === undefined) continue;
      const clean = stripUndefined(v);
      if (clean !== undefined) out[k] = clean;
    }
    return out as T;
  }
  return val;
}

export function groupRecordsByBucket(
  kind: DataKind,
  rows: DataRecord[],
): Record<string, Record<string, DataRecord>> {
  const buckets: Record<string, Record<string, DataRecord>> = {};
  for (const row of rows) {
    const bId = bucketIdFor(kind, row.date);
    (buckets[bId] ??= {})[recordKey(kind, row)] = stripUndefined(row);
  }
  return buckets;
}

function pruneOldTombstones(tombstones: Record<string, number>, now: number): Record<string, number> {
  const cutoff = now - TOMBSTONE_TTL_MS;
  const out: Record<string, number> = {};
  for (const [k, ts] of Object.entries(tombstones)) {
    if (ts >= cutoff) out[k] = ts;
  }
  return out;
}

export function markBucketUpserts(kind: DataKind, items: DataRecord[], at = Date.now()): void {
  if (!items.length) return;
  const meta = loadSyncMeta();
  for (const item of items) {
    const bId = bucketIdFor(kind, item.date);
    const key = recordKey(kind, item);
    (meta.dirtyKeys[bId] ??= {})[key] = at;
    if (meta.deleted[bId]) delete meta.deleted[bId][key];
  }
  saveSyncMeta(meta);
}

export function markBucketDeletes(
  kind: DataKind,
  entries: { key: string; date: string }[],
  at = Date.now(),
): void {
  if (!entries.length) return;
  const meta = loadSyncMeta();
  for (const { key, date } of entries) {
    const bId = bucketIdFor(kind, date);
    (meta.deleted[bId] ??= {})[key] = at;
    if (meta.dirtyKeys[bId]) delete meta.dirtyKeys[bId][key];
  }
  saveSyncMeta(meta);
}

export function markSettingsDirty(at = Date.now()): void {
  const meta = loadSyncMeta();
  meta.settingsDirtyAt = at;
  saveSyncMeta(meta);
}

export function markWipePending(at = Date.now()): void {
  const meta = loadSyncMeta();
  meta.pendingWipeAt = at;
  meta.dirtyKeys = {};
  meta.deleted = {};
  meta.settingsDirtyAt = at;
  saveSyncMeta(meta);
}

export interface MergeBucketInput {
  kind: DataKind;
  localItems: Record<string, DataRecord>;
  remoteBucket?: RemoteBucket;
  localDirtyKeys: Record<string, number>;
  localDeleted: Record<string, number>;
  lastSyncedAt?: number;
  now?: number;
}

export interface MergeBucketResult {
  merged: Record<string, DataRecord>;
  deleted: Record<string, number>;
  toPutLocally: DataRecord[];
  toDeleteLocally: string[];
  pushRemote: boolean;
}

export function mergeBucket({
  kind,
  localItems,
  remoteBucket,
  localDirtyKeys,
  localDeleted,
  lastSyncedAt = 0,
  now = Date.now(),
}: MergeBucketInput): MergeBucketResult {
  const remoteItems = remoteBucket?.items ?? {};
  const remoteDeleted = remoteBucket?.deleted ?? {};
  const remoteAt = remoteBucket?.updatedAt ?? 0;

  const allKeys = new Set([
    ...Object.keys(localItems),
    ...Object.keys(remoteItems),
    ...Object.keys(localDeleted),
    ...Object.keys(remoteDeleted),
  ]);

  const merged: Record<string, DataRecord> = {};
  const deleted = pruneOldTombstones({ ...remoteDeleted, ...localDeleted }, now);
  for (const k of Object.keys(deleted)) {
    deleted[k] = Math.max(remoteDeleted[k] ?? 0, localDeleted[k] ?? 0);
  }

  const toPutLocally: DataRecord[] = [];
  const toDeleteLocally: string[] = [];

  for (const k of allKeys) {
    if (UNSAFE_KEYS.has(k)) continue;
    const loc = localItems[k];
    const remRaw = remoteItems[k];
    const rem = remRaw !== undefined ? sanitizeDataRecord(kind, remRaw) ?? undefined : undefined;
    const touchL = localDirtyKeys[k] ?? 0;
    const delL = localDeleted[k] ?? 0;
    const delR = remoteDeleted[k] ?? 0;
    const delT = Math.max(delL, delR);

    const localEdited = touchL > 0 && (touchL > remoteAt || (lastSyncedAt > 0 && touchL > lastSyncedAt));
    const localDeletedAfterSync = delL > 0 && (delL > remoteAt || (lastSyncedAt > 0 && delL > lastSyncedAt));

    // Ignore deletion if locally touched more recently than tombstone
    const tombstoned = delT > 0 && touchL <= delT;
    if (tombstoned && (!rem || localDeletedAfterSync)) {
      if (loc) toDeleteLocally.push(k);
      continue;
    }

    if (loc && rem) {
      const mergedItem =
        kind === 'wellbeing'
          ? stripUndefined(localEdited ? { ...rem, ...loc } : { ...loc, ...rem })
          : stripUndefined(localEdited ? loc : rem);
      merged[k] = mergedItem;
      delete deleted[k];
      if (JSON.stringify(mergedItem) !== JSON.stringify(stripUndefined(loc))) {
        toPutLocally.push(mergedItem);
      }
    } else if (rem) {
      const cleanRem = stripUndefined(rem);
      merged[k] = cleanRem;
      delete deleted[k];
      toPutLocally.push(cleanRem);
    } else if (loc) {
      merged[k] = stripUndefined(loc);
      delete deleted[k];
    }
  }

  const remoteClean = stripUndefined(remoteItems);
  const remoteDelClean = remoteBucket?.deleted ?? {};
  const pushRemote =
    !remoteBucket ||
    JSON.stringify(merged) !== JSON.stringify(remoteClean) ||
    JSON.stringify(deleted) !== JSON.stringify(remoteDelClean);

  return { merged, deleted, toPutLocally, toDeleteLocally, pushRemote };
}

export interface SyncReport {
  pushedBuckets: number;
  pulledItems: number;
  deletedItems: number;
  settingsDirection: 'pushed' | 'pulled' | 'none';
  accountSwitched?: boolean;
  remoteWiped?: boolean;
  settingsConflict?: boolean;
}

export function hasCustomSettings(s: Settings): boolean {
  return Boolean(
    s.onboardingCompleted ||
      s.profile.goal ||
      s.profile.experience ||
      s.profile.daysPerWeek ||
      s.profile.sex !== DEFAULT_SETTINGS.profile.sex ||
      s.profile.age !== DEFAULT_SETTINGS.profile.age ||
      s.profile.height !== DEFAULT_SETTINGS.profile.height ||
      s.ai ||
      s.phases.length > 0 ||
      Object.keys(s.customNames).length > 0 ||
      Object.keys(s.refNames).length > 0 ||
      Object.keys(s.aliases).length > 0 ||
      Object.keys(s.notes).length > 0 ||
      Object.keys(s.muscles).length > 0 ||
      (s.hiddenExercises?.length ?? 0) > 0 ||
      JSON.stringify(s.routines) !== JSON.stringify(DEFAULT_SETTINGS.routines) ||
      JSON.stringify(s.routineMeta ?? {}) !== JSON.stringify(DEFAULT_SETTINGS.routineMeta ?? {}),
  );
}

/** Une ajustes remotos y locales conservando las opciones locales recientes en conflictos. */
export function mergeSyncSettings(local: Settings, remote: Settings): Settings {
  const hidden = [...new Set([...(remote.hiddenExercises ?? []), ...(local.hiddenExercises ?? [])])];
  return sanitizeSettings({
    ...remote,
    customNames: { ...remote.customNames, ...local.customNames },
    refNames: { ...remote.refNames, ...local.refNames },
    aliases: { ...remote.aliases, ...local.aliases },
    notes: { ...remote.notes, ...local.notes },
    muscles: { ...remote.muscles, ...local.muscles },
    ...(hidden.length ? { hiddenExercises: hidden } : {}),
  });
}

function mergeConcurrentSyncMeta(baseMeta: SyncMeta, sinceTs: number): SyncMeta {
  const latest = loadSyncMeta();
  if (latest.uid && baseMeta.uid && latest.uid !== baseMeta.uid) return baseMeta;
  const out: SyncMeta = {
    ...baseMeta,
    dirtyKeys: { ...baseMeta.dirtyKeys },
    deleted: { ...baseMeta.deleted },
  };
  if ((latest.settingsDirtyAt ?? 0) > sinceTs) {
    out.settingsDirtyAt = Math.max(out.settingsDirtyAt ?? 0, latest.settingsDirtyAt!);
  }
  if ((latest.pendingWipeAt ?? 0) > sinceTs) {
    out.pendingWipeAt = Math.max(out.pendingWipeAt ?? 0, latest.pendingWipeAt!);
  }
  for (const [bId, keys] of Object.entries(latest.dirtyKeys)) {
    for (const [k, ts] of Object.entries(keys)) {
      if (ts > sinceTs) {
        (out.dirtyKeys[bId] ??= {})[k] = ts;
        if (out.deleted[bId]) delete out.deleted[bId][k];
      }
    }
  }
  for (const [bId, keys] of Object.entries(latest.deleted)) {
    for (const [k, ts] of Object.entries(keys)) {
      if (ts > sinceTs) {
        (out.deleted[bId] ??= {})[k] = ts;
        if (out.dirtyKeys[bId]) delete out.dirtyKeys[bId][k];
      }
    }
  }
  for (const bId of Object.keys(out.deleted)) {
    if (Object.keys(out.deleted[bId]).length === 0) delete out.deleted[bId];
  }
  return out;
}

export async function syncWithCloud(uid: string): Promise<SyncReport> {
  const syncStartedAt = Date.now();
  let meta = loadSyncMeta();
  let accountSwitched = false;
  if (meta.uid && meta.uid !== uid) {
    // Impide fugar datos locales de una cuenta anterior hacia la nueva cuenta.
    await wipeAll();
    clearLocalDrafts();
    meta = emptyMeta(uid);
    saveSyncMeta(meta);
    accountSwitched = true;
  }
  meta.uid = uid;
  const now = Date.now();

  const settingsRef = doc(fs, 'users', uid, 'sync', 'settings');
  const bucketsCol = collection(fs, 'users', uid, 'buckets');

  const [settingsSnap, bucketsSnap] = await Promise.all([getDoc(settingsRef), getDocs(bucketsCol)]);
  const remoteSettings = settingsSnap.exists() ? (settingsSnap.data() as RemoteSettingsDoc) : null;

  // Handle pending local wipe first if newer than any cloud update
  if (meta.pendingWipeAt && (!remoteSettings || meta.pendingWipeAt >= remoteSettings.updatedAt)) {
    const bucketDocs = bucketsSnap.docs;
    for (let i = 0; i < bucketDocs.length; i += MAX_BATCH_OPS) {
      const batch = writeBatch(fs);
      bucketDocs.slice(i, i + MAX_BATCH_OPS).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    const localSettings = await loadSettings();
    const docBody: RemoteSettingsDoc = {
      data: stripUndefined(localSettings),
      updatedAt: now,
      wipedAt: meta.pendingWipeAt,
    };
    await setDoc(settingsRef, docBody);
    meta.pendingWipeAt = undefined;
    meta.settingsDirtyAt = undefined;
    meta.dirtyKeys = {};
    meta.deleted = {};
    meta.remoteUpdated = { settings: now };
    meta.lastSyncAt = now;
    saveSyncMeta(mergeConcurrentSyncMeta(meta, syncStartedAt));
    return { pushedBuckets: 0, pulledItems: 0, deletedItems: 0, settingsDirection: 'pushed', accountSwitched };
  }

  // Handle remote wipe triggered on another device
  if (
    remoteSettings?.wipedAt &&
    remoteSettings.wipedAt > (meta.lastSyncAt ?? 0) &&
    remoteSettings.wipedAt > (meta.settingsDirtyAt ?? 0)
  ) {
    await wipeAll();
    clearLocalDrafts();
    await saveSettings(sanitizeSettings(remoteSettings.data));
    meta = emptyMeta(uid);
    meta.remoteUpdated.settings = remoteSettings.updatedAt;
    meta.lastSyncAt = now;
    saveSyncMeta(meta);
    return { pushedBuckets: 0, pulledItems: 0, deletedItems: 0, settingsDirection: 'pulled', accountSwitched, remoteWiped: true };
  }

  // Sync settings (if local had rich settings prior to first cloud link and remote is bare default, push local)
  const localSettings = await loadSettings();
  const localWinsInitial =
    !meta.remoteUpdated.settings &&
    !meta.settingsDirtyAt &&
    remoteSettings != null &&
    hasCustomSettings(localSettings) &&
    !hasCustomSettings(remoteSettings.data);
  let settingsDirection: SyncReport['settingsDirection'] = 'none';
  let settingsConflict = false;
  if (!remoteSettings || localWinsInitial || (meta.settingsDirtyAt ?? 0) > remoteSettings.updatedAt) {
    const updatedAt = Math.max(now, meta.settingsDirtyAt ?? now);
    await setDoc(settingsRef, { data: stripUndefined(localSettings), updatedAt } satisfies RemoteSettingsDoc);
    meta.settingsDirtyAt = undefined;
    meta.remoteUpdated.settings = updatedAt;
    settingsDirection = 'pushed';
  } else if (remoteSettings.updatedAt > (meta.remoteUpdated.settings ?? 0)) {
    const cleanRemote = sanitizeSettings(remoteSettings.data);
    const hadLocalDirty = (meta.settingsDirtyAt ?? 0) > 0;
    const nextSettings = hadLocalDirty
      ? mergeSyncSettings(localSettings, cleanRemote)
      : cleanRemote;
    await saveSettings(nextSettings);
    if (hadLocalDirty) {
      settingsConflict = true;
      if (JSON.stringify(stripUndefined(nextSettings)) !== JSON.stringify(stripUndefined(cleanRemote))) {
        await setDoc(settingsRef, { data: stripUndefined(nextSettings), updatedAt: now } satisfies RemoteSettingsDoc);
        meta.remoteUpdated.settings = now;
      } else {
        meta.remoteUpdated.settings = remoteSettings.updatedAt;
      }
    } else {
      meta.remoteUpdated.settings = remoteSettings.updatedAt;
    }
    meta.settingsDirtyAt = undefined;
    settingsDirection = 'pulled';
  }

  // Load local collections and index remote buckets
  const remoteMap: Record<string, RemoteBucket> = {};
  bucketsSnap.forEach((d) => {
    remoteMap[d.id] = d.data() as RemoteBucket;
  });

  const allLocalBuckets: { kind: DataKind; id: string; items: Record<string, DataRecord> }[] = [];
  for (const kind of KINDS) {
    const rows = await getAll<DataRecord>(kind);
    const grouped = groupRecordsByBucket(kind, rows);
    for (const [bId, items] of Object.entries(grouped)) {
      allLocalBuckets.push({ kind, id: bId, items });
    }
  }

  const localBucketById = new Map(allLocalBuckets.map((b) => [b.id, b]));
  const allBucketIds = new Set([
    ...localBucketById.keys(),
    ...Object.keys(remoteMap),
    ...Object.keys(meta.dirtyKeys),
    ...Object.keys(meta.deleted),
  ]);

  let pushedBuckets = 0;
  let pulledItems = 0;
  let deletedItems = 0;
  const toWriteRemote: { id: string; doc: RemoteBucket }[] = [];

  for (const bId of allBucketIds) {
    const localEntry = localBucketById.get(bId);
    const remoteEntry = remoteMap[bId];
    const kind = (localEntry?.kind ?? remoteEntry?.kind ?? bId.split('_')[0]) as DataKind;

    const res = mergeBucket({
      kind,
      localItems: localEntry?.items ?? {},
      remoteBucket: remoteEntry,
      localDirtyKeys: meta.dirtyKeys[bId] ?? {},
      localDeleted: meta.deleted[bId] ?? {},
      lastSyncedAt: meta.remoteUpdated[bId] ?? meta.lastSyncAt ?? 0,
      now,
    });

    if (res.toPutLocally.length) {
      await putMany(kind, res.toPutLocally);
      pulledItems += res.toPutLocally.length;
    }
    for (const key of res.toDeleteLocally) {
      await deleteKey(kind, key);
      deletedItems++;
    }

    if (res.pushRemote) {
      const hasMergedItems = Object.keys(res.merged).length > 0;
      const hasMergedDeletes = Object.keys(res.deleted).length > 0;
      if (!hasMergedItems && (!remoteEntry || !hasMergedDeletes)) {
        if (remoteEntry) {
          await deleteDoc(doc(fs, 'users', uid, 'buckets', bId));
          pushedBuckets++;
        }
      } else {
        const nextDoc: RemoteBucket = {
          kind,
          items: stripUndefined(res.merged),
          deleted: res.deleted,
          updatedAt: now,
        };
        toWriteRemote.push({ id: bId, doc: nextDoc });
        meta.remoteUpdated[bId] = now;
        pushedBuckets++;
      }
    } else if (remoteEntry) {
      meta.remoteUpdated[bId] = remoteEntry.updatedAt;
    }

    delete meta.dirtyKeys[bId];
    delete meta.deleted[bId];
  }

  for (let i = 0; i < toWriteRemote.length; i += MAX_BATCH_OPS) {
    const batch = writeBatch(fs);
    for (const { id, doc: body } of toWriteRemote.slice(i, i + MAX_BATCH_OPS)) {
      batch.set(doc(fs, 'users', uid, 'buckets', id), body);
    }
    await batch.commit();
  }

  meta.lastSyncAt = now;
  saveSyncMeta(mergeConcurrentSyncMeta(meta, syncStartedAt));
  return {
    pushedBuckets,
    pulledItems,
    deletedItems,
    settingsDirection,
    accountSwitched,
    ...(settingsConflict ? { settingsConflict: true } : {}),
  };
}
