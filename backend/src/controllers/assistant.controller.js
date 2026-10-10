import { chat as chatService, getSession } from "../services/assistant.service.js";

export async function chat(req, res) {
  res.json(await chatService(req.userId, req.body ?? {}));
}

export async function session(req, res) {
  res.json(await getSession(req.userId, req.params.id));
}