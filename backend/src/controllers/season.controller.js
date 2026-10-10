import { predictCost, startFinancing } from "../services/prediction.service.js";

export async function predict(req, res) {
  res.json(await predictCost(req.userId, req.params.id, req.body ?? {}));
}
export async function start(req, res) {
  res.status(201).json(await startFinancing(req.userId, req.params.id, req.body ?? {}));
}