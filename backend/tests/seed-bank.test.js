import "dotenv/config";
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { assertTestDatabase } from "./helpers/test-db.js";
import { readBankSeedInput, seedBankOfficer } from "../prisma/seed-bank.js";

const ok = { SEED_BANK_NAME: "Bank A", SEED_BANK_PHONE: "0812-3456-7890", SEED_BANK_PASSWORD: "sandi-rahasia-1" };

describe("seed petugas bank: input (tanpa DB)", () => {
  test("input valid dinormalisasi", () => {
    const r = readBankSeedInput(ok);
    assert.equal(r.ok, true);
    assert.equal(r.input.phone, "081234567890");
  });
  for (const k of Object.keys(ok)) {
    test(`kosong ${k} -> dilewati, alasan tanpa nilai`, () => {
      const r = readBankSeedInput({ ...ok, [k]: "  " });
      assert.equal(r.ok, false);
      for (const v of Object.values(ok)) assert.ok(!r.reason.includes(v));
    });
  }
  test("HP di luar 8-15 digit dan sandi pendek ditolak", () => {
    assert.equal(readBankSeedInput({ ...ok, SEED_BANK_PHONE: "1234567" }).ok, false);
    assert.equal(readBankSeedInput({ ...ok, SEED_BANK_PHONE: "1".repeat(16) }).ok, false);
    assert.equal(readBankSeedInput({ ...ok, SEED_BANK_PASSWORD: "pendek" }).ok, false);
  });
});

let skip = false;
try {
  assertTestDatabase();
} catch (e) {
  skip = e.message;
}

describe("seed petugas bank (butuh database uji)", { skip }, () => {
  let prisma;
  const phone = "0877" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  const input = { name: "Petugas Uji", phone, password: "sandi-rahasia-1" };

  before(async () => {
    assertTestDatabase();
    ({ prisma } = await import("../src/config/prisma.js"));
  });
  after(async () => {
    if (prisma) {
      await prisma.user.deleteMany({ where: { phone } });
      await prisma.$disconnect();
    }
  });

  test("dibuat sebagai PETUGAS_BANK, hash bukan sandi asli; seed kedua tidak menggandakan/menimpa", async () => {
    assert.equal(await seedBankOfficer(prisma, input), "dibuat");
    const first = await prisma.user.findMany({ where: { phone } });
    assert.equal(first.length, 1);
    assert.equal(first[0].role, "PETUGAS_BANK");
    assert.equal(first[0].isGuest, false);
    assert.notEqual(first[0].passwordHash, input.password);
    assert.ok(first[0].passwordHash.startsWith("$argon2"));

    assert.equal(await seedBankOfficer(prisma, { ...input, password: "sandi-lain-9999" }), "sudah_ada");
    const second = await prisma.user.findMany({ where: { phone } });
    assert.equal(second.length, 1);
    assert.equal(second[0].passwordHash, first[0].passwordHash);
  });
});
