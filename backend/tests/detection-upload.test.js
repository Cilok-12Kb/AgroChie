import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readdir, unlink, rmdir } from "node:fs/promises";
import { buildEnv } from "../src/config/env-parse.js";
import {
  sniffImageMime, validateImageFile, sanitizeNote, parseDetectionCreate, MAX_NOTE,
} from "../src/validators/detection.validator.js";

// Folder unggahan sementara, diatur sebelum modul upload dimuat (env dibaca saat impor).
const tmp = await mkdtemp(path.join(os.tmpdir(), "agro-upload-"));
process.env.AGROCHIE_UPLOAD_DIR = tmp;
const { saveImage, readImage } = await import("../src/utils/upload.js");

const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40, 1)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 1)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(20)]);
const file = (buffer) => ({ buffer, size: buffer.length });
const MAX = 5 * 1024 * 1024;

test("env: batas unggahan bawaan 5 MB dan folder bawaan ./uploads", () => {
  const e = buildEnv({ DATABASE_URL: "postgresql://x", JWT_SECRET: "a".repeat(32) });
  assert.equal(e.detectionMaxBytes, 5 * 1024 * 1024);
  assert.equal(e.uploadDir, "./uploads");
  assert.throws(() => buildEnv({ DATABASE_URL: "postgresql://x", JWT_SECRET: "a".repeat(32), DETECTION_MAX_MB: "0" }), /DETECTION_MAX_MB/);
});

test("tipe file dikenali dari isi: jpg, png, webp", () => {
  assert.equal(sniffImageMime(JPG), "image/jpeg");
  assert.equal(sniffImageMime(PNG), "image/png");
  assert.equal(sniffImageMime(WEBP), "image/webp");
});

test("file bukan gambar atau rusak ditolak 415", () => {
  assert.throws(() => validateImageFile(file(Buffer.from("%PDF-1.7 bukan gambar sama sekali")), MAX), (e) => e.status === 415);
  assert.throws(() => validateImageFile(file(Buffer.from([0xff, 0xd8])), MAX), (e) => e.status === 415); // terpotong
  assert.equal(sniffImageMime(Buffer.from("GIF89a" + "x".repeat(20))), null);
});

test("tanpa file atau file kosong ditolak 400", () => {
  assert.throws(() => validateImageFile(undefined, MAX), (e) => e.status === 400);
  assert.throws(() => validateImageFile({ buffer: Buffer.alloc(0), size: 0 }, MAX), (e) => e.status === 400);
});

test("file melebihi batas ditolak 413; tepat di batas diterima", () => {
  const big = Buffer.concat([JPG, Buffer.alloc(MAX)]);
  assert.throws(() => validateImageFile(file(big), MAX), (e) => e.status === 413);
  const edge = Buffer.concat([JPG, Buffer.alloc(MAX - JPG.length)]);
  assert.deepEqual(validateImageFile(file(edge), MAX), { mime: "image/jpeg", ext: "jpg" });
});

test("catatan: karakter kontrol dan tanda < > dibuang, spasi dirapikan", () => {
  assert.equal(sanitizeNote("  daun\u0000 <b>menguning</b>   sejak\t\tminggu lalu  "), "daun bmenguning/b sejak minggu lalu");
  assert.equal(sanitizeNote(undefined), "");
});

test("parseDetectionCreate: lahan_id wajib dan aman, catatan opsional", () => {
  assert.deepEqual(parseDetectionCreate({ lahan_id: "abc123" }), { lahanId: "abc123", catatan: null });
  assert.equal(parseDetectionCreate({ lahan_id: "abc", catatan: " bercak  coklat " }).catatan, "bercak coklat");
  assert.throws(() => parseDetectionCreate({}), (e) => e.status === 400);
  assert.throws(() => parseDetectionCreate({ lahan_id: "../etc" }), (e) => e.status === 400);
  assert.throws(() => parseDetectionCreate({ lahan_id: "a", catatan: "x".repeat(MAX_NOTE + 1) }), (e) => e.status === 400);
});

test("simpan foto: nama acak berpola UUID, isi bisa dibaca, dua simpanan tidak bernama sama", async () => {
  const k1 = await saveImage(JPG, "jpg");
  const k2 = await saveImage(JPG, "jpg");
  assert.match(k1, /^[0-9a-f-]{36}\.jpg$/);
  assert.notEqual(k1, k2);
  assert.deepEqual(await readImage(k1), JPG);
  assert.equal((await readdir(tmp)).length, 2);
});

test("baca foto: kunci berbahaya atau tak ada dijawab 404", async () => {
  for (const key of ["../.env", "..\\x.jpg", "abc.jpg", "", "00000000-0000-0000-0000-000000000000.jpg"]) {
    await assert.rejects(readImage(key), (e) => e.status === 404, key);
  }
  await assert.rejects(saveImage(JPG, "exe"), (e) => e.status === 400);
});

test("bersihkan folder sementara", async () => {
  for (const f of await readdir(tmp)) await unlink(path.join(tmp, f)); // tanpa hapus rekursif (aturan proyek)
  await rmdir(tmp);
});
