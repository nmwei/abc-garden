import { randomUUID } from "node:crypto";
import {
  token,
  digest,
  DAY,
  hashPassword,
  verifyPassword,
  username,
  phoneNumber,
} from "./security.mjs";
import { consumeLimit } from "./database.mjs";
import { AccountError } from "./sms.mjs";

const COOKIE = "garden_session";

export async function accountRoutes(
  app,
  {
    db,
    sms,
    clock = Date.now,
    secure = true,
    registrationOpen = true,
    deletions,
  },
) {
  const dummyPassword = await hashPassword(token());
  const publicAccount = (account) => ({
    id: account.id,
    username: account.username,
    phone: `${account.phone.slice(0, 3)}****${account.phone.slice(-4)}`,
    profileId: db
      .prepare("SELECT id FROM profiles WHERE account_id = ?")
      .get(account.id)?.id,
  });
  function session(request, reply, required = true) {
    const raw = request.cookies[COOKIE];
    const now = clock();
    const row =
      typeof raw === "string" && raw.length <= 100
        ? db
            .prepare(
              `SELECT s.*, a.id, a.phone,
      a.username, a.nickname, a.avatar FROM sessions s JOIN accounts a ON a.id = s.account_id
      WHERE token_hash = ?`,
            )
            .get(digest(raw))
        : null;
    if (
      !row ||
      deletions.has(row.id) ||
      row.expires_at <= now ||
      row.created_at + 365 * DAY <= now
    ) {
      if (required) throw new AccountError("请先登录家长账号", 401);
      return null;
    }
    const expires = Math.min(now + 180 * DAY, row.created_at + 365 * DAY);
    db.prepare("UPDATE sessions SET expires_at = ? WHERE token_hash = ?").run(
      expires,
      row.token_hash,
    );
    reply.setCookie(COOKIE, raw, {
      path: "/api",
      httpOnly: true,
      sameSite: "lax",
      secure,
      expires: new Date(expires),
    });
    return row;
  }
  function login(account, reply) {
    if (deletions.has(account.id)) throw new AccountError("账号已注销", 401);
    const raw = token(),
      now = clock();
    db.prepare("INSERT INTO sessions VALUES (?, ?, ?, ?, ?)").run(
      digest(raw),
      account.id,
      now,
      now + 180 * DAY,
      now,
    );
    reply.setCookie(COOKIE, raw, {
      path: "/api",
      httpOnly: true,
      sameSite: "lax",
      secure,
      maxAge: 180 * 86400,
    });
    return { account: publicAccount(account) };
  }
  function throttle(request, identifier) {
    const now = clock();
    if (
      !consumeLimit(db, `auth-ip:${digest(request.ip)}`, 30, 900000, now) ||
      !consumeLimit(
        db,
        `auth-id:${digest(String(identifier))}`,
        10,
        900000,
        now,
      )
    ) {
      throw new AccountError("尝试次数较多，请稍后再试", 429);
    }
  }
  app.get("/api/session", (request, reply) => {
    const account = session(request, reply, false);
    return {
      account: account ? publicAccount(account) : null,
      registrationOpen,
    };
  });
  app.post("/api/auth/sms", async (request, reply) => {
    const body = request.body || {};
    if (body.purpose === "register" && !registrationOpen)
      throw new AccountError("暂时停止新注册", 503);
    return sms.request({
      phone: body.phone,
      purpose: body.purpose,
      ownerId: null,
      ip: request.ip,
    });
  });
  app.post("/api/auth/register", async (request, reply) => {
    if (!registrationOpen) throw new AccountError("暂时停止新注册", 503);
    const body = request.body || {};
    throttle(request, body.phone);
    const phone = phoneNumber(body.phone),
      name = username(body.username);
    if (body.consent !== true)
      throw new AccountError("请阅读并同意家长云存档说明");
    const password = await hashPassword(body.password);
    const account = sms.consume({ ...body, phone, purpose: "register" }, () => {
      if (
        db
          .prepare("SELECT id FROM accounts WHERE phone = ? OR username = ?")
          .get(phone, name)
      ) {
        throw new AccountError("手机号或用户名已注册，请登录或更换用户名", 409);
      }
      const id = randomUUID();
      db.prepare("INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
        id,
        phone,
        name,
        password,
        "花园家长",
        "seed",
        clock(),
        "2026-11-v1",
      );
      db.prepare("INSERT INTO profiles VALUES (?, ?, ?)").run(
        randomUUID(),
        id,
        "我的学习档案",
      );
      return db.prepare("SELECT * FROM accounts WHERE id = ?").get(id);
    });
    return login(account, reply);
  });
  app.post("/api/auth/login-password", async (request, reply) => {
    const body = request.body || {};
    if (typeof body.identifier !== "string" || body.identifier.length > 100)
      throw new AccountError("请输入用户名或手机号");
    throttle(request, body.identifier);
    const account = db
      .prepare("SELECT * FROM accounts WHERE username = ? OR phone = ?")
      .get(body.identifier, body.identifier);
    const valid = await verifyPassword(
      body.password,
      account?.password_hash || dummyPassword,
    );
    if (!account || !valid)
      throw new AccountError("用户名、手机号或密码不正确", 401);
    return login(account, reply);
  });
  app.post("/api/auth/login-sms", (request, reply) => {
    const body = request.body || {};
    throttle(request, body.phone);
    const phone = phoneNumber(body.phone);
    const account = sms.consume({ ...body, phone, purpose: "login" }, () => {
      const row = db
        .prepare("SELECT * FROM accounts WHERE phone = ?")
        .get(phone);
      if (!row) throw new AccountError("此手机号尚未注册，请先创建账号", 404);
      return row;
    });
    return login(account, reply);
  });
  app.post("/api/auth/reset", async (request, reply) => {
    const body = request.body || {};
    throttle(request, body.phone);
    const phone = phoneNumber(body.phone),
      password = await hashPassword(body.password);
    sms.consume({ ...body, phone, purpose: "reset" }, () => {
      const account = db
        .prepare("SELECT id FROM accounts WHERE phone = ?")
        .get(phone);
      if (!account) throw new AccountError("此手机号尚未注册", 404);
      db.prepare("UPDATE accounts SET password_hash = ? WHERE id = ?").run(
        password,
        account.id,
      );
      db.prepare("DELETE FROM sessions WHERE account_id = ?").run(account.id);
    });
    reply.clearCookie(COOKIE, { path: "/api" });
    return { ok: true };
  });
  app.post("/api/auth/logout", (request, reply) => {
    if (request.cookies[COOKIE])
      db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(
        digest(request.cookies[COOKIE]),
      );
    reply.clearCookie(COOKIE, { path: "/api" });
    return { ok: true };
  });
  return { session, publicAccount };
}
