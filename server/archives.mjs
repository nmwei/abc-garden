import { validateArchive } from "../web/app/archive-schema.js";
import { AccountError } from "./sms.mjs";

export function archiveRoutes(app, { db, session, clock = Date.now }) {
  db.exec(`DELETE FROM archive_checkpoints WHERE id IN (
    SELECT id FROM (SELECT id, row_number() OVER (PARTITION BY profile_id, subject ORDER BY id DESC) AS position FROM archive_checkpoints) WHERE position > 3
  )`);
  function profile(request, reply) {
    const account = session(request, reply);
    const row = db
      .prepare("SELECT id FROM profiles WHERE account_id = ? AND id = ?")
      .get(account.id, request.params.profileId);
    if (!row) throw new AccountError("学习档案不存在", 404);
    return row.id;
  }
  function read(profileId) {
    const archive = db
      .prepare(
        "SELECT * FROM archives WHERE profile_id = ? AND subject = 'abc'",
      )
      .get(profileId);
    return archive
      ? {
          revision: archive.revision,
          snapshot: JSON.parse(archive.snapshot),
          updatedAt: archive.updated_at,
        }
      : { revision: 0, snapshot: null, updatedAt: null };
  }
  app.get("/api/profiles/:profileId/abc", (request, reply) =>
    read(profile(request, reply)),
  );
  app.put("/api/profiles/:profileId/abc", (request, reply) => {
    const id = profile(request, reply),
      body = request.body || {};
    if (!Number.isSafeInteger(body.revision) || body.revision < 0)
      throw new AccountError("存档版本无效");
    let snapshot;
    try {
      snapshot = JSON.stringify(validateArchive(body.snapshot));
    } catch (error) {
      throw new AccountError(error.message);
    }
    return db
      .transaction(() => {
        const current = read(id);
        function finish(value) {
          if (body.checkpoint !== true) return value;
          const inserted = db
            .prepare(
              `INSERT OR IGNORE INTO archive_checkpoints
            (profile_id, subject, revision, snapshot, created_at) VALUES (?, 'abc', ?, ?, ?)`,
            )
            .run(id, value.revision, JSON.stringify(value.snapshot), clock());
          db.prepare(
            `DELETE FROM archive_checkpoints WHERE profile_id = ? AND subject = 'abc' AND id NOT IN
            (SELECT id FROM archive_checkpoints WHERE profile_id = ? AND subject = 'abc' ORDER BY id DESC LIMIT 3)`,
          ).run(id, id);
          return { ...value, checkpointCreated: inserted.changes === 1 };
        }
        // A retry cannot duplicate a checkpoint, even when the first response was lost.
        if (
          current.revision === body.revision + 1 &&
          JSON.stringify(current.snapshot) === snapshot
        )
          return finish(current);
        if (current.revision !== body.revision) {
          reply.code(409);
          return {
            error: "另一台设备更新了存档，请选择保留的记录",
            ...current,
          };
        }
        if (current.snapshot && JSON.stringify(current.snapshot) === snapshot)
          return finish(current);
        const now = clock();
        db.prepare(
          `INSERT INTO archives VALUES (?, 'abc', ?, ?, ?) ON CONFLICT(profile_id, subject)
        DO UPDATE SET revision = excluded.revision, snapshot = excluded.snapshot, updated_at = excluded.updated_at`,
        ).run(id, current.revision + 1, snapshot, now);
        return finish(read(id));
      })
      .immediate();
  });
  app.get("/api/profiles/:profileId/abc/history", (request, reply) => {
    const id = profile(request, reply);
    return {
      versions: db
        .prepare(
          `SELECT revision, created_at AS savedAt FROM archive_checkpoints
      WHERE profile_id = ? AND subject = 'abc' ORDER BY id DESC LIMIT 3`,
        )
        .all(id),
    };
  });
  app.get(
    "/api/profiles/:profileId/abc/history/:revision",
    (request, reply) => {
      const id = profile(request, reply);
      const row = db
        .prepare(
          `SELECT snapshot, revision, created_at AS updatedAt FROM archive_checkpoints
      WHERE profile_id = ? AND subject = 'abc' AND revision = ?`,
        )
        .get(id, Number(request.params.revision));
      if (!row) throw new AccountError("此历史记录已不存在", 404);
      return { ...row, snapshot: JSON.parse(row.snapshot) };
    },
  );
}
