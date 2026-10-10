import { predictLeaf } from "../services/prediction.service.js";

export async function leafQuality(req, res) {
  res.json(await predictLeaf(req.body ?? {}));
}