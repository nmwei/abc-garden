import { deletionLedger } from "./deletions.mjs";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { archiveRoutes } from "./archives.mjs";
import { openDatabase, consumeLimit } from "./database.mjs";
import { createSmsService, AccountError } from "./sms.mjs";
import { accountRoutes } from "./accounts.mjs";
import { digest } from "./security.mjs";

export async function createApp({
  database = ":memory:",
  origin,
  secret,
  sendSms,
  unitCostFen,
  dailyBudgetFen = 100,
  ledgerPath,
  secure = true,
  registrationOpen = true,
  clock = Date.now,
}) {
  if (!origin || new URL(origin).origin !== origin)
    throw new Error("需要配置完整且无路径的站点来源");
  if (typeof secret !== "string" || secret.length < 32)
    throw new Error("需要至少 32 字符的服务端安全密钥");
  const db = openDatabase(database);
  const deletions = deletionLedger(ledgerPath);
  deletions.reconcile(db);
  const app = Fastify({
    bodyLimit: 1024 * 1024,
    requestTimeout: 15000,
    connectionTimeout: 15000,
    logger: false,
    trustProxy: secure ? "127.0.0.1" : false,
  });
  await app.register(cookie);
  app.addHook("onClose", async () => db.close());
  app.addHook("onRequest", async (request, reply) => {
    reply
      .header("Cache-Control", "no-store")
      .header("X-Content-Type-Options", "nosniff");
    if (
      !consumeLimit(db, `request:${digest(request.ip)}`, 300, 60000, clock())
    ) {
      throw new AccountError("请求频繁，请稍后重试", 429);
    }
    if (!["GET", "HEAD"].includes(request.method)) {
      if (
        request.headers.origin !== origin ||
        request.headers["x-garden-client"] !== "web-v1"
      ) {
        throw new AccountError("请求来源无效，请从花园页面操作", 403);
      }
      if (!request.headers["content-type"]?.startsWith("application/json")) {
        throw new AccountError("请求格式无效", 415);
      }
    }
  });
  app.setErrorHandler((error, request, reply) => {
    const status = error.statusCode || (error instanceof TypeError ? 400 : 500);
    const safe =
      error instanceof AccountError ||
      error.statusCode === 400 ||
      status === 413;
    reply
      .code(status)
      .send({
        error: safe
          ? error.message
          : status < 500
            ? "输入格式不正确"
            : "服务暂时不可用，请稍后重试",
      });
  });
  const sms = createSmsService({
    db,
    send: sendSms,
    secret,
    unitCostFen,
    dailyBudgetFen,
    clock,
  });
  const { session } = await accountRoutes(app, {
    db,
    sms,
    clock,
    secure,
    registrationOpen,
    deletions,
  });
  archiveRoutes(app, { db, session, clock });
  app.get("/api/health", () => {
    db.prepare("SELECT 1").get();
    return { ok: true };
  });
  return app;
}
