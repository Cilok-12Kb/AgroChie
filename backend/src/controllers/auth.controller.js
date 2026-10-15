import { registerUser, loginUser, getMe, createGuest, deleteGuest } from "../services/auth.service.js";
import { parseRegister, parseLogin } from "../validators/auth.validator.js";
import { getSessionTools } from "../utils/session.js";
import { parseSetEmail, parseVerifyEmail } from "../validators/auth-email.validator.js";
import { setEmail, resendVerification, verifyEmail } from "../services/email-verification.service.js";
import { pickLang } from "../services/email-templates.js";

// [REVISI] bagian 17.4: register memvalidasi dengan zod dan langsung membuat sesi; tambah login, me, logout.
export async function register(req, res) {
  // [REVISI] D1: sessionVersion hanya untuk klaim sv di token, tidak dikirim ke klien.
  const { user, sessionVersion } = await registerUser(parseRegister(req.body));
  await (await getSessionTools()).setSessionCookie(res, { ...user, sessionVersion });
  res.status(201).json(user);
}

export async function login(req, res) {
  const { user, sessionVersion } = await loginUser(parseLogin(req.body));
  await (await getSessionTools()).setSessionCookie(res, { ...user, sessionVersion });
  res.json(user);
}

export async function me(req, res) {
  res.json(await getMe(req.user.id));
}

// [REVISI] bagian 17.6: tamu dihapus saat logout; akun biasa hanya dihapus cookie-nya.
export async function logout(req, res) {
  if (req.user?.isGuest) await deleteGuest(req.user.id);
  (await getSessionTools()).clearSessionCookie(res);
  res.status(204).end();
}

// bagian 17.6: sesi tamu 24 jam, tanpa pembaruan token (diatur di session.js)
export async function guest(_req, res) {
  const { sessionVersion, ...user } = await createGuest(); // [REVISI] D1
  await (await getSessionTools()).setSessionCookie(res, { ...user, sessionVersion });
  res.status(201).json({ user });
}

// [REVISI] langkah 6: tambah dan verifikasi email. Bahasa email: body.lang, lalu Accept-Language, bawaan "id".
export async function setEmailHandler(req, res) {
  const { email, lang } = parseSetEmail(req.body);
  res.json(await setEmail(req.user.id, { email, lang: pickLang(lang, req.headers["accept-language"]) }));
}

export async function resendVerificationHandler(req, res) {
  const lang = pickLang(req.body?.lang, req.headers["accept-language"]);
  await resendVerification(req.user.id, { lang });
  res.status(202).json({ ok: true });
}

export async function verifyEmailHandler(req, res) {
  res.json(await verifyEmail(parseVerifyEmail(req.body)));
}
