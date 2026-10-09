import { closeSeason } from "../services/season-record.service.js";
export async function close(req, res) {
  res.status(201).json(await closeSeason(req.userId, req.params.id, req.body ?? {}));
}