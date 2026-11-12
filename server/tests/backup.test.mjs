import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../database.mjs";
import { backupDatabase, restoreDatabase } from "../backup.mjs";

test("encrypted backups authenticate bytes and restore into a new database with deletions applied", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "garden-backup-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const source = join(directory, "source.sqlite"),
    archive = join(directory, "archive.enc"),
    target = join(directory, "target.sqlite");
  const db = openDatabase(source),
    id = "11111111-1111-1111-1111-111111111111";
  db.prepare("INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
    id,
    "13800138000",
    "parent",
    "hash",
    "家长",
    "seed",
    0,
    "v1",
  );
  db.prepare("INSERT INTO profiles VALUES (?, ?, ?)").run(
    "profile",
    id,
    "学习",
  );
  const key = "ab".repeat(32);
  try {
    await backupDatabase(source, archive, key);
    assert.equal(
      (await readFile(archive)).includes(Buffer.from("13800138000")),
      false,
    );
    await assert.rejects(restoreDatabase(archive, target, "cd".repeat(32), []));
    await restoreDatabase(archive, target, key, [id]);
    const restored = openDatabase(target);
    try {
      assert.equal(
        restored.prepare("SELECT count(*) n FROM accounts").get().n,
        0,
      );
      assert.equal(
        restored.prepare("SELECT count(*) n FROM profiles").get().n,
        0,
      );
    } finally {
      restored.close();
    }
    await assert.rejects(restoreDatabase(archive, target, key, []), /已存在/);
  } finally {
    db.close();
  }
});
