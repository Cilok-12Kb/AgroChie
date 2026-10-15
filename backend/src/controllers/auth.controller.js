import { registerUser, loginUser, getMe, createGuest, deleteGuest } from "../services/auth.service.js";
import { parseRegister, parseLogin } from "../validators/auth.validator.js";
import { getSessionTools } from "../utils/session.js";
import { parseSetEmail, parseVerifyEmail } from "../validators/auth-email.validator.js";
import { setEmail, resendVerification, verifyEmail } from "../services/email-verification.service.js";
import { pickLang } from "../services/email-templates.js";
import { parseForgotPassword, parseResetPassword, parseGoogle, parseGoogleLink } from "../validators/auth-email.validator.js";
import { assertGoogleReady, loginWithGoogle, linkGoogle } from "../services/google-auth.service.js";
import { assertMailReady, startForgotJob, resetPassword, FORGOT_MESSAGE } from "../services/password-reset.service.js";

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

// [REVISI] langkah 9: login Google. Urutan: validasi body (400) -> 503 -> verifikasi (401) -> aturan akun.
// Cookie sesi baru menggantikan sesi sebelumnya (termasuk tamu). Respons = bentuk public user seperti login.
export async function googleLoginHandler(req, res) {
  const { idToken } = parseGoogle(req.body);
  await assertGoogleReady();
  const { user, sessionVersion, created } = await loginWithGoogle({ idToken });
  await (await getSessionTools()).setSessionCookie(res, { ...user, sessionVersion });
  res.status(created ? 201 : 200).json(user);
}

// [REVISI] langkah 10: tautkan Google (wajib login). Respons 200 = public user terbaru; sessionVersion tidak berubah.
export async function googleLinkHandler(req, res) {
  const { idToken, password, lang } = parseGoogleLink(req.body);
  res.json(await linkGoogle(req.user.id, { idToken, password, lang: pickLang(lang, req.headers["accept-language"]) }));
}

// [REVISI] langkah 8: lupa dan reset password.
// forgot: validasi -> 503 bila mail belum siap -> balas 202 -> baru kerjakan di latar.
export async function forgotPasswordHandler(req, res) {
  const { email, lang } = parseForgotPassword(req.body);
  await assertMailReady();
  res.status(202).json({ ok: true, message: FORGOT_MESSAGE });
  startForgotJob({ email, lang: pickLang(lang, req.headers["accept-language"]) });
}

// reset: tanpa login otomatis; cookie sesi dibersihkan.
export async function resetPasswordHandler(req, res) {
  const { token, passwordBaru } = parseResetPassword(req.body);
  const result = await resetPassword({
    token,
    passwordBaru,
    lang: pickLang(req.body?.lang, req.headers["accept-language"]),
  });
  (await getSessionTools()).clearSessionCookie(res);
  res.json(result);
}

