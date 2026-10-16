import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldSkipText, chunkBatches, cacheKey, storageKey, normalizeKey, rewrap, isSkippedTag, NO_TRANSLATE_SELECTOR,
  buildProtected, containsProtected, isValuelessOption, TRANSLATABLE_ATTRS, ALWAYS_PROTECTED,
} from './logic.ts';

test('buildProtected: kosong, spasi, dan nama < 3 karakter diabaikan; huruf kecil dan unik', () => {
  assert.deepEqual(buildProtected([null, undefined, '', '   ', 'Al', ' Bu ', 'Budi Santoso', 'BUDI  santoso', 'Kebun Barat']),
    ['budi santoso', 'kebun barat']);
  assert.deepEqual(buildProtected([]), []);
});

test('containsProtected: teks yang memuat nama dilewati, tidak peka huruf besar/kecil', () => {
  const list = buildProtected(['Budi Santoso', 'Lahan Kebun Barat']);
  assert.equal(containsProtected('Halo, Budi Santoso 👋', list), true);
  assert.equal(containsProtected('HALO, BUDI SANTOSO', list), true);
  assert.equal(containsProtected('Lahan lahan kebun barat dianalisis', list), true);
  assert.equal(containsProtected('Ringkasan musim aktif', list), false);
  assert.equal(containsProtected('Budi', list), false);
});

test('containsProtected: daftar kosong atau nama pendek tidak melewati teks apa pun', () => {
  assert.equal(containsProtected('Halo Al di sini', buildProtected(['Al', '', null])), false);
  assert.equal(containsProtected('apa saja', []), false);
  assert.equal(containsProtected('ab', ['ab']), false); // daftar manual yang terlalu pendek tetap diabaikan
});

test('shouldSkipText: melewati angka, simbol, mata uang, persen, tanggal, email, HP, URL', () => {
  for (const s of ['', ' ', 'a', '12345', '—', '12,5%', '100 %', 'Rp 5.200.000', 'Rp5,2 jt', '2025-03-12', '2025-03-12T10:00:00Z',
    '12 Mar 2025', 'a@b.com', 'petani@mail.co.id', '+62 812-3456-7890', '0812 3456 7890', 'https://agrochie.id/x', 'www.contoh.com']) {
    assert.equal(shouldSkipText(s, 'en'), true, `harus dilewati: "${s}"`);
  }
});

test('shouldSkipText: teks antarmuka biasa diterjemahkan', () => {
  for (const s of ['Musim tanam', 'Simpan perubahan', 'Sisa 5 hari', 'Rencana biaya 2025', 'Masuk dengan Google']) {
    assert.equal(shouldSkipText(s, 'en'), false, `harus diterjemahkan: "${s}"`);
    assert.equal(shouldSkipText(s, 'zh'), false);
  }
});

test('shouldSkipText: aksara Mandarin dilewati hanya saat target zh; teks terlalu panjang dilewati', () => {
  assert.equal(shouldSkipText('主页 Beranda', 'zh'), true);
  assert.equal(shouldSkipText('主页', 'zh'), true);
  assert.equal(shouldSkipText('主页', 'en'), false);
  assert.equal(shouldSkipText('x'.repeat(501), 'en'), true);
  assert.equal(shouldSkipText('x'.repeat(500), 'en'), false);
});

test('chunkBatches: unik, maksimal 50 teks per batch, urutan terjaga', () => {
  const texts = Array.from({ length: 120 }, (_, i) => `teks ${i}`);
  const batches = chunkBatches([...texts, ...texts.slice(0, 10)]);
  assert.deepEqual(batches.map((b) => b.length), [50, 50, 20]);
  assert.deepEqual(batches.flat(), texts);
  assert.deepEqual(chunkBatches([]), []);
});

test('chunkBatches: batas total karakter dan teks terlalu panjang dibuang', () => {
  const t = (i) => String(i).padStart(2, '0') + 'x'.repeat(498); // 500 karakter
  const batches = chunkBatches(Array.from({ length: 25 }, (_, i) => t(i)));
  assert.deepEqual(batches.map((b) => b.length), [20, 5]); // 20 x 500 = 10.000
  assert.deepEqual(chunkBatches(['ok', 'x'.repeat(501), '']), [['ok']]);
});

test('cacheKey dan storageKey: terpisah per bahasa', () => {
  assert.notEqual(cacheKey('en', 'Halo'), cacheKey('zh', 'Halo'));
  assert.equal(cacheKey('en', 'Halo'), cacheKey('en', 'Halo'));
  assert.notEqual(cacheKey('en', 'x'), cacheKey('en', 'y'));
  assert.notEqual(storageKey('en'), storageKey('zh'));
});

test('normalizeKey dan rewrap: spasi awal/akhir dipertahankan', () => {
  assert.equal(normalizeKey('  Halo \n  dunia  '), 'Halo dunia');
  assert.equal(rewrap('  Halo \n', 'Hello'), '  Hello \n');
  assert.equal(rewrap('Halo', 'Hello'), 'Hello');
});

test('isSkippedTag dan selektor data-no-translate', () => {
  for (const tag of ['script', 'STYLE', 'code', 'pre', 'textarea', 'input']) assert.equal(isSkippedTag(tag), true);
  for (const tag of ['DIV', 'p', 'button', 'option']) assert.equal(isSkippedTag(tag), false);
  assert.match(NO_TRANSLATE_SELECTOR, /data-no-translate/);
  assert.match(NO_TRANSLATE_SELECTOR, /translate="no"/);
});

test('isValuelessOption: option tanpa value dilewati; option ber-value dan elemen lain tidak', () => {
  assert.equal(isValuelessOption('OPTION', false), true);
  assert.equal(isValuelessOption('option', false), true);
  assert.equal(isValuelessOption('OPTION', true), false);
  assert.equal(isValuelessOption('DIV', false), false);
});

test('AgroChie selalu terlindungi, walau daftar akun/lahan kosong', () => {
  assert.deepEqual(ALWAYS_PROTECTED, ['agrochie']);
  assert.equal(containsProtected('AgroChie', []), true);
  assert.equal(containsProtected('Beranda · AGROCHIE', []), true);
  assert.equal(containsProtected('Agro', []), false);
  assert.equal(containsProtected('Ringkasan musim', []), false);
});

test('TRANSLATABLE_ATTRS tidak memuat value', () => {
  assert.equal(TRANSLATABLE_ATTRS.includes('value'), false);
});

