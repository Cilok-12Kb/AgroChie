import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { generateToken, hashToken, createTokenPair } from "../src/utils/token.js";

test("token: 32 byte acak dalam base64url (43 karakter, tanpa padding)", () => {
  const t = generateToken();
  assert.match(t, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(Buffer.from(t, "base64url").length, 32);
});

test("token: tidak ada duplikat pada 1000 pembuatan", () => {
  const set = new Set(Array.from({ length: 1000 }, generateToken));
  assert.equal(set.size, 1000);
});

test("hash: SHA-256 heksadesimal 64 karakter, deterministik, cocok dengan perhitungan manual", () => {
  const t = "contoh-token";
  const h = hashToken(t);
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(h, hashToken(t));
  assert.equal(h, createHash("sha256").update(t).digest("hex"));
  assert.notEqual(h, hashToken(t + "x"));
});

test("hash: vektor uji SHA-256 baku untuk 'abc'", () => {
  assert.equal(hashToken("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("pasangan: tokenHash = hash(token) dan token mentah tidak sama dengan hash", () => {
  const { token, tokenHash } = createTokenPair();
  assert.equal(tokenHash, hashToken(token));
  assert.notEqual(token, tokenHash);
  assert.ok(!tokenHash.includes(token));
});
