import {
  openSync,
  closeSync,
  fsyncSync,
  writeSync,
  readFileSync,
  mkdirSync,
} from "node:fs";
import { dirname } from "node:path";

export function deletionLedger(path) {
  const ids = new Set();
  if (path) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    try {
      for (const line of readFileSync(path, "utf8")
        .split("\n")
        .filter(Boolean)) {
        const record = JSON.parse(line);
        if (
          !/^[a-f0-9-]{36}$/.test(record.id) ||
          !Number.isFinite(record.deletedAt)
        )
          throw new Error("删除记录损坏，请先恢复删除台账");
        ids.add(record.id);
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return {
    has: (id) => ids.has(id),
    append(id, deletedAt) {
      if (ids.has(id)) return;
      if (path) {
        const file = openSync(path, "a", 0o600);
        try {
          writeSync(file, JSON.stringify({ id, deletedAt }) + "\n");
          fsyncSync(file);
        } finally {
          closeSync(file);
        }
      }
      ids.add(id);
    },
    reconcile(db) {
      db.transaction(() => {
        for (const id of ids)
          db.prepare("DELETE FROM accounts WHERE id = ?").run(id);
      })();
    },
  };
}
