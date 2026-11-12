import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdtemp, readFile, writeFile, rm, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";

function keyBytes(key) {
  if (typeof key !== "string" || !/^[a-f0-9]{64}$/i.test(key))
    throw new Error("备份密钥应为独立保存的 32 字节十六进制密钥");
  return Buffer.from(key, "hex");
}
export async function backupDatabase(database, destination, key) {
  const temp = await mkdtemp(join(tmpdir(), "garden-backup-"));
  const db = new Database(database, { readonly: true, fileMustExist: true });
  try {
    const snapshot = join(temp, "snapshot.sqlite");
    await db.backup(snapshot);
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", keyBytes(key), iv);
    const ciphertext = Buffer.concat([
      cipher.update(await readFile(snapshot)),
      cipher.final(),
    ]);
    const envelope = Buffer.concat([
      Buffer.from("GARDEN1\n"),
      iv,
      cipher.getAuthTag(),
      ciphertext,
    ]);
    await writeFile(destination, envelope, { mode: 0o600, flag: "wx" });
  } finally {
    db.close();
    await rm(temp, { recursive: true, force: true });
  }
}

// The operator must supply the latest deletion ledger from an independent location.
// Never restore an old backup without reconciling deletions made after its creation.
export async function restoreDatabase(backup, destination, key, deletedIds) {
  if (
    !Array.isArray(deletedIds) ||
    deletedIds.some(
      (id) => typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id),
    )
  )
    throw new Error("需要最新删除记录");
  try {
    await access(destination);
    throw new Error("恢复目标已存在，请使用新的独立目录");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const envelope = await readFile(backup);
  if (envelope.subarray(0, 8).toString() !== "GARDEN1\n")
    throw new Error("备份格式不受支持");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    keyBytes(key),
    envelope.subarray(8, 20),
  );
  decipher.setAuthTag(envelope.subarray(20, 36));
  const bytes = Buffer.concat([
    decipher.update(envelope.subarray(36)),
    decipher.final(),
  ]);
  const temp = await mkdtemp(join(tmpdir(), "garden-restore-"));
  let db;
  try {
    const staging = join(temp, "restored.sqlite");
    await writeFile(staging, bytes, { mode: 0o600, flag: "wx" });
    db = new Database(staging);
    if (db.pragma("integrity_check", { simple: true }) !== "ok")
      throw new Error("备份完整性检查失败");
    if (![1, 2, 3].includes(db.pragma("user_version", { simple: true })))
      throw new Error("需要与备份格式兼容的程序");
    db.pragma("foreign_keys = ON");
    db.transaction(() => {
      for (const id of deletedIds)
        db.prepare("DELETE FROM accounts WHERE id = ?").run(id);
      db.prepare("DELETE FROM sessions").run();
      db.prepare("DELETE FROM sms_requests").run();
      // A restored database cannot know charges incurred after the backup.
      // Reserve the remaining day's entire SMS budget instead of risking an overrun.
      const now = Date.now();
      const day = new Date(now + 8 * 3600000).toISOString().slice(0, 10);
      db.prepare(
        `INSERT INTO sms_requests
        (id, phone, purpose, status, created_at, expires_at, cost_fen, billing_day)
        VALUES (?, '', 'restore-budget', 'reserved', ?, ?, 100, ?)`,
      ).run("restore-" + day, now, now, day);
    })();
    db.pragma("wal_checkpoint(TRUNCATE)");
    db.close();
    db = null;
    await writeFile(destination, await readFile(staging), {
      mode: 0o600,
      flag: "wx",
    });
  } finally {
    db?.close();
    await rm(temp, { recursive: true, force: true });
  }
}
