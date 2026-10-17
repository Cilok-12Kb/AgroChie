import test from 'node:test';
import assert from 'node:assert/strict';
import { sortedCountries, countryLabel, provinceSuggestions, COUNTRY_CODES, MODEL_PROVINCES } from './countries.ts';

test('Indonesia selalu di atas pada semua bahasa', () => {
  for (const lang of ['id', 'en', 'zh']) assert.equal(sortedCountries(lang)[0].code, 'ID');
});

test('sisanya urut menurut nama tampil per bahasa', () => {
  for (const lang of ['id', 'en', 'zh']) {
    const rest = sortedCountries(lang).slice(1);
    const locale = lang === 'zh' ? 'zh-CN' : lang;
    const sorted = [...rest].sort((a, b) => a.label.localeCompare(b.label, locale) || a.code.localeCompare(b.code));
    assert.deepEqual(rest.map(c => c.code), sorted.map(c => c.code), lang);
  }
});

test('urutan berbeda antar bahasa karena nama tampil berbeda', () => {
  const en = sortedCountries('en').map(c => c.code).join();
  const zh = sortedCountries('zh').map(c => c.code).join();
  assert.notEqual(en, zh);
});

test('semua kode muncul sekali dan tidak ada duplikat', () => {
  const codes = sortedCountries('en').map(c => c.code);
  assert.equal(new Set(codes).size, codes.length);
  assert.equal(codes.length, new Set(COUNTRY_CODES).size);
});

test('label Intl per bahasa', () => {
  assert.equal(countryLabel('MY', 'id'), 'Malaysia');
  assert.equal(countryLabel('ID', 'id'), 'Indonesia');
  assert.equal(countryLabel('JP', 'en'), 'Japan');
  assert.equal(countryLabel('JP', 'id'), 'Jepang');
  assert.equal(countryLabel('JP', 'zh'), '日本');
  assert.equal(countryLabel('SG', 'zh'), '新加坡');
});

test('kode tidak dikenal atau tidak valid -> tampilkan kodenya', () => {
  assert.equal(countryLabel('QQ', 'en'), 'QQ');
  assert.equal(countryLabel('1', 'en'), '1');
});

test('Intl.DisplayNames tidak tersedia -> kode', () => {
  const asli = Intl.DisplayNames;
  try {
    Intl.DisplayNames = undefined;
    assert.equal(countryLabel('MY', 'en'), 'MY');
    assert.equal(sortedCountries('en')[0].label, 'ID');
  } finally {
    Intl.DisplayNames = asli;
  }
});

test('kode tambahan (negara tersimpan di luar daftar) tetap tampil', () => {
  const list = sortedCountries('en', ['QQ']);
  assert.ok(list.some(c => c.code === 'QQ' && c.label === 'QQ'));
});

test('saran provinsi hanya untuk ID', () => {
  assert.deepEqual(provinceSuggestions('ID'), [...MODEL_PROVINCES]);
  assert.equal(provinceSuggestions('ID').length, 5);
  assert.deepEqual(provinceSuggestions('MY'), []);
  assert.deepEqual(provinceSuggestions(''), []);
});
