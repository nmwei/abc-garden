import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import Dypns from "@alicloud/dypnsapi20170525";
import OpenApi from "@alicloud/openapi-client";
import { consumeLimit } from "./database.mjs";
import { phoneNumber, digest } from "./security.mjs";

export class AccountError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function aliyunSms(config) {
  const client = new Dypns.default(
    new OpenApi.Config({
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      endpoint: "dypnsapi.aliyuncs.com",
      connectTimeout: 5000,
      readTimeout: 10000,
    }),
  );
  return async ({ phone, id }) => {
    const result = await client.sendSmsVerifyCode(
      new Dypns.SendSmsVerifyCodeRequest({
        phoneNumber: phone,
        signName: config.signName,
        templateCode: config.templateCode,
        templateParam: JSON.stringify({ code: "##code##", min: "5" }),
        codeLength: 6,
        codeType: 1,
        validTime: 300,
        interval: 60,
        duplicatePolicy: 1,
        returnVerifyCode: true,
        autoRetry: 0,
        outId: id,
      }),
    );
    const code = result.body?.model?.verifyCode;
    if (result.body?.code !== "OK" || !/^\d{6}$/.test(code || "")) {
      throw new AccountError("验证码暂时发送失败，请稍后再试", 503);
    }
    return code;
  };
}

export function createSmsService({
  db,
  send,
  secret,
  unitCostFen,
  dailyBudgetFen = 100,
  clock = Date.now,
}) {
  if (
    !Number.isInteger(unitCostFen) ||
    unitCostFen < 1 ||
    unitCostFen > dailyBudgetFen
  ) {
    throw new Error("需要配置短信实际单条价格（分）");
  }
  const codeHash = (id, code) =>
    createHmac("sha256", secret).update(`${id}:${code}`).digest("hex");
  const purposes = new Set(["register", "login", "reset"]);
  return {
    async request({ phone, purpose, ownerId = null, ip }) {
      if (typeof send !== "function")
        throw new AccountError("短信服务暂时不可用，请稍后再试", 503);
      phoneNumber(phone);
      if (!purposes.has(purpose)) throw new AccountError("验证码用途无效");
      const now = clock();
      if (!consumeLimit(db, `sms-ip:${digest(ip)}`, 6, 3600000, now)) {
        throw new AccountError("请求频繁，请稍后再试", 429);
      }
      const id = randomUUID();
      const day = new Date(now + 8 * 3600000).toISOString().slice(0, 10);
      db.transaction(() => {
        const recent = db
          .prepare(
            "SELECT created_at FROM sms_requests WHERE phone = ? ORDER BY created_at DESC LIMIT 1",
          )
          .get(phone);
        if (recent && recent.created_at > now - 60000)
          throw new AccountError("请一分钟后再获取验证码", 429);
        const count = db
          .prepare(
            "SELECT count(*) AS n FROM sms_requests WHERE phone = ? AND billing_day = ?",
          )
          .get(phone, day).n;
        if (count >= 5)
          throw new AccountError("此号码今天获取验证码较多，请明天再试", 429);
        const spent = db
          .prepare(
            "SELECT coalesce(sum(cost_fen), 0) AS total FROM sms_requests WHERE billing_day = ?",
          )
          .get(day).total;
        if (spent + unitCostFen > dailyBudgetFen)
          throw new AccountError("今天的短信额度已用完，可使用密码登录", 429);
        db.prepare(
          `INSERT INTO sms_requests
          (id, phone, purpose, owner_id, status, created_at, expires_at, cost_fen, billing_day)
          VALUES (?, ?, ?, ?, 'sending', ?, ?, ?, ?)`,
        ).run(id, phone, purpose, ownerId, now, now + 300000, unitCostFen, day);
      }).immediate();
      try {
        const code = await send({ phone, id });
        if (!/^\d{6}$/.test(code)) throw new Error("Invalid provider response");
        db.transaction(() => {
          db.prepare(
            "UPDATE sms_requests SET status = 'superseded', code_hash = NULL WHERE phone = ? AND status = 'ready'",
          ).run(phone);
          db.prepare(
            "UPDATE sms_requests SET status = 'ready', code_hash = ? WHERE id = ?",
          ).run(codeHash(id, code), id);
        }).immediate();
        return { challengeId: id, retryAfter: 60, expiresIn: 300 };
      } catch {
        // Unknown delivery outcomes keep their reserved budget. Never automatically resend.
        db.prepare(
          "UPDATE sms_requests SET status = 'failed' WHERE id = ?",
        ).run(id);
        throw new AccountError("短信发送未确认，请稍后重试或使用密码登录", 503);
      }
    },
    consume({ challengeId, code, phone, purpose, ownerId = null }, action) {
      if (
        typeof challengeId !== "string" ||
        typeof code !== "string" ||
        !/^\d{6}$/.test(code)
      ) {
        throw new AccountError("验证码无效或已过期");
      }
      const result = db
        .transaction(() => {
          const request = db
            .prepare("SELECT * FROM sms_requests WHERE id = ?")
            .get(challengeId);
          if (
            !request ||
            request.status !== "ready" ||
            request.expires_at <= clock() ||
            request.attempts >= 5 ||
            request.phone !== phone ||
            request.purpose !== purpose ||
            request.owner_id !== ownerId
          )
            return { invalid: true };
          db.prepare(
            "UPDATE sms_requests SET attempts = attempts + 1 WHERE id = ?",
          ).run(challengeId);
          if (
            !timingSafeEqual(
              Buffer.from(request.code_hash, "hex"),
              Buffer.from(codeHash(challengeId, code), "hex"),
            )
          )
            return { invalid: true };
          const value = action();
          db.prepare(
            "UPDATE sms_requests SET status = 'used', code_hash = NULL WHERE id = ?",
          ).run(challengeId);
          return { value };
        })
        .immediate();
      if (result.invalid) throw new AccountError("验证码无效或已过期");
      return result.value;
    },
  };
}
