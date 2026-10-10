/**
 * Pecah dokumen markdown menjadi potongan (chunk) per judul, lalu per ukuran.
 * Judul bagian disertakan di awal isi potongan agar potongan tetap bermakna saat berdiri sendiri.
 */
export function chunkMarkdown(md, { maxChars = 900, overlap = 120 } = {}) {
  const sections = [];
  let title = "Pendahuluan";
  let buf = [];
  const flush = () => {
    const body = buf.join("\n").trim();
    if (body) sections.push({ title, body });
    buf = [];
  };

  for (const line of md.replace(/\r\n/g, "\n").split("\n")) {
    const m = /^#{1,3}\s+(.+?)\s*$/.exec(line);
    if (m) {
      flush();
      title = m[1];
    } else {
      buf.push(line);
    }
  }
  flush();

  const chunks = [];
  for (const s of sections) {
    for (const piece of splitBody(s.body, maxChars, overlap)) {
      chunks.push({ title: s.title, content: `${s.title}\n${piece}` });
    }
  }
  return chunks.map((c, position) => ({ ...c, position }));
}

function splitBody(body, maxChars, overlap) {
  if (body.length <= maxChars) return [body];
  const out = [];
  let cur = "";
  for (const para of body.split(/\n\s*\n/)) {
    if (para.length > maxChars) {
      if (cur) out.push(cur);
      cur = "";
      out.push(...hardSplit(para, maxChars, overlap));
      continue;
    }
    if (cur && cur.length + para.length + 2 > maxChars) {
      out.push(cur);
      cur = "";
    }
    cur = cur ? `${cur}\n\n${para}` : para;
  }
  if (cur) out.push(cur);
  return out;
}

function hardSplit(text, maxChars, overlap) {
  const out = [];
  for (let i = 0; i < text.length; i += maxChars - overlap) {
    out.push(text.slice(i, i + maxChars));
    if (i + maxChars >= text.length) break;
  }
  return out;
}