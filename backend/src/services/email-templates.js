// Template email verifikasi dan reset password, bahasa EN dan ID (teks + HTML).
// Fungsi murni: tidak membaca env dan tidak mengirim apa pun.

export const SUPPORTED_LANGS = ["id", "en"];

/** Pilih bahasa dari nilai eksplisit (body `lang`) atau header Accept-Language; bawaan "id". */
export function pickLang(explicit, acceptLanguage) {
  const e = String(explicit ?? "").trim().toLowerCase();
  if (SUPPORTED_LANGS.includes(e)) return e;
  const first = String(acceptLanguage ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  const base = first.split(/[-;]/)[0];
  return SUPPORTED_LANGS.includes(base) ? base : "id";
}

/** Escape HTML agar nama/URL tidak bisa menyisipkan markup. */
export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Tautan ke frontend; token di-encode. */
export function buildLink(appBaseUrl, path, token) {
  return `${String(appBaseUrl).replace(/\/+$/, "")}${path}?token=${encodeURIComponent(token)}`;
}

const TEXT = {
  id: {
    verify: {
      subject: "Verifikasi email AgroChie Anda",
      greeting: (n) => (n ? `Halo ${n},` : "Halo,"),
      intro: "Klik tautan di bawah ini untuk memverifikasi alamat email akun AgroChie Anda.",
      button: "Verifikasi email",
      expiry: (v) => `Tautan berlaku ${v.hours} jam dan hanya bisa dipakai sekali.`,
      ignore: "Jika Anda tidak meminta ini, abaikan email ini.",
    },
    reset: {
      subject: "Atur ulang kata sandi AgroChie Anda",
      greeting: (n) => (n ? `Halo ${n},` : "Halo,"),
      intro: "Kami menerima permintaan untuk mengatur ulang kata sandi akun AgroChie Anda. Klik tautan di bawah ini untuk membuat kata sandi baru.",
      button: "Atur ulang kata sandi",
      expiry: (v) => `Tautan berlaku ${v.minutes} menit dan hanya bisa dipakai sekali.`,
      ignore: "Jika Anda tidak memintanya, abaikan email ini; kata sandi Anda tidak berubah.",
    },
    fallback: "Jika tombol tidak berfungsi, salin tautan ini ke peramban Anda:",
  },
  en: {
    verify: {
      subject: "Verify your AgroChie email",
      greeting: (n) => (n ? `Hello ${n},` : "Hello,"),
      intro: "Click the link below to verify the email address of your AgroChie account.",
      button: "Verify email",
      expiry: (v) => `This link is valid for ${v.hours} hours and can be used only once.`,
      ignore: "If you did not request this, you can ignore this email.",
    },
    reset: {
      subject: "Reset your AgroChie password",
      greeting: (n) => (n ? `Hello ${n},` : "Hello,"),
      intro: "We received a request to reset the password of your AgroChie account. Click the link below to choose a new password.",
      button: "Reset password",
      expiry: (v) => `This link is valid for ${v.minutes} minutes and can be used only once.`,
      ignore: "If you did not request this, ignore this email; your password will not change.",
    },
    fallback: "If the button does not work, copy this link into your browser:",
  },
};

function render(kind, { lang, name, url, hours, minutes }) {
  const L = TEXT[SUPPORTED_LANGS.includes(lang) ? lang : "id"];
  const t = L[kind];
  const vars = { hours, minutes };
  const greeting = t.greeting(name);
  const expiry = t.expiry(vars);
  const text = [greeting, "", t.intro, "", url, "", expiry, t.ignore, "", "AgroChie"].join("\n");
  const html =
    `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.5">` +
    `<p>${escapeHtml(greeting)}</p>` +
    `<p>${escapeHtml(t.intro)}</p>` +
    `<p><a href="${escapeHtml(url)}" style="display:inline-block;background:#047857;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">${escapeHtml(t.button)}</a></p>` +
    `<p style="font-size:13px;color:#475569">${escapeHtml(L.fallback)}<br>${escapeHtml(url)}</p>` +
    `<p style="font-size:13px;color:#475569">${escapeHtml(expiry)} ${escapeHtml(t.ignore)}</p>` +
    `<p>AgroChie</p></body></html>`;
  return { subject: t.subject, text, html };
}

/** Email verifikasi. url = tautan lengkap; hours = masa berlaku (jam). */
export function verifyEmailTemplate({ lang = "id", name, url, hours }) {
  return render("verify", { lang, name, url, hours });
}

/** Email reset password. url = tautan lengkap; minutes = masa berlaku (menit). */
export function resetPasswordTemplate({ lang = "id", name, url, minutes }) {
  return render("reset", { lang, name, url, minutes });
}
