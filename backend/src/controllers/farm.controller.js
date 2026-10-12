import { createFarm, listFarms, getFarm, updateFarm } from "../services/farm.service.js";
import { parseFarmCreate, parseFarmPatch } from "../validators/farm.validator.js";
export async function get(req, res) {
  res.json(await getFarm(req.userId, req.params.id));
}
export async function patch(req, res) {
  res.json(await updateFarm(req.userId, req.params.id, parseFarmPatch(req.body)));
}
export async function create(req, res) {
  // [REVISI] 18.1: validateFarm lama tidak dipakai lagi; userId dari sesi (req.userId), bukan body.
  res.status(201).json(await createFarm(req.userId, parseFarmCreate(req.body)));
}
export async function list(req, res) {
  res.json(await listFarms(req.userId));
}
