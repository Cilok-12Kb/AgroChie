import { predictCost, startFinancing } from "../services/prediction.service.js";
import { createSeason, listSeasons, getSeason } from "../services/season.service.js";
import { parseSeasonCreate } from "../validators/season.validator.js";

// [REVISI] 18.3: buat dan baca musim.
export async function create(req, res) {
  res.status(201).json(await createSeason(req.userId, req.params.farmId, parseSeasonCreate(req.body)));
}
export async function listByFarm(req, res) {
  res.json(await listSeasons(req.userId, req.params.farmId));
}
export async function get(req, res) {
  res.json(await getSeason(req.userId, req.params.id));
}
export async function predict(req, res) {
  res.json(await predictCost(req.userId, req.params.id, req.body ?? {}));
}
export async function start(req, res) {
  res.status(201).json(await startFinancing(req.userId, req.params.id, req.body ?? {}));
}