import {definition, projectLearningValue} from './learning-data.js';
import { openLocalWorkspace } from "./local-database.js";
import { ARCHIVE_KEYS, validateArchive } from "./archive-schema.js";

const ACTIVE = "abc-account-active-v1";
const SAVED = "abc-account-saved-v1:";
const PREFIX = "abc-account-data-v1:";
const INITIAL_SCOPE = { owner: "guest", generation: "initial" };
let workspace = null;
if (globalThis.window) {
  try {
    workspace = await openLocalWorkspace();
  } catch (error) {
    document.body.innerHTML =
      '<main style="padding:32px;max-width:640px;margin:auto" role="alert"><h1>暂时无法打开本机学习记录</h1><p>原记录未删除。请关闭其他花园页面、检查设备剩余空间并更新浏览器后重试。</p><button id="retry-storage">重新加载</button></main>';
    document.getElementById("retry-storage").onclick = () => location.reload();
    throw error;
  }
}
const rawStorage = () => workspace?.storage || globalThis.localStorage;
let validationFault = "";
export const blockStorage = (message) => {
  validationFault = message;
};
export const storageWritable = () =>
  !validationFault && (workspace ? workspace.writable : true);
export const storageNotice = () => validationFault || workspace?.status() || "";
export const canRetryStorage = () =>
  !validationFault && Boolean(workspace?.canRetry());
export const retryStorage = async () => {
  if (validationFault) throw new Error(validationFault);
  await workspace?.retry();
};
export const flushStorage = () => workspace?.flush() || Promise.resolve();
const readScope = () =>
  JSON.parse(rawStorage().getItem(ACTIVE) || JSON.stringify(INITIAL_SCOPE));
let scope;
function current() {
  scope ||= readScope();
  const live = readScope();
  if (live.owner !== scope.owner || live.generation !== scope.generation)
    throw new Error("账号已在另一页面切换，请刷新");
  return scope;
}
function keyFor(key, selected = current()) {
  return `${PREFIX}${selected.owner}:${selected.generation}:${key}`;
}
function changed() {
  const selected = current();
  rawStorage().setItem(keyFor("$dirty"), crypto.randomUUID());
}

export const learningStorage = {
  whenSaved: flushStorage,
  getItem(key) {
    definition(key);
    return rawStorage().getItem(keyFor(key));
  },
  setItem(key, value) {
    definition(key);
    if (validationFault) throw new Error(validationFault);
    current();
    const parsed = JSON.parse(value);
    validateArchive({version:1,subject:'abc',data:{[key]:projectLearningValue(key,parsed)}});
    changed();
    rawStorage().setItem(keyFor(key), value);
    globalThis.dispatchEvent?.(new Event("garden-local-change"));
  },
  removeItem(key) {
    definition(key);
    if (validationFault) throw new Error(validationFault);
    current();
    changed();
    rawStorage().removeItem(keyFor(key));
    globalThis.dispatchEvent?.(new Event("garden-local-change"));
  },
};

export function localAccount() {
  return { ...current() };
}
export function localSyncState() {
  return {
    dirty: rawStorage().getItem(keyFor("$dirty")),
    revision: Number(rawStorage().getItem(keyFor("$revision")) || 0),
    savedAt: Number(rawStorage().getItem(keyFor("$savedAt")) || 0),
  };
}
export function markSynced(expectedDirty, revision, savedAt) {
  current();
  rawStorage().setItem(keyFor("$revision"), String(revision));
  rawStorage().setItem(keyFor("$savedAt"), String(savedAt));
  if (rawStorage().getItem(keyFor("$dirty")) === expectedDirty)
    rawStorage().removeItem(keyFor("$dirty"));
}
function captureScope(selected) {
  const data = {};
  for (const key of ARCHIVE_KEYS) {
    const value = rawStorage().getItem(keyFor(key, selected));
    if (value === null) continue;
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object")
      throw new Error("本机存档损坏，已暂停同步");
    data[key] = projectLearningValue(key, parsed);
  }
  return validateArchive({ version: 1, subject: "abc", data });
}

export function captureArchive() {
  return captureScope(current());
}
// Pair the exact outgoing snapshot with its dirty token. A concurrent writer
// invalidates the read; never acknowledge a token sampled after an older snapshot.
export function captureSyncBatch() {
  const before = localSyncState();
  const snapshot = captureArchive();
  const after = localSyncState();
  if (before.dirty !== after.dirty || before.revision !== after.revision)
    throw new Error("另一页面正在保存进度，请稍后重试同步");
  return { snapshot, state: before };
}
export function retainedArchive(owner) {
  const raw = rawStorage().getItem(SAVED + owner);
  if (!raw) return null;
  const selected = JSON.parse(raw);
  if (selected.owner !== owner) throw new Error("本机档案归属不一致");
  return {
    snapshot: captureScope(selected),
    dirty: rawStorage().getItem(keyFor("$dirty", selected)),
    revision: Number(rawStorage().getItem(keyFor("$revision", selected)) || 0),
  };
}

// Prepare all module values before atomically switching the active generation.
// A failed or interrupted restore leaves the previous generation addressable.
export function activateArchive(
  owner,
  snapshot,
  { revision = 0, dirty = false, savedAt = 0 } = {},
) {
  validateArchive(snapshot);
  if (owner !== "guest" && !/^[a-f0-9-]{36}$/.test(owner))
    throw new Error("账号标识无效");
  current();
  const next = { owner, generation: crypto.randomUUID() };
  const prepared = [];
  try {
    const values = {
      ...Object.fromEntries(
        Object.entries(snapshot.data).map(([key, value]) => [
          key,
          JSON.stringify(value),
        ]),
      ),
      $revision: String(revision),
      $savedAt: String(savedAt),
    };
    if (dirty) values.$dirty = crypto.randomUUID();
    for (const [key, value] of Object.entries(values)) {
      const storageKey = keyFor(key, next);
      rawStorage().setItem(storageKey, value);
      prepared.push(storageKey);
    }
    rawStorage().setItem(SAVED + scope.owner, JSON.stringify(scope));
    rawStorage().setItem(ACTIVE, JSON.stringify(next));
    scope = next;
    if (workspace) {
      const keep = new Set([`${PREFIX}${next.owner}:${next.generation}:`]);
      for (const key of rawStorage()
        .keys()
        .filter((key) => key.startsWith(SAVED))) {
        const saved = JSON.parse(rawStorage().getItem(key));
        keep.add(`${PREFIX}${saved.owner}:${saved.generation}:`);
      }
      for (const key of rawStorage().keys())
        if (key.startsWith(PREFIX) && key.endsWith(":$dirty"))
          keep.add(key.slice(0, -6));
      for (const key of rawStorage().keys())
        if (
          key.startsWith(PREFIX) &&
          ![...keep].some((prefix) => key.startsWith(prefix))
        )
          rawStorage().removeItem(key);
    }
  } catch (error) {
    for (const key of prepared) rawStorage().removeItem(key);
    throw error;
  }
}
