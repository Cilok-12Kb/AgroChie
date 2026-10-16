// Template email verifikasi, reset password, dan notifikasi akun dalam tiga bahasa antarmuka.
// Fungsi murni: tidak membaca env dan tidak mengirim apa pun.

export const SUPPORTED_LANGS = ["id", "en", "zh"];

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
  zh: {
    verify: {
      subject: "验证您的 AgroChie 邮箱",
      greeting: (n) => (n ? `您好，${n}：` : "您好："),
      intro: "点击下方链接，验证您的 AgroChie 账户邮箱。",
      button: "验证邮箱",
      expiry: (v) => `此链接在 ${v.hours} 小时内有效，且只能使用一次。`,
      ignore: "如果您没有提出此请求，请忽略此邮件。",
    },
    reset: {
      subject: "重置您的 AgroChie 密码",
      greeting: (n) => (n ? `您好，${n}：` : "您好："),
      intro: "我们收到了重置您 AgroChie 账户密码的请求。点击下方链接设置新密码。",
      button: "重置密码",
      expiry: (v) => `此链接在 ${v.minutes} 分钟内有效，且只能使用一次。`,
      ignore: "如果您没有提出此请求，请忽略此邮件；您的密码不会更改。",
    },
    fallback: "如果按钮无法使用，请将此链接复制到浏览器中：",
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

// [REVISI] langkah 8: pemberitahuan password berubah (tanpa tautan apa pun).
const CHANGED = {
  id: {
    subject: "Kata sandi AgroChie Anda telah diganti",
    greeting: (n) => (n ? `Halo ${n},` : "Halo,"),
    body: "Kata sandi akun AgroChie Anda baru saja diganti. Semua sesi masuk sebelumnya telah dikeluarkan.",
    warn: "Jika ini bukan Anda, segera atur ulang kata sandi lewat fitur lupa kata sandi atau hubungi kami.",
  },
  en: {
    subject: "Your AgroChie password was changed",
    greeting: (n) => (n ? `Hello ${n},` : "Hello,"),
    body: "The password of your AgroChie account was just changed. All previous sessions have been signed out.",
    warn: "If this was not you, reset your password right away using forgot password, or contact us.",
  },
  zh: {
    subject: "您的 AgroChie 密码已更改",
    greeting: (n) => (n ? `您好，${n}：` : "您好："),
    body: "您的 AgroChie 账户密码刚刚已更改，所有之前的登录会话均已退出。",
    warn: "如果这不是您本人操作，请立即使用“忘记密码”重置密码或联系我们。",
  },
};

/** Email pemberitahuan password diganti. Tidak memuat tautan. */
export function passwordChangedTemplate({ lang = "id", name } = {}) {
  const t = CHANGED[SUPPORTED_LANGS.includes(lang) ? lang : "id"];
  const greeting = t.greeting(name);
  const text = [greeting, "", t.body, t.warn, "", "AgroChie"].join("\n");
  const html =
    `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.5">` +
    `<p>${escapeHtml(greeting)}</p><p>${escapeHtml(t.body)}</p>` +
    `<p style="font-size:13px;color:#475569">${escapeHtml(t.warn)}</p><p>AgroChie</p></body></html>`;
  return { subject: t.subject, text, html };
}

// [REVISI] langkah 10: pemberitahuan akun Google ditautkan (tanpa tautan apa pun).
const GOOGLE_LINKED = {
  id: {
    subject: "Akun Google telah ditautkan ke akun AgroChie kamu",
    greeting: (n) => (n ? `Halo ${n},` : "Halo,"),
    body: (v) => `Akun Google ${v.masked} baru saja ditautkan ke akun AgroChie kamu pada ${v.when}.`,
    warn: "Jika bukan kamu yang melakukannya, segera atur ulang kata sandi lewat fitur lupa kata sandi atau hubungi kami.",
  },
  en: {
    subject: "A Google account was linked to your AgroChie account",
    greeting: (n) => (n ? `Hello ${n},` : "Hello,"),
    body: (v) => `The Google account ${v.masked} was just linked to your AgroChie account on ${v.when}.`,
    warn: "If this was not you, reset your password right away using forgot password, or contact us.",
  },
  zh: {
    subject: "Google 账户已关联到您的 AgroChie 账户",
    greeting: (n) => (n ? `您好，${n}：` : "您好："),
    body: (v) => `Google 账户 ${v.masked} 已于 ${v.when} 关联到您的 AgroChie 账户。`,
    warn: "如果这不是您本人操作，请立即使用“忘记密码”重置密码或联系我们。",
  },
};

/** Samarkan email: huruf pertama + *** + domain, mis. a***@gmail.com. */
export function maskEmail(email) {
  const [local = "", domain = ""] = String(email ?? "").split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}
// [REVISI] Format waktu: Indonesia = WIB (UTC+7) "15 Oktober 2026, 10.15 WIB"; Inggris = UTC "2026-10-15 03:15 UTC".
// Dihitung manual (tanpa Intl/ICU) agar hasil sama di semua mesin.
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const p2 = (n) => String(n).padStart(2, "0");

export function formatWhen(date, lang = "id") {
  if (lang === "en") return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
  if (lang === "zh") {
    const iso = date.toISOString();
    return `${iso.slice(0, 4)}年${Number(iso.slice(5, 7))}月${Number(iso.slice(8, 10))}日 ${iso.slice(11, 16)} UTC`;
  }
  const w = new Date(date.getTime() + 7 * 3_600_000); // geser ke WIB, baca dengan getter UTC
  return `${w.getUTCDate()} ${BULAN[w.getUTCMonth()]} ${w.getUTCFullYear()}, ${p2(w.getUTCHours())}.${p2(w.getUTCMinutes())} WIB`;
}



/** Email pemberitahuan Google ditautkan. masked = alamat tersamar; when = Date. */
export function googleLinkedTemplate({ lang = "id", name, masked, when = new Date() } = {}) {
  const t = GOOGLE_LINKED[SUPPORTED_LANGS.includes(lang) ? lang : "id"];
  const whenText = formatWhen(when, SUPPORTED_LANGS.includes(lang) ? lang : "id"); // [REVISI] id=WIB, en=UTC
  const greeting = t.greeting(name);
  const body = t.body({ masked, when: whenText });
  const text = [greeting, "", body, t.warn, "", "AgroChie"].join("\n");
  const html =
    `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.5">` +
    `<p>${escapeHtml(greeting)}</p><p>${escapeHtml(body)}</p>` +
    `<p style="font-size:13px;color:#475569">${escapeHtml(t.warn)}</p><p>AgroChie</p></body></html>`;
  return { subject: t.subject, text, html };
}

// [REVISI] B7: pemberitahuan email dihapus, Google dilepas, nomor HP diganti. Tanpa tautan.
const ACCOUNT_NOTICE = {
  id: {
    greeting: GOOGLE_LINKED.id.greeting,
    emailRemoved: {
      subject: "Email dihapus dari akun AgroChie kamu",
      body: (v) => `Email ${v.masked} dihapus dari akunmu pada ${v.when}. Email ini tidak lagi dipakai untuk masuk atau mengatur ulang kata sandi. Perangkat lain sudah dikeluarkan.`,
      warn: 'Jika bukan kamu, masuk dengan metode lain lalu tambahkan email kembali. Atur ulang kata sandi lewat "Lupa kata sandi" dan periksa metode masuk di halaman Profil.',
    },
    googleUnlinked: {
      subject: "Akun Google dilepas dari akun AgroChie kamu",
      body: (v) => `Penautan akun Google dilepas dari akun AgroChie kamu pada ${v.when}. Perangkat lain sudah dikeluarkan.`,
      warn: 'Jika bukan kamu, atur ulang kata sandi lewat "Lupa kata sandi" dan periksa metode masuk di halaman Profil.',
    },
    phoneChanged: {
      subject: "Nomor HP akun AgroChie kamu diganti",
      body: (v) => `Nomor HP akunmu diganti dari ${v.oldMasked} ke ${v.newMasked} pada ${v.when}. Perangkat lain sudah dikeluarkan.`,
      warn: 'Jika bukan kamu, atur ulang kata sandi lewat "Lupa kata sandi" dan periksa metode masuk di halaman Profil.',
    },
  },
  en: {
    greeting: GOOGLE_LINKED.en.greeting,
    emailRemoved: {
      subject: "An email address was removed from your AgroChie account",
      body: (v) => `The email ${v.masked} was removed from your account on ${v.when}. It is no longer used to sign in or reset your password. Other devices were signed out.`,
      warn: 'If this was not you, sign in with another method and add your email again. Reset your password using "Forgot password" and check your sign-in methods on the Profile page.',
    },
    googleUnlinked: {
      subject: "A Google account was unlinked from your AgroChie account",
      body: (v) => `A Google account was unlinked from your AgroChie account on ${v.when}. Other devices were signed out.`,
      warn: 'If this was not you, reset your password using "Forgot password" and check your sign-in methods on the Profile page.',
    },
    phoneChanged: {
      subject: "The phone number on your AgroChie account was changed",
      body: (v) => `The phone number on your account was changed from ${v.oldMasked} to ${v.newMasked} on ${v.when}. Other devices were signed out.`,
      warn: 'If this was not you, reset your password using "Forgot password" and check your sign-in methods on the Profile page.',
    },
  },
  zh: {
    greeting: GOOGLE_LINKED.zh.greeting,
    emailRemoved: {
      subject: "邮箱已从您的 AgroChie 账户中删除",
      body: (v) => `邮箱 ${v.masked} 已于 ${v.when} 从您的账户中删除。该邮箱将不能再用于登录或重置密码，其他设备也已退出登录。`,
      warn: "如果这不是您本人操作，请使用其他方式登录并重新添加邮箱。请通过“忘记密码”重置密码，并在个人资料页面检查登录方式。",
    },
    googleUnlinked: {
      subject: "Google 账户已与您的 AgroChie 账户解除关联",
      body: (v) => `Google 账户已于 ${v.when} 与您的 AgroChie 账户解除关联，其他设备也已退出登录。`,
      warn: "如果这不是您本人操作，请通过“忘记密码”重置密码，并在个人资料页面检查登录方式。",
    },
    phoneChanged: {
      subject: "您的 AgroChie 账户手机号码已更改",
      body: (v) => `您账户的手机号码已于 ${v.when} 从 ${v.oldMasked} 更改为 ${v.newMasked}，其他设备也已退出登录。`,
      warn: "如果这不是您本人操作，请通过“忘记密码”重置密码，并在个人资料页面检查登录方式。",
    },
  },
};

function renderNotice(kind, { lang = "id", name, when = new Date(), ...vars } = {}) {
  const l = SUPPORTED_LANGS.includes(lang) ? lang : "id";
  const t = ACCOUNT_NOTICE[l][kind];
  const greeting = ACCOUNT_NOTICE[l].greeting(name);
  const body = t.body({ ...vars, when: formatWhen(when, l) });
  const text = [greeting, "", body, t.warn, "", "AgroChie"].join("\n");
  const html =
    `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.5">` +
    `<p>${escapeHtml(greeting)}</p><p>${escapeHtml(body)}</p>` +
    `<p style="font-size:13px;color:#475569">${escapeHtml(t.warn)}</p><p>AgroChie</p></body></html>`;
  return { subject: t.subject, text, html };
}

/** Pemberitahuan email dihapus (dikirim ke email LAMA). masked = email tersamar. */
export const emailRemovedTemplate = (o) => renderNotice("emailRemoved", o);
/** Pemberitahuan Google dilepas. */
export const googleUnlinkedTemplate = (o) => renderNotice("googleUnlinked", o);
/** Pemberitahuan nomor HP diganti. oldMasked dan newMasked sudah tersamar. */
export const phoneChangedTemplate = (o) => renderNotice("phoneChanged", o);

/** Email reset password. url = tautan lengkap; minutes = masa berlaku (menit). */
export function resetPasswordTemplate({ lang = "id", name, url, minutes }) {
  return render("reset", { lang, name, url, minutes });
}
