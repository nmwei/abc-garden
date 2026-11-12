import Database from "better-sqlite3";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";

export function openDatabase(filename) {
  if (filename !== ":memory:")
    mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
  const db = new Database(filename);
  if (filename !== ":memory:") chmodSync(filename, 0o600);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  const version = db.pragma("user_version", { simple: true });
  if (version !== 0 && version !== 3) {
    db.close();
    throw new Error("数据库格式不受支持，原文件未修改");
  }
  if (version === 0)
    db.transaction(() => {
      db.exec(`
      CREATE TABLE accounts (
        id TEXT PRIMARY KEY,
        phone TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL UNIQUE COLLATE BINARY,
        password_hash TEXT NOT NULL,
        nickname TEXT NOT NULL,
        avatar TEXT NOT NULL DEFAULT 'seed',
        created_at INTEGER NOT NULL,
        consent_version TEXT NOT NULL
      ) STRICT;
      CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        verified_at INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX sessions_account ON sessions(account_id);
      CREATE TABLE profiles (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        UNIQUE(account_id, id)
      ) STRICT;
      CREATE TABLE archives (
        profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        subject TEXT NOT NULL,
        revision INTEGER NOT NULL,
        snapshot TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY(profile_id, subject)
      ) STRICT;
      CREATE TABLE archive_checkpoints (
        id INTEGER PRIMARY KEY,
        profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        subject TEXT NOT NULL,
        revision INTEGER NOT NULL,
        snapshot TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(profile_id, subject, revision)
      ) STRICT;
      CREATE TABLE sms_requests (
        id TEXT PRIMARY KEY,
        phone TEXT NOT NULL,
        purpose TEXT NOT NULL,
        owner_id TEXT,
        status TEXT NOT NULL,
        code_hash TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        cost_fen INTEGER NOT NULL,
        billing_day TEXT NOT NULL
      ) STRICT;
      CREATE INDEX sms_phone ON sms_requests(phone, created_at);
      CREATE TABLE rate_limits (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      ) STRICT;
      CREATE TABLE deletion_log (
        account_id TEXT PRIMARY KEY,
        deleted_at INTEGER NOT NULL
      ) STRICT;
      PRAGMA user_version = 3;
    `);
    })();
  return db;
}

export function consumeLimit(db, key, maximum, windowMs, now = Date.now()) {
  return db
    .transaction(() => {
      db.prepare("DELETE FROM rate_limits WHERE expires_at <= ?").run(now);
      const current = db
        .prepare("SELECT count FROM rate_limits WHERE key = ?")
        .get(key);
      if (current?.count >= maximum) return false;
      db.prepare(
        `INSERT INTO rate_limits VALUES (?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET count = count + 1`,
      ).run(key, now + windowMs);
      return true;
    })
    .immediate();
}
