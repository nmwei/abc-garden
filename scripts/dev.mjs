import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";

await mkdir(".runtime", { recursive: true, mode: 0o700 });
let secret;
try {
  secret = await readFile(".runtime/dev-secret", "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  secret = randomBytes(32).toString("hex");
  await writeFile(".runtime/dev-secret", secret, { mode: 0o600, flag: "wx" });
}
const env = {
  ...process.env,
  GARDEN_AUTH_SECRET: process.env.GARDEN_AUTH_SECRET || secret,
  PNVS_UNIT_COST_FEN: process.env.PNVS_UNIT_COST_FEN || "6",
};
const children = [
  spawn(process.execPath, ["server/main.mjs"], { stdio: "inherit", env }),
  spawn(process.execPath, ["scripts/serve.mjs"], { stdio: "inherit", env }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = code;
}
for (const child of children) {
  child.on("error", () => stop(1));
  child.on("exit", (code) => stop(code || 0));
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
