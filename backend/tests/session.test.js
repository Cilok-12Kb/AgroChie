import { test } from "node:test";
import assert from "node:assert/strict";
import { createSessionTools } from "../src/utils/session.js";
import { makeRequireUser, requireRole } from "../src/middleware/auth.js";

const cfg = {
  jwtSecret: "s".repeat(32),
  jwtTtlDays: 7,
  guestTtlHours: 24,
  cookieName: "agro_session",
  nodeEnv: "test",
};
const tools = createSessionTools(cfg);
const requireUser = makeRequireUser(async () => tools);

const fakeRes = () => {
  const r = { cookies: [] };
  r.cookie = (n, v, o) => r.cookies.push({ n, v, o });
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
