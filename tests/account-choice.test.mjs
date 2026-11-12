import test from "node:test";
import assert from "node:assert/strict";

test("archive selection rechecks cloud revisions and preserves edits made during a request", async (t) => {
  const names = [
    "localStorage",
    "dispatchEvent",
    "addEventListener",
    "location",
    "fetch",
    "setInterval",
    "navigator",
  ];
  const originals = new Map(
    names.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const values = new Map();
  let reloads = 0,
    calls = 0,
    respond;
  Object.assign(globalThis, {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
    },
    dispatchEvent: () => {},
    addEventListener: () => {},
    location: { reload: () => reloads++ },
    setInterval: () => 0,
    fetch: async (...args) => {
      calls++;
      return respond(...args);
    },
  });
  const store = await import("../web/app/account-storage.js");
  const client = await import("../web/app/account-client.js");
  const account = {
    id: "11111111-1111-1111-1111-111111111111",
    profileId: "profile",
  };
  const empty = { version: 1, subject: "abc", data: {} };
  const master = "abc-garden-mastery-v1";
  store.activateArchive(account.id, empty, { revision: 1 });
  client.accountState.account = account;
  const remote = { revision: 1, snapshot: empty, updatedAt: 1 };
  const choice = () =>
    (client.accountState.conflict = client.archiveChoice(
      store.captureArchive(),
      remote,
      { activeLocal: true },
    ));
  const response = (body, status = 200) =>
    new Response(JSON.stringify(body), { status });

  choice();
  respond = () => response({ ...remote, revision: 2, error: "conflict" }, 409);
  await assert.rejects(client.chooseArchive("local"), /云端又有新记录/);
  assert.equal(client.accountState.conflict.remote.revision, 2);
  assert.equal(reloads, 0);
  respond = (_url, options) => {
    assert.equal(JSON.parse(options.body).revision, 2);
    return response({ ...remote, revision: 3 });
  };
  await client.chooseArchive("local");
  assert.equal(reloads, 1);

  choice();
  store.learningStorage.setItem(
    master,
    JSON.stringify({ version: 1, entries: {} }),
  );
  const before = calls;
  await assert.rejects(client.chooseArchive("remote"), /本机学习记录刚刚更新/);
  assert.equal(calls, before);
  assert.ok(client.accountState.conflict.local.data[master]);

  choice();
  respond = () => {
    store.learningStorage.setItem(
      master,
      JSON.stringify({ version: 1, entries: { apple: { mastered: true } } }),
    );
    return response(remote);
  };
  await assert.rejects(client.chooseArchive("remote"), /本机学习记录刚刚更新/);
  assert.equal(
    store.captureArchive().data[master].entries.apple.mastered,
    true,
  );
  assert.equal(reloads, 1);

  choice();
  client.accountState.conflict.local = { ...empty, version: 99 };
  const beforeInvalid = calls;
  await assert.rejects(client.chooseArchive("local"));
  assert.equal(
    calls,
    beforeInvalid,
    "invalid local data must never reach the cloud",
  );
  choice();
  client.accountState.account = {
    id: "22222222-2222-2222-2222-222222222222",
    profileId: "other",
  };
  const beforeSwitch = calls;
  await assert.rejects(client.chooseArchive("local"), /账号或存档选择已变化/);
  assert.equal(
    calls,
    beforeSwitch,
    "a stale choice cannot upload account A data to account B",
  );
  respond = () => response({ account });
  await client.refreshAccount();
  assert.equal(client.accountState.conflict, null);
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { onLine: true },
  });
  client.accountState.account = account;
  client.accountState.conflict = null;
  client.accountState.pending = null;
  store.activateArchive(account.id, empty, { revision: 1 });
  store.learningStorage.setItem(
    master,
    JSON.stringify({ version: 1, entries: {} }),
  );
  let finishAuto;
  respond = () =>
    new Promise((resolve) => {
      finishAuto = resolve;
    });
  const automatic = client.syncArchive();
  const manual = client.syncArchive({ checkpoint: true });
  await new Promise(resolve=>setTimeout(resolve,0));
  const sentBeforeManual = calls;
  respond = (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(
      body.revision,
      2,
      "manual save must use the acknowledged automatic revision",
    );
    assert.equal(body.checkpoint, true);
    return response({ revision: 2, updatedAt: 2, checkpointCreated: true });
  };
  await Promise.resolve();
  await Promise.resolve();
  finishAuto(response({ revision: 2, updatedAt: 2 }));
  await automatic;
  assert.equal((await manual).checkpointCreated, true);
  assert.equal(calls, sentBeforeManual + 1);
});
