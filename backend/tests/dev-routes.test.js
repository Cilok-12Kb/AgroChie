import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createDevRoutes, renderGoogleLoginPage } from "../src/routes/dev.routes.js";
import { notFound } from "../src/middleware/error-handler.js";

// Halaman uji login Google: aktif di non-production, 404 di production (tanpa DB).
function start(cfg) {
  const app = express();
  app.use("/dev", createDevRoutes(cfg));
  app.use(notFound);
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
  });
}

describe("GET /dev/google-login", () => {
  let dev, prod;
  before(async () => {
    dev = await start({ nodeEnv: "development", googleClientId: "klien-uji.apps.googleusercontent.com" });
    prod = await start({ nodeEnv: "production", googleClientId: "klien-uji.apps.googleusercontent.com" });
  });
  after(() => {
    dev?.server.close();
    prod?.server.close();
  });

  test("non-production: 200 HTML dengan client ID, skrip GIS, dan CSP berisi nonce", async () => {
    const res = await fetch(`${dev.url}/dev/google-login`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /text\/html/);
    const html = await res.text();
    assert.match(html, /data-client_id="klien-uji\.apps\.googleusercontent\.com"/);
    assert.match(html, /https:\/\/accounts\.google\.com\/gsi\/client/);
    assert.match(html, /\/api\/auth\/google/);
    assert.match(html, /\/api\/auth\/me/);
    const csp = res.headers.get("content-security-policy");
    const nonce = csp.match(/'nonce-([^']+)'/)[1];
    assert.ok(html.includes(`nonce="${nonce}"`));
    assert.equal(res.headers.get("cross-origin-opener-policy"), "same-origin-allow-popups");
  });

  test("bagian tautkan Google: input password, panggil /api/auth/google/link, tanpa menyimpan password", async () => {
    const html = await (await fetch(`${dev.url}/dev/google-login`)).text();
    assert.match(html, /Tautkan Google ke akun yang sedang login/);
    assert.match(html, /<input id="linkPassword" type="password"/);
    assert.match(html, /\/api\/auth\/google\/link/);
    assert.ok(!/localStorage|sessionStorage|console\.log/.test(html));
    assert.ok(!/value="[^"]+"[^>]*linkPassword|linkPassword[^>]*value=/.test(html));
  });

  test("tanpa client ID: bagian tautkan tidak dirender", () => {
    assert.ok(!renderGoogleLoginPage({ clientId: "", nonce: "n" }).includes("linkPassword\" type"));
  });

  test("production: 404 dan halaman tidak disajikan", async () => {
    const res = await fetch(`${prod.url}/dev/google-login`);
    assert.equal(res.status, 404);
    assert.ok(!(await res.text()).includes("klien-uji"));
  });

  test("client ID di-escape dan pesan jelas bila kosong", () => {
    const html = renderGoogleLoginPage({ clientId: '"><script>x</script>', nonce: "n" });
    assert.ok(!html.includes('"><script>x'));
    const kosong = renderGoogleLoginPage({ clientId: "", nonce: "n" });
    assert.match(kosong, /GOOGLE_CLIENT_ID belum diisi/);
    assert.ok(!kosong.includes("data-client_id"));
  });
});
