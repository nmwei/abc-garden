// The current whole-snapshot protocol needs one durable pending record, not a
// growing event log. A browser lock prevents two tabs from editing that record.
const DATABASE = "abc-learning-workspace-v1";
const STORE = "workspace";
export async function openLocalWorkspace() {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Error("请关闭其他旧版花园页面后重试"));
  });
  let writable = false,
    release;
  if (!navigator.locks)
    throw Error("当前浏览器不支持安全的多页面存储，请更新浏览器");
  await new Promise((resolve, reject) => {
    navigator.locks
      .request(DATABASE, { ifAvailable: true }, async (lock) => {
        writable = Boolean(lock);
        resolve();
        if (lock)
          await new Promise((done) => {
            release = done;
          });
      })
      .catch(reject);
  });
  const read = () =>
    new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).get("active");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  const previous = await read();
  const values = new Map(previous?.values || []);
  let pending = Promise.resolve(),
    scheduled = false,
    fault = null,
    revision = previous?.revision || 0,
    busy = 0;
  function commit() {
    busy++;
    const snapshot = [...values];
    const next = ++revision;
    pending = pending.then(
      () =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, "readwrite");
          tx.objectStore(STORE).put(
            { version: 1, revision: next, values: snapshot },
            "active",
          );
          tx.oncomplete = resolve;
          tx.onabort = () => reject(tx.error || Error("本机存储事务未完成"));
          tx.onerror = () => {};
        }),
    );
    pending.then(
      () => {
        busy--;
      },
      () => {
        busy--;
      },
    );
    pending.catch((error) => {
      fault = error;
      globalThis.dispatchEvent(new Event("garden-storage-failed"));
    });
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      commit();
    });
  }
  function requireWriter() {
    if (!writable)
      throw Error("另一页面正在使用学习记录，请关闭其他花园页面后刷新");
    if (fault) throw Error("本机存储失败，请保留此页并释放空间后重试");
  }
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      requireWriter();
      values.set(key, String(value));
      schedule();
    },
    removeItem(key) {
      requireWriter();
      values.delete(key);
      schedule();
    },
    keys: () => [...values.keys()],
  };
  async function flush() {
    let observed;
    do {
      await Promise.resolve();
      observed = pending;
      await observed;
    } while (scheduled || observed !== pending);
    if (fault) throw fault;
  }
  if (!previous && writable) {
    commit();
    await flush();
  }
  db.onversionchange = () => {
    writable = false;
    db.close();
    release?.();
  };
  addEventListener("pagehide", () => {
    writable = false;
    flush().then(
      () => {
        db.close();
        release?.();
      },
      () => {
        db.close();
        release?.();
      },
    );
  });
  addEventListener("pageshow", (event) => {
    if (event.persisted) location.reload();
  });
  addEventListener("beforeunload", (event) => {
    if (scheduled || busy || fault) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  if (!writable)
    queueMicrotask(() =>
      globalThis.dispatchEvent(new Event("garden-storage-readonly")),
    );
  return {
    storage,
    flush,
    get writable() {
      return writable;
    },
    canRetry: () => Boolean(fault && writable),
    async retry() {
      if (!writable) throw Error("请先关闭其他花园页面");
      pending = Promise.resolve();
      fault = null;
      commit();
      await flush();
    },
    status: () =>
      fault
        ? "本机存储失败，请保留此页并释放空间"
        : !writable
          ? "另一页面正在使用学习记录，请关闭其他花园页面后刷新"
          : busy || scheduled
            ? "正在保存到本机，请稍候再关闭页面"
            : "",
  };
}
