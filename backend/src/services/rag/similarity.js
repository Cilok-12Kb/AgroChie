export function normalize(v) {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
}

/** Vektor sudah dinormalkan, jadi hasil kali titik = kemiripan kosinus. */
export function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** Ambil k item paling mirip yang skornya >= minScore. Item beda dimensi dilewati. */
export function topK(queryVec, items, { k = 4, minScore = 0.5 } = {}) {
  return items
    .filter((it) => it.embedding.length === queryVec.length)
    .map((it) => ({ ...it, score: dot(queryVec, it.embedding) }))
    .filter((it) => it.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}