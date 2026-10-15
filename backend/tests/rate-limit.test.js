import { test } from "node:test";
import assert from "node:assert/strict";
import { rateLimit, byIp, loginRateLimit, guestRateLimit, _resetForTests } from "../src/middleware/rate-limit.js";
import { errorHandler } from "../src/middleware/error-handler.js";

const call = (mw, req) => {
  let err;
  mw(req, {}, (e) => (err = e));
  return err;
};

test("tanpa keyFn: berbasis req.userId seperti semula", () => {
  const mw = rateLimit({ windowMs: 1000, max: 1 });
  assert.equal(call(mw, { userId: "u1", ip: "1.1.1.1" }), undefined);
  assert.equal(call(mw, { userId: "u1", ip: "2.2.2.2" }).status, 429); // IP berbeda tidak menolong
  assert.equal(call(mw, { userId: "u2", ip: "1.1.1.1" }), undefined);
});

test("keyFn berbasis IP: percobaan ke-11 ditolak, IP lain tidak terpengaruh", () => {
  const mw = rateLimit({ max: 10, keyFn: byIp });
  for (let i = 1; i <= 10; i++) assert.equal(call(mw, { ip: "10.0.0.1" }), undefined, `percobaan ${i}`);
  assert.equal(call(mw, { ip: "10.0.0.1" }).status, 429);
  assert.equal(call(mw, { ip: "10.0.0.2" }), undefined);
});

test("pembatas login: 10 per IP, galat 429 berbentuk { error } seperti galat lain", () => {
  const mw = loginRateLimit();
  for (let i = 0; i < 10; i++) assert.equal(call(mw, { ip: "9.9.9.9" }), undefined);
  const err = call(mw, { ip: "9.9.9.9" });
  assert.equal(err.status, 429);
  let status, body;
  errorHandler(err, {}, { status: (s) => ((status = s), { json: (b) => (body = b) }) }, () => {});
  assert.equal(status, 429);
  assert.deepEqual(Object.keys(body), ["error"]);
  assert.match(body.error, /percobaan masuk/);
  assert.equal(call(mw, { ip: "9.9.9.8" }), undefined);
});

test("pembatas login tidak mencampur kunci dengan pembatas lain", () => {
  const login = loginRateLimit();
  const lain = rateLimit({ max: 1 }); // berbasis userId
  for (let i = 0; i < 10; i++) call(login, { ip: "7.7.7.7", userId: "7.7.7.7" });
  assert.equal(call(login, { ip: "7.7.7.7" }).status, 429);
  // kunci yang sama di pembatas lain tidak ikut terpakai
  assert.equal(call(lain, { userId: "7.7.7.7" }), undefined);
  // dan sebaliknya: dua instans login tidak berbagi hitungan
  assert.equal(call(loginRateLimit(), { ip: "7.7.7.7" }), undefined);
});

test("pembatas tamu: 20 per IP lalu ditolak, IP lain tidak terpengaruh, terpisah dari login", () => {
  const mw = guestRateLimit();
  for (let i = 1; i <= 20; i++) assert.equal(call(mw, { ip: "3.3.3.3" }), undefined, `percobaan ${i}`);
  const err = call(mw, { ip: "3.3.3.3" });
  assert.equal(err.status, 429);
  assert.match(err.message, /sesi tamu/);
  assert.equal(call(mw, { ip: "3.3.3.4" }), undefined);
  assert.equal(call(loginRateLimit(), { ip: "3.3.3.3" }), undefined);
});

test("_resetForTests: mengosongkan hitungan semua pembatas", () => {
  const a = rateLimit({ max: 1, keyFn: byIp });
  const b = loginRateLimit();
  call(a, { ip: "4.4.4.4" });
  for (let i = 0; i < 10; i++) call(b, { ip: "4.4.4.4" });
  assert.equal(call(a, { ip: "4.4.4.4" }).status, 429);
  assert.equal(call(b, { ip: "4.4.4.4" }).status, 429);
  _resetForTests();
  assert.equal(call(a, { ip: "4.4.4.4" }), undefined);
  assert.equal(call(b, { ip: "4.4.4.4" }), undefined);
});

test("jendela waktu: percobaan lama kedaluwarsa", async () => {
  const mw = rateLimit({ windowMs: 30, max: 1, keyFn: byIp });
  assert.equal(call(mw, { ip: "5.5.5.5" }), undefined);
  assert.equal(call(mw, { ip: "5.5.5.5" }).status, 429);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(call(mw, { ip: "5.5.5.5" }), undefined);
});
