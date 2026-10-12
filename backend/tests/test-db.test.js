import { test } from "node:test";
import assert from "node:assert/strict";
import { assertTestDatabase } from "./helpers/test-db.js";

test("database bernama *_test diterima", () => {
  assert.doesNotThrow(() => assertTestDatabase("postgresql://u:p@localhost:5432/agrochie_test"));
  assert.doesNotThrow(() => assertTestDatabase("postgresql://u:p@localhost:5432/agrochie_test?schema=public"));
});

test("database kerja ditolak", () => {
  assert.throws(() => assertTestDatabase("postgresql://u:p@localhost:5432/agrochie"), /_test/);
  assert.throws(() => assertTestDatabase("postgresql://u:p@localhost:5432/testing"), /_test/);
});

test("'_test' hanya di host/sandi/query tidak cukup", () => {
  assert.throws(() => assertTestDatabase("postgresql://u:p_test@localhost:5432/agrochie"));
  assert.throws(() => assertTestDatabase("postgresql://u:p@db_test.local:5432/agrochie"));
  assert.throws(() => assertTestDatabase("postgresql://u:p@localhost:5432/agrochie?x=_test"));
});

test("URL kosong atau rusak ditolak (tidak bergantung pada lingkungan)", () => {
  const lama = process.env.DATABASE_URL;
  try {
    // argumen eksplisit
    assert.throws(() => assertTestDatabase(""), /DATABASE_URL/);
    assert.throws(() => assertTestDatabase("bukan-url"), /DATABASE_URL/);

    // tanpa argumen: fungsi membaca process.env.DATABASE_URL, jadi nilainya diatur eksplisit
    delete process.env.DATABASE_URL;
    assert.throws(() => assertTestDatabase(), /DATABASE_URL/);
    process.env.DATABASE_URL = "";
    assert.throws(() => assertTestDatabase(), /DATABASE_URL/);
    process.env.DATABASE_URL = "bukan-url";
    assert.throws(() => assertTestDatabase(), /DATABASE_URL/);

    // dan env berisi database uji tetap diterima
    process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/agrochie_test";
    assert.doesNotThrow(() => assertTestDatabase());
  } finally {
    if (lama === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = lama;
  }
});

test("pesan galat tidak memuat URL atau sandi", () => {
  const url = "postgresql://user:rahasia123@localhost:5432/agrochie";
  try {
    assertTestDatabase(url);
    assert.fail("harus melempar");
  } catch (e) {
    assert.ok(!e.message.includes("rahasia123"));
    assert.ok(!e.message.includes("localhost"));
  }
});
