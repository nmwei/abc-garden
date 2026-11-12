// Isolated browser-test process. This fixture never calls an external SMS provider.
import { spawn } from "node:child_process";
import { createApp } from "../server/app.mjs";
let now = Date.now();
const api = await createApp({
  origin: "http://localhost:4283",
  secret: "isolated-browser-test-secret-123456789",
  secure: false,
  unitCostFen: 6,
  clock: () => now,
  sendSms: async () => "817264",
});
api.post("/api/__test/advance", () => {
  now += 86400000;
  return { ok: true };
});
await api.listen({ host: "127.0.0.1", port: 4284 });
const web = spawn(process.execPath, ["scripts/serve.mjs"], {
  stdio: "inherit",
  env: { ...process.env, PORT: "4283", GARDEN_API_PORT: "4284" },
});
const stop = async () => {
  web.kill("SIGTERM");
  await api.close();
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
web.once("exit", () => {
  api.close();
});
