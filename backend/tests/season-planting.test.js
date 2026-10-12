import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStartPlanting, todayWib } from "../src/validators/season.validator.js";

const NOW = new Date("2026-06-10T03:00:00.000Z"); // 10 Juni 2026 10:00 WIB
const iso = (d) => d.toISOString().slice(0, 10);

test("todayWib: tanggal kalender WIB (lewat tengah malam UTC+7)", () => {
  assert.equal(iso(todayWib(new Date("2026-06-10T17:30:00.000Z"))), "2026-06-11");
  assert.equal(iso(todayWib(NOW)), "2026-06-10");
});

test("tanpa plantedOn: default hari ini; body kosong atau undefined", () => {
  assert.equal(iso(parseStartPlanting({}, NOW).plantedOn), "2026-06-10");
  assert.equal(iso(parseStartPlanting(undefined, NOW).plantedOn), "2026-06-10");
});

test("tanggal sah: hari ini, kemarin, tepat 60 hari lalu", () => {
  assert.equal(iso(parseStartPlanting({ plantedOn: "2026-06-10" }, NOW).plantedOn), "2026-06-10");
  assert.equal(iso(parseStartPlanting({ plantedOn: "2026-06-09" }, NOW).plantedOn), "2026-06-09");
  assert.equal(iso(parseStartPlanting({ plantedOn: "2026-04-11" }, NOW).plantedOn), "2026-04-11");
});

test("ditolak 400: format salah, tanggal tak ada, masa depan, lebih dari 60 hari, kunci lain, bukan teks", () => {
  for (const body of [
    { plantedOn: "10-06-2026" }, { plantedOn: "2026-02-31" }, { plantedOn: "2026-13-01" }, { plantedOn: "" },
    { plantedOn: "2026-06-11" }, { plantedOn: "2026-04-10" }, { plantedOn: "2026-06-10", x: 1 }, { plantedOn: 20260610 },
  ]) {
    assert.throws(() => parseStartPlanting(body, NOW), (e) => e.status === 400, JSON.stringify(body));
  }
});
