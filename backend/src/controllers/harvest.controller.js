import { addHarvest, listHarvests, putSample } from "../services/harvest.service.js";
import { parseHarvestCreate, parseSample } from "../validators/harvest.validator.js";

// [REVISI] 18.9
export async function create(req, res) {
  res.status(201).json(await addHarvest(req.userId, req.params.id, parseHarvestCreate(req.body)));
}
export async function list(req, res) {
  res.json(await listHarvests(req.userId, req.params.id));
}
export async function sample(req, res) {
  res.json(await putSample(req.userId, req.params.id, parseSample(req.body)));
}
