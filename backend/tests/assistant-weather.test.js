import { describe, test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { parseFarmWeather, seasonPhase, describeWeatherCode } from "../src/utils/weather.js";
import { getFarmWeather, clearFarmWeatherCache } from "../src/services/weather.service.js";
import { buildSystemPrompt, SYSTEM_RULES } from "../src/services/rag/prompt.js";
import { TOOL_DECLARATIONS, locationText } from "../src/services/assistant-tools.js";

const body = () => ({
  current: { time: "2026-10-13T10:00", temperature_2m: 31.2, relative_humidity_2m: 70, precipitation: 0, wind_speed_10m: 8.5, weather_code: 2 },
  daily: {
    time: ["2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"],
    weather_code: [2, 63, 95, 0],
    precipitation_sum: [0, 12.4, 30, null],
    precipitation_probability_max: [10, 80, 90, 5],
    temperature_2m_max: [32, 30, 29, 33],
    temperature_2m_min: [24, 23, 23, 24],
  },
});
const json = (status, b) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

test("parseFarmWeather: kondisi Indonesia, 3 hari prakiraan, null tidak ditebak", () => {
  const w = parseFarmWeather(body());
  assert.equal(w.current.condition, "Berawan sebagian");
  assert.equal(w.current.humidityPct, 70);
  assert.equal(w.forecast.length, 3);
  assert.equal(w.forecast[0].condition, "Hujan sedang");
  assert.equal(w.forecast[2].rainMm, null);
  assert.equal(describeWeatherCode(12345), null);
  assert.throws(() => parseFarmWeather({}), RangeError);
});

test("seasonPhase: minggu dan fase sesuai fase-dan-durasi.md", () => {
  assert.deepEqual(seasonPhase("CABAI", "2026-10-01", "2026-10-01"), { week: 1, phase: "persiapan lahan", totalWeeks: 16 });
  assert.equal(seasonPhase("CABAI", "2026-10-01", "2026-10-29").phase, "perawatan"); // minggu 5
  assert.equal(seasonPhase("BAWANG", "2026-10-01", "2026-10-22").phase, "perawatan"); // minggu 4
  assert.equal(seasonPhase("TOMAT", null, "2026-10-01"), null);
  assert.equal(seasonPhase("TOMAT", "2026-11-01", "2026-10-01"), null);
});

test("prompt memuat aturan cuaca, lahan_id, dan larangan mengarang", () => {
  assert.match(SYSTEM_RULES, /get_weather/);
  assert.match(SYSTEM_RULES, /jangan mengarang cuaca/);
  assert.match(buildSystemPrompt({ farmerText: "x", farmId: "f1" }), /lahan_id \(untuk alat\): f1/);
  assert.doesNotMatch(buildSystemPrompt({ farmerText: "x" }), /lahan_id \(untuk alat\)/);
  assert.deepEqual(TOOL_DECLARATIONS.map((t) => t.name), ["get_weather", "get_land_context"]);
  assert.equal(locationText({ village: "A", subdistrict: null, province: "Riau" }), "A, Riau");
});

describe("getFarmWeather (fetch palsu)", () => {
  beforeEach(() => clearFarmWeatherCache());
  afterEach(() => mock.restoreAll());

  test("cache 15 menit per koordinat, lalu kedaluwarsa", async () => {
    mock.method(globalThis, "fetch", async () => json(200, body()));
    const t0 = 1_000_000;
    assert.equal((await getFarmWeather(0.5, 101.4, t0)).cached, false);
    assert.equal((await getFarmWeather(0.5, 101.4, t0 + 14 * 60_000)).cached, true);
    assert.equal(globalThis.fetch.mock.calls.length, 1);
    assert.equal((await getFarmWeather(0.5, 101.4, t0 + 16 * 60_000)).cached, false);
    assert.equal(globalThis.fetch.mock.calls.length, 2);
  });

  test("galat jaringan, HTTP 500, JSON salah -> 503 jujur, koordinat tidak masuk log", async () => {
    const errs = mock.method(console, "error", () => {});
    for (const impl of [
      async () => { throw new Error("timeout"); },
      async () => json(500, {}),
      async () => json(200, { foo: 1 }),
    ]) {
      mock.method(globalThis, "fetch", impl);
      await assert.rejects(getFarmWeather(0.5, 101.4), (e) => e.status === 503 && /cuaca/i.test(e.message));
    }
    assert.ok(errs.mock.calls.every((c) => !String(c.arguments.join(" ")).includes("101.4")));
  });

  test("koordinat tidak valid -> 409 tanpa memanggil jaringan", async () => {
    mock.method(globalThis, "fetch", async () => json(200, body()));
    await assert.rejects(getFarmWeather(NaN, 1), (e) => e.status === 409);
    assert.equal(globalThis.fetch.mock.calls.length, 0);
  });
});
