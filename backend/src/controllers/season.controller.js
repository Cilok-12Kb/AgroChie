import { predictCost, startFinancing, recalcCost } from "../services/prediction.service.js";
import { createSeason, listSeasons, getSeason, updateSeason, stopFinancing, startPlanting } from "../services/season.service.js";
import { parseSeasonCreate, parseSeasonPatch, parseStartPlanting } from "../validators/season.validator.js";

export async function plant(req, res) { // [REVISI] 18.7
  res.json(await startPlanting(req.userId, req.params.id, parseStartPlanting(req.body)));
}

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
export async function stop(req, res) {
  res.json(await stopFinancing(req.userId, req.params.id));
}
export async function patch(req, res) {
  res.json(await updateSeason(req.userId, req.params.id, parseSeasonPatch(req.body)));
}
export async function recalc(req, res) { // [REVISI] 18.6
  res.json(await recalcCost(req.userId, req.params.id, req.body ?? {}));
}
export async function predict(req, res) {
  res.json(await predictCost(req.userId, req.params.id, req.body ?? {}));
}
export async function start(req, res) {
  res.status(201).json(await startFinancing(req.userId, req.params.id, req.body ?? {}));
}