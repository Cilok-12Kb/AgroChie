import { createFarm, listFarms, getFarm, updateFarm } from "../services/farm.service.js";
import { validateFarm, parseFarmPatch } from "../validators/farm.validator.js";
export async function get(req, res) {
  res.json(await getFarm(req.userId, req.params.id));
}
export async function patch(req, res) {
  res.json(await updateFarm(req.userId, req.params.id, parseFarmPatch(req.body)));
}
export async function create(req, res) {
  res.status(201).json(await createFarm(req.userId, validateFarm(req.body)));
}
export async function list(req, res) {
  res.json(await listFarms(req.userId));
}
