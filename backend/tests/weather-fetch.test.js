import { describe, test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { fetchDaily, clearWeatherCache } from "../src/services/weather.service.js";

// Semua panggilan Open-Meteo di-stub; tidak ada jaringan. Angka kecil, dihitung tangan.
const TODAY = new Date(Date.UTC(2026, 5, 30)); // 2026-06-30 -> batas arsip 2026-06-23
const rows = (from, to, rain = 2, temp = 31) => {
  const time = [], precipitation_sum = [], temperature_2m_max = [];
  for (let t = Date.parse(from); t <= Date.parse(to); t += 86_400_000) {
    time.push(new Date(t).toISOString().slice(0, 10)); precipitation_sum.push(rain); temperature_2m_max.push(temp);
  }
  return { daily: { time, precipitation_sum, temperature_2m_max } };
};
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const calls = () => globalThis.fetch.mock.calls.map((c) => ({ url: new URL(String(c.arguments[0])), init: c.arguments[1] }));

describe("fetchDaily (fetch palsu)", () => {
  beforeEach(() => clearWeatherCache());
  afterEach(() => mock.restoreAll());

  test("menggabungkan arsip + forecast tanpa tanggal ganda, URL dan parameter benar", async () => {
    mock.method(globalThis, "fetch", async (url) => {
      const u = new URL(String(url));
      if (u.host === "archive-api.open-meteo.com") return json(200, rows("2026-06-20", "2026-06-23", 1, 30));
      if (u.host === "api.open-meteo.com") return json(200, rows("2026-06-22", "2026-06-30", 5, 33)); // tumpang tindih
      throw new Error("host tak terduga " + u.host);
    });
    const out = await fetchDaily(-7.123456, 110.987654, "2026-06-20", "2026-06-29", TODAY);
    assert.deepEqual(out.map((r) => r.date), [
      "2026-06-20", "2026-06-21", "2026-06-22", "2026-06-23", "2026-06-24", "2026-06-25",
      "2026-06-26", "2026-06-27", "2026-06-28", "2026-06-29",
    ]);
    assert.equal(new Set(out.map((r) => r.date)).size, out.length);
    assert.deepEqual(out.map((r) => r.rainMm), [1, 1, 1, 1, 5, 5, 5, 5, 5, 5]);
    const [a, f] = calls();
    assert.equal(a.url.pathname, "/v1/archive");
    assert.equal(a.url.searchParams.get("latitude"), "-7.1235");
    assert.equal(a.url.searchParams.get("longitude"), "110.9877");
    assert.equal(a.url.searchParams.get("start_date"), "2026-06-20");
    assert.equal(a.url.searchParams.get("end_date"), "2026-06-23");
    assert.equal(a.url.searchParams.get("daily"), "precipitation_sum,temperature_2m_max");
    assert.match(a.init.headers["User-Agent"], /AgroChie/);
    assert.ok(a.init.signal);
    assert.equal(f.url.pathname, "/v1/forecast");
    assert.equal(f.url.searchParams.get("past_days"), "6"); // 2026-06-24 .. 2026-06-30
    assert.equal(f.url.searchParams.get("latitude"), "-7.1235");
  });

  test("nilai null dari API dipertahankan (bukan 0)", async () => {
    mock.method(globalThis, "fetch", async () => json(200, { daily: { time: ["2026-06-24"], precipitation_sum: [null], temperature_2m_max: [31] } }));
    const out = await fetchDaily(1, 2, "2026-06-24", "2026-06-24", TODAY);
    assert.deepEqual(out, [{ date: "2026-06-24", rainMm: null, tempMax: 31 }]);
  });

  test("5xx: satu retry lalu berhasil", async () => {
    let n = 0;
    mock.method(globalThis, "fetch", async () => (++n === 1 ? json(502, {}) : json(200, rows("2026-06-25", "2026-06-26"))));
    assert.equal((await fetchDaily(1, 2, "2026-06-25", "2026-06-26", TODAY)).length, 2);
    assert.equal(n, 2);
  });

  test("5xx terus-menerus: hanya 2 panggilan lalu 503 dengan saran isian manual", async () => {
    mock.method(globalThis, "fetch", async () => json(500, {}));
    await assert.rejects(fetchDaily(1, 2, "2026-06-25", "2026-06-26", TODAY), (e) => e.status === 503 && /manual/i.test(e.message));
    assert.equal(calls().length, 2);
  });

  test("galat jaringan: satu retry", async () => {
    let n = 0;
    mock.method(globalThis, "fetch", async () => { if (++n === 1) throw new TypeError("fetch failed"); return json(200, rows("2026-06-25", "2026-06-25")); });
    assert.equal((await fetchDaily(1, 2, "2026-06-25", "2026-06-25", TODAY)).length, 1);
    assert.equal(n, 2);
  });

  test("4xx: tanpa retry, 503", async () => {
    mock.method(globalThis, "fetch", async () => json(400, { reason: "x" }));
    await assert.rejects(fetchDaily(1, 2, "2026-06-25", "2026-06-26", TODAY), (e) => e.status === 503);
    assert.equal(calls().length, 1);
  });

  test("timeout -> 503 (setelah satu retry)", async () => {
    mock.method(globalThis, "fetch", async () => { throw new DOMException("The operation timed out", "TimeoutError"); });
    await assert.rejects(fetchDaily(1, 2, "2026-06-25", "2026-06-26", TODAY), (e) => e.status === 503 && /manual/i.test(e.message));
    assert.equal(calls().length, 2);
  });

  test("bentuk respons salah -> 503", async () => {
    mock.method(globalThis, "fetch", async () => json(200, { daily: { time: ["2026-06-25"], precipitation_sum: [] } }));
    await assert.rejects(fetchDaily(1, 2, "2026-06-25", "2026-06-25", TODAY), (e) => e.status === 503);
  });

  test("cache: panggilan kedua dengan kunci sama tidak fetch; rentang lain fetch lagi", async () => {
    mock.method(globalThis, "fetch", async () => json(200, rows("2026-06-25", "2026-06-26")));
    await fetchDaily(1, 2, "2026-06-25", "2026-06-26", TODAY);
    await fetchDaily(1, 2, "2026-06-25", "2026-06-26", TODAY);
    assert.equal(calls().length, 1);
    await fetchDaily(1, 2, "2026-06-25", "2026-06-25", TODAY);
    assert.equal(calls().length, 2);
  });
});
