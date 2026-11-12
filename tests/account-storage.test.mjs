import test from "node:test";
import assert from "node:assert/strict";

async function fixture(t) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map();
  let fail = false;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        if (fail && key.includes("guided")) throw Error("quota");
        values.set(key, String(value));
      },
      removeItem: (key) => values.delete(key),
    },
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete globalThis.localStorage;
  });
  const store = await import(
    `../web/app/account-storage.js?test=${Math.random()}`
  );
  return { store, values, fail: () => (fail = true) };
}
const mastery = "abc-garden-mastery-v1";
const accountA = "11111111-1111-1111-1111-111111111111";
const accountB = "22222222-2222-2222-2222-222222222222";
const empty = () => ({ version: 1, subject: "abc", data: {} });

test("guest data is explicit, account scopes are isolated and pending data survives logout", async (t) => {
  const { store, values } = await fixture(t);
  store.learningStorage.setItem(
    mastery,
    JSON.stringify({
      version: 1,
      entries: { apple: { mastered: true, source: "manual", dates: [] } },
    }),
  );
  values.set("abc-garden-chinese-voice-v1", "device-specific");
  const guest = store.captureArchive();
  assert.equal(Object.keys(guest.data).length, 1);
  store.activateArchive(accountA, guest, { revision: 1 });
  store.learningStorage.setItem(
    mastery,
    JSON.stringify({ version: 1, entries: {} }),
  );
  assert.ok(store.localSyncState().dirty);
  store.activateArchive("guest", empty());
  assert.deepEqual(store.captureArchive(), empty());
  assert.ok(store.retainedArchive(accountA).dirty);
  assert.deepEqual(
    store.retainedArchive(accountA).snapshot.data[mastery].entries,
    {},
  );
  store.activateArchive(accountB, empty());
  assert.equal(store.learningStorage.getItem(mastery), null);
  assert.equal(values.get("abc-garden-chinese-voice-v1"), "device-specific");
});

test("failed multi-module restoration keeps old active data and unknown versions are rejected", async (t) => {
  const { store, fail } = await fixture(t);
  store.activateArchive(accountA, empty());
  const before = store.localAccount();
  fail();
  assert.throws(
    () =>
      store.activateArchive(accountB, {
        version: 1,
        subject: "abc",
        data: {
          [mastery]: { version: 1, entries: {} },
          "abc-garden-guided-words-v1": { version: 8, entries: {} },
        },
      }),
    /quota/,
  );
  assert.deepEqual(store.localAccount(), before);
  assert.deepEqual(store.captureArchive(), empty());
  assert.throws(() =>
    store.activateArchive(accountB, { version: 99, subject: "abc", data: {} }),
  );
});

test('a write during snapshot capture cannot pair old data with a new dirty token', async t => {
  const {store}=await fixture(t);
  store.activateArchive(accountA,empty(),{revision:1});
  store.learningStorage.setItem(mastery,JSON.stringify({version:1,entries:{apple:{mastered:false}}}));
  const original=localStorage.getItem;
  let inject=true;
  localStorage.getItem=key=>{
    const value=original(key);
    if(inject && key.endsWith(mastery)) {
      inject=false;
      store.learningStorage.setItem(mastery,JSON.stringify({version:1,entries:{apple:{mastered:true}}}));
    }
    return value;
  };
  assert.throws(()=>store.captureSyncBatch(),/另一页面/);
  assert.ok(store.localSyncState().dirty);
  assert.equal(store.captureSyncBatch().snapshot.data[mastery].entries.apple.mastered,true);
});
