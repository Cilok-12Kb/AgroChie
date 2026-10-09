import { registerUser } from "../services/auth.service.js";
export async function register(req, res) {
  res.status(201).json(await registerUser(req.body ?? {}));
}