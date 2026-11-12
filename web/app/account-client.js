import {
  captureArchive,
  flushStorage,
  storageWritable,
  storageNotice,
  captureSyncBatch,
  localAccount,
  localSyncState,
  markSynced,
  activateArchive,
  retainedArchive,
} from "./account-storage.js";

export const accountState = {
  account: null,
  status: "游客记录保存在这台设备",
  conflict: null,
  pending: null,
};
let timer, syncTask;
const emit = () => globalThis.dispatchEvent(new Event("garden-account-status"));
export async function accountApi(path, body, method = "POST") {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Garden-Client": "web-v1",
    },
    ...(method === "GET" ? {} : { body: JSON.stringify(body || {}) }),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response
    .json()
    .catch(() => ({ error: "账号服务暂时不可用" }));
  if (!response.ok)
    throw Object.assign(new Error(result.error || "请求失败"), {
      status: response.status,
      result,
    });
  return result;
}
const archiveUrl = () => `/profiles/${accountState.account.profileId}/abc`;
function updateAccount(account) {
  if (accountState.account?.id !== account?.id) {
    accountState.pending = null;
    accountState.conflict = null;
  }
  accountState.account = account;
}
export async function refreshAccount() {
  try {
    const { account } = await accountApi("/session", null, "GET");
    updateAccount(account);
    const owner = localAccount().owner;
    if (account && owner === account.id) {
      accountState.status = "正在检查云端存档";
      await syncArchive();
    } else if (account) accountState.status = "已登录，请确认使用哪份存档";
    else if (owner !== "guest")
      accountState.status = "本机记录已保留，请登录后继续同步";
    else accountState.status = "游客记录保存在这台设备";
  } catch {
    accountState.status = "离线可继续学习，联网后同步";
  }
  emit();
}
export async function prepareLogin(result) {
  updateAccount(result.account);
  const remote = await accountApi(archiveUrl(), null, "GET");
  if (accountState.account?.id !== result.account.id)
    throw new Error("账号已切换，请重新打开账号窗口");
  const owner = localAccount().owner;
  if (owner === result.account.id) {
    await syncArchive();
    return false;
  }
  const retained = retainedArchive(result.account.id);
  const local = retained?.dirty
      ? retained.snapshot
      : owner === "guest"
        ? captureArchive()
        : { version: 1, subject: "abc", data: {} };
  accountState.pending = archiveChoice(local, remote, {
    activeLocal: !retained?.dirty && owner === "guest",
  });
  emit();
  return true;
}
function localFingerprint() {
  return JSON.stringify([localAccount(), captureArchive()]);
}
export function archiveChoice(local, remote, options = {}) {
  return {
    local,
    remote,
    ...options,
    accountId: accountState.account?.id,
    fingerprint: localFingerprint(),
  };
}
let choosing = false;
export async function chooseArchive(source) {
  if (!storageWritable())
    throw new Error(storageNotice() || "当前页面不能修改学习记录");
  const choice = accountState.pending || accountState.conflict;
  if (!choice || choosing) return;
  choosing = true;
  const accountId = accountState.account.id;
  const url = archiveUrl();
  const assertCurrent = () => {
    if (
      choice.accountId !== accountId ||
      accountState.account?.id !== accountId ||
      (accountState.pending || accountState.conflict) !== choice
    )
      throw new Error("账号或存档选择已变化，请重新打开账号窗口");
    if (localFingerprint() !== choice.fingerprint) {
      if (choice.activeLocal) choice.local = captureArchive();
      choice.fingerprint = localFingerprint();
      throw new Error("本机学习记录刚刚更新，请重新查看并选择，未覆盖本机记录");
    }
  };
  try {
    assertCurrent();
    const { validateRestore } = await import("./account-restore.js");
    assertCurrent();
    let selected;
    if (source === "local") {
      // Reject unrestorable data before it can replace a healthy cloud snapshot.
      validateRestore(choice.local);
      try {
        selected = await accountApi(
          url,
          {
            revision: choice.remote.revision,
            snapshot: choice.local,
          },
          "PUT",
        );
      } catch (error) {
        if (error.status === 409) {
          choice.remote = error.result;
          throw new Error(choice.history ? "其他设备更新了进度，请重新确认是否恢复这份存档" : "云端又有新记录，请重新查看并选择");
        }
        throw error;
      }
      choice.remote = selected;
    } else {
      selected = await accountApi(url, null, "GET");
      if (selected.revision !== choice.remote.revision) {
        choice.remote = selected;
        throw new Error(choice.history ? "其他设备更新了进度，请重新确认是否恢复这份存档" : "云端又有新记录，请重新查看并选择");
      }
    }
    assertCurrent();
    const snapshot = selected.snapshot || {
      version: 1,
      subject: "abc",
      data: {},
    };
    validateRestore(snapshot);
    activateArchive(accountId, snapshot, {
      revision: selected.revision,
      savedAt: selected.updatedAt || 0,
    });
    await flushStorage();
    if (choice.history) {
      try { globalThis.sessionStorage?.setItem("garden-restored-account", accountId); } catch {}
    }
    location.reload();
  } finally {
    choosing = false;
    emit();
  }
}
export async function syncArchive(options = {}) {
  while (syncTask) {
    if (!options.checkpoint) return;
    await syncTask;
  }
  if (options.checkpoint && !navigator.onLine)
    throw new Error("当前离线，进度已保存在本机，联网后再创建存档");
  const task = performSync(options);
  syncTask = task;
  try {
    return await task;
  } finally {
    if (syncTask === task) syncTask = null;
  }
}
async function performSync({ checkpoint = false } = {}) {
  if (!storageWritable()) {
    accountState.status = storageNotice();
    emit();
    return;
  }
  if (
    accountState.pending ||
    accountState.conflict ||
    !accountState.account ||
    !navigator.onLine
  )
    return;
  if (localAccount().owner !== accountState.account.id) return;
  const owner = localAccount();
  let local, state, persisted = false;
  const stillCurrent = () => {
    const active = localAccount();
    return (
      accountState.account?.id === owner.owner &&
      active.owner === owner.owner &&
      active.generation === owner.generation
    );
  };
  try {
    await flushStorage();
    persisted = true;
    const batch = captureSyncBatch();
    local = batch.snapshot;
    state = batch.state;
    let checkpointCreated;
    if (state.dirty || checkpoint) {
      accountState.status = "正在保存到云端";
      emit();
      const result = await accountApi(
        archiveUrl(),
        { revision: state.revision, snapshot: local, checkpoint },
        "PUT",
      );
      if (!stillCurrent()) return;
      markSynced(state.dirty, result.revision, result.updatedAt);
      checkpointCreated = result.checkpointCreated;
    } else {
      const remote = await accountApi(archiveUrl(), null, "GET");
      if (!stillCurrent()) return;
      if (remote.revision > state.revision) {
        // Keep both sides until the parent explicitly confirms a restore.
        accountState.conflict = archiveChoice(captureArchive(), remote, {
          activeLocal: true,
        });
        accountState.status = "另一台设备更新了存档，请查看";
        return;
      }
    }
    const saved = localSyncState();
    accountState.status = saved.dirty
      ? "已存本机，等待同步"
      : saved.savedAt
        ? "已保存到云端 · " +
          new Date(saved.savedAt).toLocaleString("zh-CN", {
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "已登录，学习后自动保存";
    return { checkpointCreated };
  } catch (error) {
    if (!stillCurrent()) return;
    if (!persisted) {
      accountState.status = "本机保存失败，请保留页面并重试";
      return;
    }
    if (error.status === 409) {
      accountState.conflict = archiveChoice(captureArchive(), error.result, {
        activeLocal: true,
      });
      accountState.status = "存档有不同版本，请选择";
    } else if (error.status === 401) {
      updateAccount(null);
      accountState.status = "已存本机，请重新登录后同步";
    } else accountState.status = "已存本机，云端保存失败，可重试";
  } finally {
    emit();
  }
}
export async function leaveAccount() {
  if (
    localSyncState().dirty &&
    !confirm(
      "还有未同步的记录。退出后会保留在此设备的账号存档中，重新登录可继续同步。确定退出？",
    )
  )
    return false;
  await accountApi("/auth/logout");
  activateArchive("guest", { version: 1, subject: "abc", data: {} });
  await flushStorage();
  location.reload();
  return true;
}
let saveEpoch = 0;
export function scheduleSync() {
  clearTimeout(timer);
  const epoch = ++saveEpoch;
  accountState.status = "正在保存到本机";
  emit();
  flushStorage().then(
    () => {
      if (epoch !== saveEpoch) return;
      accountState.status = accountState.account
        ? "已存本机，等待同步"
        : "游客记录保存在这台设备";
      emit();
      timer = setTimeout(() => syncArchive().catch(() => {}), 1200);
    },
    () => {
      accountState.status = "本机保存失败，请保留页面并重试";
      emit();
    },
  );
}
globalThis.addEventListener("garden-local-change", scheduleSync);
globalThis.addEventListener("online", refreshAccount);
globalThis.addEventListener("garden-account-changed", () => location.reload());
globalThis.addEventListener("focus", () => refreshAccount());
setInterval(() => syncArchive().catch(() => {}), 60000);
