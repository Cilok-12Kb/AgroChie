import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createTranslateService } from "../src/services/translate.service.js";
import { createTranslateRoutes } from "../src/routes/translate.routes.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import { _resetForTests } from "../src/middleware/rate-limit.js";
import { newCache, cleanupTmp, cfg, noLog, fake } from "./helpers/translate-fakes.js";

cleanupTmp();

describe("POST /api/translate", () => {
  let server, url;
  before(async () => {
    const svc = createTranslateService({ cache: newCache(), providers: { ollama: fake((k) => `EN:${k}`) }, cfg: cfg(), logError: noLog });
    const app = express();
    app.use(express.json());
    app.use("/api/translate", createTranslateRoutes(() => svc));
    app.use(errorHandler);
    await new Promise((r) => { server = app.listen(0, r); });
    url = `http://127.0.0.1:${server.address().port}/api/translate`;
  });
  after(() => server?.close());

  const post = (body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  test("sukses tanpa login: kunci = teks asli", async () => {
    _resetForTests();
    const res = await post({ target: "en", texts: ["Halo"] });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { translations: { Halo: "EN:Halo" } });
  });

  test("validasi body dan batas ukuran → 400", async () => {
    _resetForTests();
    const long = Array.from({ length: 21 }, (_, i) => "y".repeat(497) + String(i).padStart(3, "0")); // 21 x 500 = 10.500 > 10.000
    const bad = [
      {}, { target: "fr", texts: ["a"] }, { target: "en" }, { target: "en", texts: [] }, { target: "en", texts: "a" },
      { target: "en", texts: [1] },
      { target: "en", texts: Array.from({ length: 51 }, (_, i) => `t${i}`) },
      { target: "en", texts: ["x".repeat(501)] },
      { target: "zh", texts: long },
    ];
    for (const b of bad) assert.equal((await post(b)).status, 400, JSON.stringify(b).slice(0, 60));
    assert.equal((await post({ target: "en", texts: Array.from({ length: 50 }, (_, i) => `t${i}`) })).status, 200);
    assert.equal((await post({ target: "en", texts: long.slice(0, 20) })).status, 200); // 10.000 tepat di batas
  });

  test("pembatas IP: permintaan ke-61 dalam semenit ditolak 429", async () => {
    _resetForTests();
    for (let i = 0; i < 60; i++) assert.equal((await post({ target: "en", texts: ["Halo"] })).status, 200, `ke-${i + 1}`);
    assert.equal((await post({ target: "en", texts: ["Halo"] })).status, 429);
    _resetForTests();
  });
});
