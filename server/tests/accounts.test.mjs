import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../app.mjs";

async function fixture(t, options = {}) {
  let now = Date.UTC(2026, 10, 11),
    sends = 0;
  const origin = "http://localhost:4173";
  const app = await createApp({
    origin,
    secret: "test-secret-for-isolated-tests-only",
    secure: false,
    unitCostFen: 6,
    clock: () => now,
    sendSms: async () => {
      sends++;
      return "817264";
    },
    ...options,
  });
  t.after(() => app.close());
  const call = async (url, body, cookieValue, method = "POST") =>
    app.inject({
      method,
      url,
      headers: {
        origin,
        "x-garden-client": "web-v1",
        "content-type": "application/json",
        ...(cookieValue ? { cookie: cookieValue } : {}),
      },
      ...(method === "GET" ? {} : { payload: body }),
    });
  const sms = async (phone, purpose) => {
    now += 61000;
    const response = await call("/api/auth/sms", { phone, purpose });
    assert.equal(response.statusCode, 200, response.body);
    return { phone, challengeId: response.json().challengeId, code: "817264" };
  };
  return { app, call, sms, advance: (ms) => (now += ms), sends: () => sends };
}

test("verified registration, both login paths, persistent session and logout", async (t) => {
  const f = await fixture(t);
  const proof = await f.sms("13800138000", "register");
  const registered = await f.call("/api/auth/register", {
    ...proof,
    username: "Garden_One",
    password: "long enough password",
    consent: true,
  });
  assert.equal(registered.statusCode, 200, registered.body);
  const id = registered.json().account.id;
  const cookie = registered.cookies[0];
  assert.equal(cookie.httpOnly, true);
  assert.equal(cookie.path, "/api");
  assert.equal(cookie.maxAge, 180 * 86400);
  const sessionCookie = `${cookie.name}=${cookie.value}`;
  assert.equal(
    (
      await f.call("/api/auth/register", {
        ...proof,
        username: "another",
        password: "long enough password",
        consent: true,
      })
    ).statusCode,
    400,
  );
  for (const identifier of ["Garden_One", "13800138000"]) {
    const response = await f.call("/api/auth/login-password", {
      identifier,
      password: "long enough password",
    });
    assert.equal(response.json().account.id, id, response.body);
  }
  const smsLogin = await f.call(
    "/api/auth/login-sms",
    await f.sms("13800138000", "login"),
  );
  assert.equal(smsLogin.json().account.id, id);
  f.advance(100 * 86400000);
  const persisted = await f.call("/api/session", null, sessionCookie, "GET");
  assert.equal(persisted.json().account.id, id);
  await f.call("/api/auth/logout", {}, sessionCookie);
  assert.equal(
    (await f.call("/api/session", null, sessionCookie, "GET")).json().account,
    null,
  );
});

test("SMS purpose binding, failed attempts, CSRF and daily budget are enforced", async (t) => {
  const f = await fixture(t, { dailyBudgetFen: 12 });
  const proof = await f.sms("13800138001", "register");
  assert.equal((await f.call("/api/auth/login-sms", proof)).statusCode, 400);
  for (let i = 0; i < 5; i++) {
    const response = await f.call("/api/auth/register", {
      ...proof,
      code: "000000",
      username: "garden_two",
      password: "long enough password",
      consent: true,
    });
    assert.equal(response.statusCode, 400);
  }
  const exhausted = await f.call("/api/auth/register", {
    ...proof,
    username: "garden_two",
    password: "long enough password",
    consent: true,
  });
  assert.equal(exhausted.statusCode, 400);
  await f.sms("13800138002", "login");
  f.advance(61000);
  assert.equal(
    (await f.call("/api/auth/sms", { phone: "13800138003", purpose: "login" }))
      .statusCode,
    429,
  );
  assert.equal(f.sends(), 2);
  assert.equal(
    (
      await f.app.inject({
        method: "POST",
        url: "/api/auth/logout",
        payload: {},
      })
    ).statusCode,
    403,
  );
});

test("archive revisions prevent stale overwrites and account IDs cannot grant access", async (t) => {
  const f = await fixture(t);
  async function register(phone, name) {
    const result = await f.call("/api/auth/register", {
      ...(await f.sms(phone, "register")),
      username: name,
      password: "long enough password",
      consent: true,
    });
    assert.equal(result.statusCode, 200, result.body);
    return {
      account: result.json().account,
      cookie: `garden_session=${result.cookies[0].value}`,
    };
  }
  const first = await register("13900139000", "parent_first");
  const second = await register("13900139001", "parent_second");
  const url = `/api/profiles/${first.account.profileId}/abc`;
  const snapshot = {
    version: 1,
    subject: "abc",
    data: {
      "abc-garden-mastery-v1": {
        version: 1,
        entries: { apple: { mastered: true, source: "manual", dates: [] } },
      },
    },
  };
  const saved = await f.call(
    url,
    { revision: 0, snapshot },
    first.cookie,
    "PUT",
  );
  assert.equal(saved.json().revision, 1, saved.body);
  assert.equal(
    (await f.call(url, { revision: 0, snapshot }, first.cookie, "PUT")).json()
      .revision,
    1,
  );
  const empty = { version: 1, subject: "abc", data: {} };
  assert.equal(
    (await f.call(url, { revision: 0, snapshot: empty }, first.cookie, "PUT"))
      .statusCode,
    409,
  );
  assert.equal((await f.call(url, null, second.cookie, "GET")).statusCode, 404);
  assert.equal(
    (
      await f.call(
        url,
        { revision: 1, snapshot: empty, accountId: first.account.id },
        second.cookie,
        "PUT",
      )
    ).statusCode,
    404,
  );
  assert.equal(
    (
      await f.call(
        url,
        { revision: 1, snapshot: { ...snapshot, version: 99 } },
        first.cookie,
        "PUT",
      )
    ).statusCode,
    400,
  );
  assert.deepEqual(
    (await f.call(url, null, first.cookie, "GET")).json().snapshot,
    snapshot,
  );
  assert.equal(
    (await f.call(`${url}/history`, null, first.cookie, "GET")).json().versions
      .length,
    0,
  );
  for (let revision = 1; revision <= 7; revision++) {
    const updated = await f.call(
      url,
      { revision, snapshot: revision % 2 ? empty : snapshot, checkpoint: true },
      first.cookie,
      "PUT",
    );
    assert.equal(updated.json().revision, revision + 1);
  }
  const history = await f.call(`${url}/history`, null, first.cookie, "GET");
  assert.deepEqual(
    history.json().versions.map((row) => row.revision),
    [8, 7, 6],
  );
  assert.equal(
    (await f.call(`${url}/history/1`, null, first.cookie, "GET")).statusCode,
    404,
  );
  assert.equal(
    (await f.call(`${url}/history`, null, second.cookie, "GET")).statusCode,
    404,
  );
  assert.equal(
    (await f.call(`${url}/history/7`, null, second.cookie, "GET")).statusCode,
    404,
  );
  // Dozens of automatic writes must not displace any of the three deliberate saves.
  for (let revision = 8; revision < 28; revision++) {
    const updated = await f.call(
      url,
      { revision, snapshot: revision % 2 ? empty : snapshot },
      first.cookie,
      "PUT",
    );
    assert.equal(updated.statusCode, 200, updated.body);
  }
  assert.deepEqual(
    (await f.call(`${url}/history`, null, first.cookie, "GET")).json(),
    history.json(),
  );
  const previous = await f.call(`${url}/history/7`, null, first.cookie, "GET");
  const restored = await f.call(
    url,
    { revision: 28, snapshot: previous.json().snapshot },
    first.cookie,
    "PUT",
  );
  assert.equal(restored.json().revision, 29);
  assert.deepEqual(restored.json().snapshot, snapshot);
  const manual = await f.call(
    url,
    { revision: 29, snapshot, checkpoint: true },
    first.cookie,
    "PUT",
  );
  assert.equal(manual.json().checkpointCreated, true);
  const retry = await f.call(
    url,
    { revision: 29, snapshot, checkpoint: true },
    first.cookie,
    "PUT",
  );
  assert.equal(retry.json().checkpointCreated, false);
  const reset = await f.call("/api/auth/reset", {
    ...(await f.sms("13900139000", "reset")),
    password: "a new password value",
  });
  assert.equal(reset.statusCode, 200, reset.body);
  assert.equal((await f.call(url, null, first.cookie, "GET")).statusCode, 401);
});

test("Joy and joy are separate logins and an eight-digit password is supported", async (t) => {
  const f = await fixture(t);
  for (const [phone, name] of [
    ["13700137000", "Joy"],
    ["13700137001", "joy"],
  ]) {
    const registered = await f.call("/api/auth/register", {
      ...(await f.sms(phone, "register")),
      username: name,
      password: "12345678",
      consent: true,
    });
    assert.equal(registered.statusCode, 200, registered.body);
    assert.equal(registered.json().account.username, name);
    const login = await f.call("/api/auth/login-password", {
      identifier: name,
      password: "12345678",
    });
    assert.equal(login.json().account.id, registered.json().account.id);
  }
  const wrongCase = await f.call("/api/auth/login-password", {
    identifier: "JOY",
    password: "12345678",
  });
  assert.equal(wrongCase.statusCode, 401);
});

test("removed account features are unavailable while password recovery revokes old sessions", async (t) => {
  const f = await fixture(t);
  const result = await f.call("/api/auth/register", {
    ...(await f.sms("13600136000", "register")),
    username: "Family",
    password: "28061439",
    consent: true,
  });
  const cookie = `garden_session=${result.cookies[0].value}`;
  for (const [path, method] of [
    ["/api/account/phone", "POST"],
    ["/api/auth/logout-all", "POST"],
    ["/api/account", "DELETE"],
    ["/api/account", "PATCH"],
    ["/api/account/export", "GET"],
  ]) {
    assert.equal((await f.call(path, {}, cookie, method)).statusCode, 404);
  }
  assert.equal(result.json().account.nickname, undefined);
  assert.equal(result.json().account.avatar, undefined);
  for (const purpose of ["phone", "delete"])
    assert.equal(
      (await f.call("/api/auth/sms", { phone: "13600136000", purpose }, cookie))
        .statusCode,
      400,
    );
  const reset = await f.call("/api/auth/reset", {
    ...(await f.sms("13600136000", "reset")),
    password: "86752413",
  });
  assert.equal(reset.statusCode, 200);
  assert.equal(
    (await f.call("/api/session", null, cookie, "GET")).json().account,
    null,
  );
  assert.equal(
    (
      await f.call("/api/auth/login-password", {
        identifier: "Family",
        password: "86752413",
      })
    ).statusCode,
    200,
  );
});
