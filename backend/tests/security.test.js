import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { applySecurity } from "../src/middleware/security.js";
import { buildEnv } from "../src/config/env-parse.js";

const ORIGIN = "http://localhost:3001";
const base = { DATABASE_URL: "postgresql://x", JWT_SECRET: "a".repeat(32) };

describe("helmet, CORS, cookie-parser (tanpa DB)", () => {
  let server, url;
  before(async () => {
    const app = express();
    applySecurity(app, buildEnv({ ...base, FRONTEND_ORIGIN: ORIGIN }));
    app.get("/cookie", (req, res) => res.json({ c: req.cookies?.x ?? null }));
    await new Promise((r) => (server = app.listen(0, r)));
    url = `http://127.0.0.1:${server.address().port}`;
  });
  after(() => server?.close());

  test("header keamanan helmet ada", async () => {
    const res = await fetch(`${url}/cookie`);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.ok(res.headers.get("content-security-policy"));
    assert.equal(res.headers.get("x-powered-by"), null);
  });

  test("origin yang diizinkan mendapat Allow-Origin dan Allow-Credentials", async () => {
    const res = await fetch(`${url}/cookie`, { headers: { origin: ORIGIN } });
    assert.equal(res.headers.get("access-control-allow-origin"), ORIGIN);
    assert.equal(res.headers.get("access-control-allow-credentials"), "true");
  });

  test("origin lain tidak mendapat header CORS", async () => {
    const res = await fetch(`${url}/cookie`, { headers: { origin: "http://jahat.example" } });
    assert.equal(res.headers.get("access-control-allow-origin"), null);
    assert.equal(res.headers.get("access-control-allow-credentials"), null);
  });

  test("preflight OPTIONS berfungsi untuk origin yang diizinkan", async () => {
    const res = await fetch(`${url}/cookie`, {
      method: "OPTIONS",
      headers: { origin: ORIGIN, "access-control-request-method": "POST", "access-control-request-headers": "content-type" },
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get("access-control-allow-origin"), ORIGIN);
    assert.equal(res.headers.get("access-control-allow-credentials"), "true");
    assert.match(res.headers.get("access-control-allow-methods"), /POST/);
  });

  test("preflight dari origin lain tidak mendapat izin", async () => {
    const res = await fetch(`${url}/cookie`, {
      method: "OPTIONS",
      headers: { origin: "http://jahat.example", "access-control-request-method": "POST" },
    });
    assert.equal(res.headers.get("access-control-allow-origin"), null);
  });

  test("cookie-parser mengisi req.cookies", async () => {
    const res = await fetch(`${url}/cookie`, { headers: { cookie: "x=halo" } });
    assert.deepEqual(await res.json(), { c: "halo" });
  });
});

describe("TRUST_PROXY dan FRONTEND_ORIGIN", () => {
  test("bawaan tidak aktif; true, false, dan jumlah hop diterima", () => {
    assert.equal(buildEnv(base).trustProxy, false);
    assert.equal(buildEnv({ ...base, TRUST_PROXY: "" }).trustProxy, false);
    assert.equal(buildEnv({ ...base, TRUST_PROXY: "false" }).trustProxy, false);
    assert.equal(buildEnv({ ...base, TRUST_PROXY: "true" }).trustProxy, true);
    assert.equal(buildEnv({ ...base, TRUST_PROXY: "2" }).trustProxy, 2);
  });
  for (const v of ["yes", "0", "-1", "1.5", "10.0.0.1", "loopback"]) {
    test(`TRUST_PROXY=${v} ditolak`, () => {
      assert.throws(() => buildEnv({ ...base, TRUST_PROXY: v }), /TRUST_PROXY/);
    });
  }
  test("FRONTEND_ORIGIN '*' atau tidak valid ditolak; garis miring akhir dibuang", () => {
    assert.throws(() => buildEnv({ ...base, FRONTEND_ORIGIN: "*" }), /FRONTEND_ORIGIN/);
    assert.throws(() => buildEnv({ ...base, FRONTEND_ORIGIN: "localhost:3001" }), /FRONTEND_ORIGIN/);
    assert.throws(() => buildEnv({ ...base, FRONTEND_ORIGIN: "http://a.com/path" }), /FRONTEND_ORIGIN/);
    assert.equal(buildEnv({ ...base, FRONTEND_ORIGIN: "https://app.example.com/" }).frontendOrigin, "https://app.example.com");
  });
});
