import { resolve, isAbsolute } from "node:path";
import { createApp } from "./app.mjs";
import { aliyunSms } from "./sms.mjs";

if (process.env.GARDEN_ENV_FILE)
  process.loadEnvFile(process.env.GARDEN_ENV_FILE);
const env = process.env;
const production = env.NODE_ENV === "production";
const origin = env.GARDEN_ORIGIN || "http://localhost:4173";
if (production && !origin.startsWith("https://"))
  throw new Error("生产站点需要 HTTPS");
const ready = [
  "ALIYUN_ACCESS_KEY_ID",
  "ALIYUN_ACCESS_KEY_SECRET",
  "PNVS_SIGN_NAME",
  "PNVS_TEMPLATE_CODE",
].every((key) => env[key]);
const sendSms = ready
  ? aliyunSms({
      accessKeyId: env.ALIYUN_ACCESS_KEY_ID,
      accessKeySecret: env.ALIYUN_ACCESS_KEY_SECRET,
      signName: env.PNVS_SIGN_NAME,
      templateCode: env.PNVS_TEMPLATE_CODE,
    })
  : null;
if (
  production &&
  (!env.GARDEN_DATABASE ||
    !isAbsolute(env.GARDEN_DATABASE) ||
    !env.GARDEN_DELETION_LEDGER)
)
  throw new Error("生产数据库与删除台账需显式配置独立持久路径");
const app = await createApp({
  database: resolve(env.GARDEN_DATABASE || ".runtime/garden.sqlite"),
  origin,
  ledgerPath: env.GARDEN_DELETION_LEDGER || resolve(".runtime/deletions.jsonl"),
  secret: env.GARDEN_AUTH_SECRET,
  secure: production,
  sendSms,
  unitCostFen: Number(env.PNVS_UNIT_COST_FEN),
  dailyBudgetFen: 100,
  registrationOpen: env.GARDEN_REGISTRATION_OPEN !== "false",
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, async () => {
    await app.close();
    process.exit(0);
  });
await app.listen({
  host: "127.0.0.1",
  port: Number(env.GARDEN_API_PORT || 4174),
});
console.log(
  `Garden account API ready; SMS ${ready ? "configured" : "not configured"}`,
);
