import { createFarm, listFarms } from "../services/farm.service.js";
import { validateFarm } from "../validators/farm.validator.js";
export async function create(req, res) {
  res.status(201).json(await createFarm(req.userId, validateFarm(req.body)));
}
export async function list(req, res) {
  res.json(await listFarms(req.userId));
}
