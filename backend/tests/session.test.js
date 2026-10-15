import { test } from "node:test";
import assert from "node:assert/strict";
import { createSessionTools } from "../src/utils/session.js";
import { makeRequireUser, makeOptionalUser, requireRole } from "../src/middleware/auth.js";

const cfg = {
  jwtSecret: "s".repeat(32),
  jwtTtlDays: 7,
  guestTtlHours: 24,
  cookieName: "agro_session",
  nodeEnv: "test",
};
const tools = createSessionTools(cfg);
// [REVISI] D1: pemuat sessionVersion buatan (menghitung panggilan = jumlah query DB per request).
const versions = new Map([["u1", 0]]);
let loads = 0;
const loadVersion = async (id) => {
  loads++;
  return versions.has(id) ? versions.get(id) : null;
};
const requireUser = makeRequireUser(async () => tools, loadVersion);
const optionalUser = makeOptionalUser(async () => tools, loadVersion);

const fakeRes = () => {
  const r = { cookies: [], cleared: [] };
  r.cookie = (n, v, o) => r.cookies.push({ n, v, o });
  r.clearCookie = (n, o) => r.cleared.push({ n, o });
  return r;
};
const run = (mw, req, res = fakeRes()) =>
  new Promise((resolve) => mw(req, res, (err) => resolve({ err, req, res })));

const user = { id: "u1", role: "PETANI", isGuest: false };

test("tanpa sesi -> 401", async () => {
  const { err } = await run(requireUser, { headers: {} });
  assert.equal(err.status, 401);
});

test("token rusak atau tanda tangan lain -> 401", async () => {
  const other = createSessionTools({ ...cfg, jwtSecret: "x".repeat(32) });
  const bad = await other.createToken(user);
  const { err } = await run(requireUser, { headers: { cookie: `agro_session=${bad}` } });
  assert.equal(err.status, 401);
  const r2 = await run(requireUser, { headers: { cookie: "agro_session=acak" } });
  assert.equal(r2.err.status, 401);
});

test("token kedaluwarsa -> 401", async () => {
  const old = Math.floor(Date.now() / 1000) - 8 * 86400;
  const token = await tools.createToken(user, old);
  const { err } = await run(requireUser, { headers: { cookie: `agro_session=${token}` } });
  assert.equal(err.status, 401);
});

test("sesi sah mengisi req.user dan req.userId", async () => {
  const token = await tools.createToken(user);
  const { err, req } = await run(requireUser, { headers: { cookie: `agro_session=${token}` } });
  assert.equal(err, undefined);
  assert.deepEqual(req.user, { id: "u1", role: "PETANI", isGuest: false });
  assert.equal(req.userId, "u1");
});

test("peran salah -> 403, peran benar lolos, tanpa user -> 401", async () => {
  const mw = requireRole("PETUGAS_BANK");
  assert.equal((await run(mw, { user })).err.status, 403);
  assert.equal((await run(mw, { user: { ...user, role: "PETUGAS_BANK" } })).err, undefined);
  assert.equal((await run(mw, {})).err.status, 401);
});

test("token diperbarui bila sisa kurang dari separuh; tamu tidak pernah", async () => {
  const now = Math.floor(Date.now() / 1000);
  const tua = await tools.createToken(user, now - 5 * 86400); // sisa 2 hari
  const s = await tools.verifyToken(tua);
  const res = fakeRes();
  assert.equal(await tools.refreshSession(res, s, now), true);
  assert.equal(res.cookies.length, 1);
  assert.equal(res.cookies[0].o.httpOnly, true);

  const baru = await tools.verifyToken(await tools.createToken(user, now));
  assert.equal(await tools.refreshSession(fakeRes(), baru, now), false);

  const guest = { id: "g1", role: "PETANI", isGuest: true };
  const g = await tools.verifyToken(await tools.createToken(guest, now - 23 * 3600));
  const res2 = fakeRes();
  assert.equal(await tools.refreshSession(res2, g, now), false);
  assert.equal(res2.cookies.length, 0);
});

test("masa berlaku tamu 24 jam", async () => {
  const now = Math.floor(Date.now() / 1000);
  const g = await tools.verifyToken(await tools.createToken({ id: "g", role: "PETANI", isGuest: true }, now));
  assert.equal(g.exp - g.iat, 24 * 3600);
  assert.equal(g.isGuest, true);
});

// ---- [REVISI] D1: sessionVersion ----
import { SignJWT, jwtVerify } from "jose";
const keyBytes = new TextEncoder().encode(cfg.jwtSecret);
const cookieHdr = (t) => ({ headers: { cookie: `agro_session=${t}` } });

test("sv: token baru memuat klaim sv sesuai sessionVersion; tanpa nilai -> 0", async () => {
  const t1 = await tools.createToken({ ...user, sessionVersion: 3 });
  assert.equal((await jwtVerify(t1, keyBytes)).payload.sv, 3);
  assert.equal((await tools.verifyToken(t1)).sv, 3);
  assert.equal((await jwtVerify(await tools.createToken(user), keyBytes)).payload.sv, 0);
});

test("sv: token lama TANPA klaim sv tetap valid selama sessionVersion user = 0", async () => {
  const legacy = await new SignJWT({ role: "PETANI", isGuest: false })
    .setProtectedHeader({ alg: "HS256" }).setSubject("u1")
    .setIssuedAt().setExpirationTime("7d").sign(keyBytes);
  assert.equal((await tools.verifyToken(legacy)).sv, 0);
  versions.set("u1", 0);
  assert.equal((await run(requireUser, cookieHdr(legacy))).err, undefined);
  versions.set("u1", 1);
  const r = await run(requireUser, cookieHdr(legacy));
  assert.equal(r.err.status, 401);
  versions.set("u1", 0);
});

test("sv: sv berbeda atau user hilang -> 401 dan cookie sesi dihapus", async () => {
  versions.set("u1", 2);
  const old = await tools.createToken({ ...user, sessionVersion: 1 });
  const r = await run(requireUser, cookieHdr(old));
  assert.equal(r.err.status, 401);
  assert.equal(r.res.cleared.length, 1);
  assert.equal(r.res.cleared[0].n, "agro_session");
  assert.equal(r.req.user, undefined);
  // token baru dengan sv sama dengan DB lolos
  const fresh = await tools.createToken({ ...user, sessionVersion: 2 });
  const ok = await run(requireUser, cookieHdr(fresh));
  assert.equal(ok.err, undefined);
  assert.equal(ok.res.cleared.length, 0);
  // user tidak ada
  const ghost = await tools.createToken({ id: "hantu", role: "PETANI", isGuest: false });
  const g = await run(requireUser, cookieHdr(ghost));
  assert.equal(g.err.status, 401);
  assert.equal(g.res.cleared.length, 1);
  versions.set("u1", 0);
});

test("sv: pembaruan otomatis memakai sv dari DB, bukan salinan token lama", async () => {
  // DB di sv 5; token lama diklaim sv 5 tetapi kita buktikan lewat loader yang dipakai middleware.
  versions.set("u1", 5);
  const now = Math.floor(Date.now() / 1000);
  const tua = await tools.createToken({ ...user, sessionVersion: 5 }, now - 5 * 86400); // sisa 2 hari
  const r = await run(requireUser, cookieHdr(tua));
  assert.equal(r.err, undefined);
  assert.equal(r.res.cookies.length, 1);
  assert.equal((await jwtVerify(r.res.cookies[0].v, keyBytes)).payload.sv, 5);
  // token lama tanpa sv saat DB = 0 -> diperbarui menjadi sv 0 eksplisit (nilai DB)
  versions.set("u1", 0);
  const legacy = await new SignJWT({ role: "PETANI", isGuest: false })
    .setProtectedHeader({ alg: "HS256" }).setSubject("u1")
    .setIssuedAt(now - 5 * 86400).setExpirationTime(now + 2 * 86400).sign(keyBytes);
  const r2 = await run(requireUser, cookieHdr(legacy));
  assert.equal(r2.res.cookies.length, 1);
  assert.equal((await jwtVerify(r2.res.cookies[0].v, keyBytes)).payload.sv, 0);
});

test("sv: tamu mengikuti aturan yang sama dan tidak diperbarui", async () => {
  versions.set("g1", 0);
  const g = { id: "g1", role: "PETANI", isGuest: true };
  assert.equal((await run(requireUser, cookieHdr(await tools.createToken(g)))).err, undefined);
  versions.set("g1", 1);
  const r = await run(requireUser, cookieHdr(await tools.createToken(g)));
  assert.equal(r.err.status, 401);
  assert.equal(r.res.cleared.length, 1);
  versions.delete("g1");
});

test("sv: optionalUser dengan sesi dicabut = tidak login (tanpa galat) dan cookie dihapus", async () => {
  versions.set("u1", 1);
  const old = await tools.createToken({ ...user, sessionVersion: 0 });
  const r = await run(optionalUser, cookieHdr(old));
  assert.equal(r.err, undefined);
  assert.equal(r.req.user, undefined);
  assert.equal(r.res.cleared.length, 1);
  versions.set("u1", 0);
  const ok = await run(optionalUser, cookieHdr(await tools.createToken(user)));
  assert.equal(ok.err, undefined);
  assert.equal(ok.req.user.id, "u1");
  assert.equal(ok.res.cleared.length, 0);
  // tanpa cookie: lanjut tanpa memuat apa pun
  const before = loads;
  assert.equal((await run(optionalUser, { headers: {} })).err, undefined);
  assert.equal(loads, before);
});

test("sv: tepat satu pemuatan versi per request terautentikasi; tanpa token tidak ada", async () => {
  versions.set("u1", 0);
  const token = await tools.createToken(user);
  let before = loads;
  await run(requireUser, cookieHdr(token));
  assert.equal(loads - before, 1);
  before = loads;
  await run(requireUser, { headers: {} });
  assert.equal(loads - before, 0);
});
