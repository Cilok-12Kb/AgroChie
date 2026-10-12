import { registerUser, loginUser, getMe } from "../services/auth.service.js";
import { parseRegister, parseLogin } from "../validators/auth.validator.js";
import { getSessionTools } from "../utils/session.js";

// [REVISI] bagian 17.4: register memvalidasi dengan zod dan langsung membuat sesi; tambah login, me, logout.
export async function register(req, res) {
  const user = await registerUser(parseRegister(req.body));
  await (await getSessionTools()).setSessionCookie(res, user);
  res.status(201).json(user);
}

export async function login(req, res) {
  const user = await loginUser(parseLogin(req.body));
  await (await getSessionTools()).setSessionCookie(res, user);
  res.json(user);
}

export async function me(req, res) {
  res.json(await getMe(req.user.id));
}

export async function logout(_req, res) {
  (await getSessionTools()).clearSessionCookie(res);
  res.status(204).end();
}