import { addPhoto, listPhotos } from "../services/photo.service.js";
import { parsePhotoCreate } from "../validators/photo.validator.js";

// [REVISI] 18.10: foto sampel (metadata saja).
export async function create(req, res) {
  res.status(201).json(await addPhoto(req.userId, req.params.id, parsePhotoCreate(req.body)));
}
export async function list(req, res) {
  res.json(await listPhotos(req.userId, req.params.id));
}
