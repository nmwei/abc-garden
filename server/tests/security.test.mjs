import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  verifyPassword,
  username,
  phoneNumber,
} from "../security.mjs";
import { openDatabase, consumeLimit } from "../database.mjs";

test("password hashes are salted and malformed credentials fail closed", async () => {
  const first = await hashPassword("a sufficiently long passphrase");
  const second = await hashPassword("a sufficiently long passphrase");
  assert.notEqual(first, second);
  assert.equal(
    await verifyPassword("a sufficiently long passphrase", first),
    true,
  );
  assert.equal(await verifyPassword("different password", first), false);
  assert.equal(await verifyPassword("different password", "malformed"), false);
  await assert.rejects(hashPassword("short"));
  assert.equal(username("Garden_123"), "Garden_123");
  assert.equal(username("Joy"), "Joy");
  assert.throws(() => username("Jo"));
  const numeric = await hashPassword("12345678");
  assert.equal(await verifyPassword("12345678", numeric), true);
  await assert.rejects(hashPassword("1234567"));
  assert.throws(() => username("13800138000"));
  assert.throws(() => phoneNumber("invalid"));
});

test("rate limit expiry and account uniqueness are enforced in storage", () => {
  const db = openDatabase(":memory:");
  try {
    assert.equal(consumeLimit(db, "login:one", 2, 1000, 0), true);
    assert.equal(consumeLimit(db, "login:one", 2, 1000, 1), true);
    assert.equal(consumeLimit(db, "login:one", 2, 1000, 2), false);
    assert.equal(consumeLimit(db, "login:one", 2, 1000, 1000), true);
    const insert = db.prepare(
      "INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    insert.run("a", "13800138000", "garden", "hash", "家长", "seed", 0, "v1");
    assert.doesNotThrow(() =>
      insert.run("b", "13900139000", "GARDEN", "hash", "家长", "seed", 0, "v1"),
    );
  } finally {
    db.close();
  }
});
