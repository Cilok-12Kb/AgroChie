import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after } from "node:test";

// Sumber frontend tiruan + cache di folder sementara. Qwen tiruan, tanpa jaringan.
export const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agrochie-warm-"));
export const cleanup = () => after(() => fs.rmSync(tmp, { recursive: true, force: true }));

export const SRC = `
export function A({ cond }: { cond: boolean }) {
  return (
    <div>
      <h1>Selamat   datang
        petani</h1>
      <input placeholder="Cari lahan" title={'Judul bantuan'} aria-label={\`Label aksesibel\`} alt="Gambar panen" />
      <p>{'Teks dalam ekspresi'}</p>
      <p>{cond ? 'Pilihan satu' : 'Pilihan dua'}</p>
      <span data-no-translate>Nama Rahasia Budi</span>
      <div translate="no"><b>Teks bertanda no</b></div>
      <select>
        <option>Opsi tanpa value</option>
        <option value="x">Opsi dengan value</option>
      </select>
      <p>12345</p>
      <p>AgroChie Mobile</p>
    </div>
  );
}
`;

export function makeSrc(files = { "a.tsx": SRC }) {
  const dir = fs.mkdtempSync(path.join(tmp, "src-"));
  for (const [name, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), body);
  }
  return dir;
}
export const cachePath = () => path.join(tmp, `cache-${Math.random().toString(36).slice(2)}.json`);
export const q = () => {};
export const echo = (fn, calls = []) => async ({ user }) => {
  const src = JSON.parse(user);
  calls.push(Object.keys(src));
  return JSON.stringify(Object.fromEntries(Object.keys(src).map((k) => [k, fn(k)])));
};
export const baseOpts = (srcDir, cache, extra = {}) => ({
  srcDir, cachePath: cache, reportPath: path.join(tmp, "report.md"), targets: ["en"], host: "http://x", model: "m", ...extra,
});
