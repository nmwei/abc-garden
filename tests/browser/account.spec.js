import {seedLearning} from './storage-helpers.js';
import { test, expect } from "@playwright/test";
async function openParents(page) {
  const hold = page.locator("#parent-hold");
  // Initial session activation can reload once while this navigation starts.
  await expect(async()=>{
    await page.goto('/#/parents');
    await expect(page.locator('#parent-hold:visible, #word-editor:visible').first()).toBeVisible({timeout:1500});
  }).toPass({timeout:10000});
  if(await page.locator('#word-editor').isVisible())return;
  await hold.focus();
  await page.keyboard.down("Space");
  await page.waitForTimeout(1100);
  await page.keyboard.up("Space");
  await expect(page.locator("#word-editor")).toBeVisible();
}

async function clearDevice(page) {
  await page.goto("http://localhost:4283/missing-clear-page");
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise((resolve, reject) => {
      const r = indexedDB.deleteDatabase("abc-learning-workspace-v1");
      r.onsuccess = resolve;
      r.onerror = () => reject(r.error);
      r.onblocked = () => reject(Error("database still open"));
    });
  });
  await page.goto("/");
}

async function openArchive(page) {
  await page
    .locator(".account-hub")
    .getByRole("button", { name: "历史存档", exact: true })
    .click();
  await expect(page.locator(".account-dialog[open]")).toBeVisible();

}
async function closeAccountDialog(page) {
  const close = page.getByRole("button", { name: "关闭账号窗口", exact: true });
  if (await close.isVisible()) await close.click();
}

test("parent registration, archive claim, manual save and both login methods fit every device", async ({
  page,
}, info) => {
  const index = [
    "iPad-chromium",
    "iPad-webkit",
    "phone-chromium",
    "phone-webkit",
    "desktop-chromium",
    "desktop-webkit",
  ].indexOf(info.project.name);
  const phone = `1380013800${index}`,
    username = index === 0 ? "Joy" : `parent_${index}`;
  await seedLearning(page, {"abc-garden-mastery-v1":{version:1,entries:{apple:{mastered:true,source:"manual",dates:[]}}}});
  await openParents(page);
  await page.getByRole("button", { name: "登录 / 注册", exact: true }).click();
  await page.getByRole("button", { name: "还没有账号？去注册" }).click();
  await page.getByLabel("用户名（3–24 位，英文区分大小写）").fill(username);
  await page.getByLabel("手机号", { exact: true }).fill(phone);
  await page.getByRole("button", { name: "获取验证码", exact: true }).click();
  await expect(page.locator("[data-account-error]")).toContainText(
    "验证码已发送",
  );
  await page.locator("input[name=code]").fill("817264");
  await page.getByLabel("设置密码（至少 8 位，可为纯数字）").fill("28061439");
  await page.getByLabel("确认密码", { exact: true }).fill("28061438");
  await page.locator("input[name=consent]").check();
  let registerRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/auth/register")) registerRequests++;
  });
  await page.getByRole("button", { name: "创建账号", exact: true }).click();
  await expect(page.locator("[data-account-error]")).toContainText(
    "两次输入的密码不一致",
  );
  expect(registerRequests).toBe(0);
  await page.screenshot({
    path: `test-results/registration-${info.project.name}.png`,
    fullPage: false,
  });
  await page.getByLabel("确认密码", { exact: true }).fill("28061439");
  await page.getByRole("button", { name: "创建账号", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "选择这次继续的记录" }),
  ).toBeVisible();
  await Promise.all([
    page.waitForEvent("load"),
    page.getByRole("button", { name: /保存本机记录到账号/ }).click(),
  ]);
  await page.goto("/");
  await expect(page.locator("[data-parent-identity]")).toContainText(username);
  await page.screenshot({
    path: `test-results/home-identity-${info.project.name}.png`,
    fullPage: false,
  });
  await openParents(page, true);
  await expect(
    page.getByRole("heading", { name: "家长账号", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "重设密码", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "退出登录", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/parent-hub-${info.project.name}.png`,
    fullPage: false,
  });
  await page.locator("[data-account-command=save]").click();
  await expect(page.getByRole("heading", {name:"保存当前进度？"})).toBeVisible();
  await page.getByRole("button", {name:"取消", exact:true}).click();
  await openArchive(page);
  await expect(page.locator("[data-account-history]")).toHaveCount(0);
  await closeAccountDialog(page);
  await page.locator("[data-account-command=save]").click();
  await page.locator('[data-account-action="sync"]').click();
  await expect(page.locator("[data-parent-account-message]")).toContainText("存档已保存");
  await openArchive(page);
  await expect(
    page
      .locator(".account-dialog")
      .getByRole("heading", { name: "历史存档", exact: true }),
  ).toBeVisible();
  for (const label of [
    "保存资料",
    "更换手机号",
    "退出所有设备",
    "注销账号",
    "下载我的数据",
  ])
    await expect(
      page.getByRole("button", { name: label, exact: true }),
    ).toHaveCount(0);
  await closeAccountDialog(page);
  await page.locator("[data-account-command=save]").click();
  await expect(page.locator("[data-parent-account-message]")).toContainText("当前进度已有存档");
  await expect(page.locator(".account-dialog")).not.toBeVisible();
  await openArchive(page);
  expect(
    await page
      .locator(".account-dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/account-${info.project.name}.png`,
    fullPage: false,
  });
  await expect(page.locator("[data-account-history]")).toHaveCount(1);
  await page.screenshot({
    path: `test-results/manual-list-${info.project.name}.png`,
    fullPage: false,
  });
  await closeAccountDialog(page);
  const saved = await page.evaluate(async () => {
    const s = await (await fetch("/api/session")).json();
    return (await fetch(`/api/profiles/${s.account.profileId}/abc`)).json();
  });
  expect(
    saved.snapshot.data["abc-garden-mastery-v1"].entries.apple.mastered,
  ).toBe(true);
  await closeAccountDialog(page);
  await Promise.all([
    page.waitForEvent("load"),
    page.getByRole("button", { name: "退出登录", exact: true }).click(),
  ]);
  await openParents(page, true);
  await page.getByRole("button", { name: "登录 / 注册", exact: true }).click();
  await page.getByLabel("用户名或手机号").fill(username);
  await page.getByLabel("密码", { exact: true }).fill("28061439");
  await page.getByRole("button", { name: "登录小花园", exact: true }).click();
  await Promise.all([
    page.waitForEvent("load"),
    page.getByRole("button", { name: /使用云端记录/ }).click(),
  ]);
  await clearDevice(page);
  await page.reload();
  await openParents(page, true);
  await openArchive(page);
  await Promise.all([
    page.waitForEvent("load"),
    page.getByRole("button", { name: /使用云端记录/ }).click(),
  ]);
  await openParents(page, true);
  await openArchive(page);
  await closeAccountDialog(page);
  await Promise.all([
    page.waitForEvent("load"),
    page.getByRole("button", { name: "退出登录", exact: true }).click(),
  ]);
  await openParents(page, true);
  await page.getByRole("button", { name: "登录 / 注册", exact: true }).click();
  await page.getByRole("button", { name: "短信登录", exact: true }).click();
  await page.evaluate(() =>
    fetch("/api/__test/advance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Garden-Client": "web-v1",
      },
      body: "{}",
    }),
  );
  await page.getByLabel("手机号", { exact: true }).fill(phone);
  await page.getByRole("button", { name: "获取验证码", exact: true }).click();
  await expect(page.locator("[data-account-error]")).toContainText(
    "验证码已发送",
  );
  await page.locator("input[name=code]").fill("817264");
  await page.getByRole("button", { name: "登录小花园", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "选择这次继续的记录" }),
  ).toBeVisible();
});

test("offline edits, a competing device and history restoration keep both versions recoverable", async ({
  page,
}, info) => {
  const index = [
    "iPad-chromium",
    "iPad-webkit",
    "phone-chromium",
    "phone-webkit",
    "desktop-chromium",
    "desktop-webkit",
  ].indexOf(info.project.name);
  await page.goto("/");
  const profileId = await page.evaluate(
    async ({ index }) => {
      const post = async (path, body) => {
        const response = await fetch("/api" + path, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Garden-Client": "web-v1",
          },
          body: JSON.stringify(body),
        });
        const result = await response.json();
        if (!response.ok) throw Error(result.error);
        return result;
      };
      await post("/__test/advance", {});
      const phone = `1340013400${index}`;
      const proof = await post("/auth/sms", { phone, purpose: "register" });
      const registered = await post("/auth/register", {
        phone,
        username: `archive_${index}`,
        password: "28061439",
        consent: true,
        challengeId: proof.challengeId,
        code: "817264",
      });
      return registered.account.profileId;
    },
    { index },
  );
  await page.reload();
  await expect.poll(async () => {
    try { return await page.evaluate(async()=> (await import('/app/account-storage.js')).localAccount().owner); }
    catch { return 'guest'; }
  }).not.toBe('guest');
  await openParents(page);
  const remote = () =>
    page.evaluate(
      async (profileId) =>
        (await fetch(`/api/profiles/${profileId}/abc`)).json(),
      profileId,
    );
  const edit = (mastered) =>
    page.evaluate(async (mastered) => {
      const { learningStorage } = await import("/app/account-storage.js");
      learningStorage.setItem(
        "abc-garden-mastery-v1",
        JSON.stringify({
          version: 1,
          entries: { apple: { mastered, source: "manual", dates: [] } },
        }),
      );
    }, mastered);
  await edit(true);
  await expect
    .poll(
      async () =>
        (await remote()).snapshot?.data["abc-garden-mastery-v1"]?.entries.apple
          .mastered,
    )
    .toBe(true);
  await page.locator("[data-account-command=save]").click();
  await page.locator('[data-account-action="sync"]').click();
  await expect(page.locator("[data-parent-account-message]")).toContainText("存档已保存");
  // The other device resets its own copy while this device is about to work offline.
  const before = await remote();
  await page.evaluate(
    async ({ profileId, revision }) => {
      const response = await fetch(`/api/profiles/${profileId}/abc`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Garden-Client": "web-v1",
        },
        body: JSON.stringify({
          revision,
          snapshot: { version: 1, subject: "abc", data: {} },
        }),
      });
      if (!response.ok) throw Error("competing save failed");
    },
    { profileId, revision: before.revision },
  );
  await page.context().setOffline(true);
  await edit(false);
  await expect(
    page
      .locator(".parent-archive-block")
      .getByText("已存本机，等待同步", { exact: true }),
  ).toBeVisible();
  await page.context().setOffline(false);
  await expect(
    page
      .locator(".parent-archive-block")
      .getByText("存档有不同版本，请选择", { exact: true }),
  ).toBeVisible();
  await openArchive(page);
  await expect(
    page.getByRole("heading", { name: "选择这次继续的记录" }),
  ).toBeVisible();
  await Promise.all([
    page.waitForEvent("load"),
    page.getByRole("button", { name: /保存本机记录到账号/ }).click(),
  ]);
  const after = await remote();
  expect(
    after.snapshot.data["abc-garden-mastery-v1"].entries.apple.mastered,
  ).toBe(false);
  await openParents(page);
  await openArchive(page);
  await page.screenshot({
    path: `test-results/history-${info.project.name}.png`,
    fullPage: false,
  });
  await page.locator(`[data-account-history="${before.revision}"]`).click();
  await expect(page.getByRole("heading", {name:"恢复这份存档？"})).toBeVisible();
  await expect(page.getByRole("button", {name:"使用云端记录"})).toHaveCount(0);
  await page.getByRole("button", {name:"取消",exact:true}).click();
  await expect(page.getByRole("heading", {name:"历史存档",exact:true})).toBeVisible();
  await page.locator(`[data-account-history="${before.revision}"]`).click();
  await Promise.all([
    page.waitForEvent("load"),
    page.getByRole("button", { name: "恢复此存档",exact:true }).click(),
  ]);
  expect(
    (await remote()).snapshot.data["abc-garden-mastery-v1"].entries.apple
      .mastered,
  ).toBe(true);
});

test("transactional workspace survives reload, preserves newer edits and excludes a second writer", async ({
  page,
  context,
}) => {
  await page.goto("http://localhost:4283/missing-clear-page");
  const legacy = JSON.stringify({
    version: 1,
    entries: { apple: { mastered: false } },
  });
  await page.evaluate(
    (value) => localStorage.setItem("abc-garden-mastery-v1", value),
    legacy,
  );
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const store = await import("/app/account-storage.js");
    if(Object.keys(store.captureArchive().data).length) throw Error("Old localStorage must not be imported");
    const key = "abc-garden-mastery-v1";
    store.learningStorage.setItem(
      key,
      JSON.stringify({ version: 1, entries: { apple: { mastered: true } } }),
    );
    await store.flushStorage();
    const sent = store.captureSyncBatch();
    store.learningStorage.setItem(
      key,
      JSON.stringify({ version: 1, entries: { apple: { mastered: false } } }),
    );
    store.markSynced(sent.state.dirty, 2, Date.now());
    await store.flushStorage();
    return {
      dirty: store.localSyncState().dirty,
      mastered: store.captureArchive().data[key].entries.apple.mastered,
    };
  });
  expect(result.dirty).toBeTruthy();
  expect(result.mastered).toBe(false);
  await page.reload();
  expect(
    await page.evaluate(async () =>
      Boolean((await import("/app/account-storage.js")).localSyncState().dirty),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() => localStorage.getItem("abc-garden-mastery-v1")),
  ).toBe(legacy);
  const other = await context.newPage();
  await other.goto("http://localhost:4283/");
  await expect(other.getByRole("alert")).toContainText("另一页面");
  expect(
    await other.evaluate(async () => {
      const { learningStorage } = await import("/app/account-storage.js");
      try {
        learningStorage.setItem("abc-garden-mastery-v1", "{}");
        return false;
      } catch {
        return true;
      }
    }),
  ).toBe(true);
  expect(await other.evaluate(async()=>{
    const client=await import('/app/account-client.js');
    const original=fetch; let calls=0;
    globalThis.fetch=async()=>{calls++;throw Error('unexpected request');};
    try { await client.chooseArchive('local'); } catch {}
    finally {globalThis.fetch=original;}
    return calls;
  })).toBe(0);
  await page.close();
  await other.reload();
  const generations = await other.evaluate(async () => {
    const store = await import("/app/account-storage.js");
    for (let i = 0; i < 12; i++)
      store.activateArchive("11111111-1111-1111-1111-111111111111", {
        version: 1,
        subject: "abc",
        data: {},
      });
    await store.flushStorage();
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("abc-learning-workspace-v1");
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("workspace");
        const get = tx.objectStore("workspace").get("active");
        get.onsuccess = () => {
          const groups = new Set(
            get.result.values
              .map(([key]) => key)
              .filter((key) => key.startsWith("abc-account-data-v1:"))
              .map((key) => key.split(":")[2]),
          );
          resolve(groups.size);
          db.close();
        };
        get.onerror = () => reject(get.error);
      };
    });
  });
  expect(generations).toBeLessThanOrEqual(3); // current, retained previous, and unsynced initial guest
  await other.close();
});

test("aborted local transactions are visible and can retry without losing the working copy", async ({
  page,
}) => {
  await page.goto("/");
  const failed = await page.evaluate(async () => {
    const store = await import("/app/account-storage.js");
    const original = IDBDatabase.prototype.transaction;
    let abortNext = true;
    IDBDatabase.prototype.transaction = function (...args) {
      const tx = original.apply(this, args);
      if (args[1] === "readwrite" && abortNext) {
        abortNext = false;
        queueMicrotask(() => tx.abort());
      }
      return tx;
    };
    try {
      store.learningStorage.setItem(
        "abc-garden-mastery-v1",
        JSON.stringify({ version: 1, entries: { apple: { mastered: true } } }),
      );
      try {
        await store.flushStorage();
        return false;
      } catch {
        return store.canRetryStorage();
      }
    } finally {
      IDBDatabase.prototype.transaction = original;
    }
  });
  expect(failed).toBe(true);
  await expect(page.getByRole("button", { name: "重试保存" })).toBeVisible();
  await page.getByRole("button", { name: "重试保存" }).click();
  await expect(page.getByRole("button", { name: "重试保存" })).toHaveCount(0);
  await page.reload();
  expect(
    await page.evaluate(
      async () =>
        (await import("/app/account-storage.js")).captureArchive().data[
          "abc-garden-mastery-v1"
        ].entries.apple.mastered,
    ),
  ).toBe(true);
});

test('parent editors span full rows on tablets and phones', async ({page}) => {
  await page.setViewportSize({width:834,height:1194});
  await openParents(page);
  const groups=page.locator('.parent-setting-group');
  const first=await groups.nth(0).boundingBox(), second=await groups.nth(1).boundingBox();
  expect(Math.abs(first.x-second.x)).toBeLessThan(2);
  expect(Math.abs(first.width-second.width)).toBeLessThan(2);
  expect(second.y).toBeGreaterThan(first.y+first.height);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'.playwright-cli/account-evidence/idb-tablet-portrait-cards.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  const phoneFirst=await groups.nth(0).boundingBox(), phoneSecond=await groups.nth(1).boundingBox();
  expect(Math.abs(phoneFirst.x-phoneSecond.x)).toBeLessThan(2);
  expect(phoneSecond.y).toBeGreaterThan(phoneFirst.y+phoneFirst.height);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'.playwright-cli/account-evidence/idb-phone-cards.png',fullPage:true});
  await page.goto('/');
  await expect(page.locator('[data-home-account]')).toHaveCount(0);
  await expect(page.locator('[data-action=parents]')).toHaveCount(1);
});
