import { plantDetectionService as svc } from "../services/plant-detection.service.js";
import { parseDetectionCreate, parseDetectionList } from "../validators/detection.validator.js";

// [REVISI] Deteksi kualitas tanaman (sub-langkah 3). Controller tipis: validasi -> service. Tanpa query DB.
export async function create(req, res) {
  const { lahanId, catatan, lang } = parseDetectionCreate(req.body);
  const result = await svc.create({ userId: req.userId, file: req.file, lahanId, catatan, lang });
  res.status(result.status === "TIDAK_YAKIN" ? 200 : 201).json(result);
}

export async function list(req, res) {
  res.json(await svc.list({ userId: req.userId, ...parseDetectionList(req.query) }));
}

export async function detail(req, res) {
  res.json(await svc.get({ userId: req.userId, id: req.params.id }));
}

export async function photo(req, res) {
  const { buffer, mime } = await svc.photo({ userId: req.userId, id: req.params.id });
  res.set({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" });
  res.type(mime).send(buffer);
}

export async function toNote(req, res) {
  res.status(201).json(await svc.toNote({ userId: req.userId, id: req.params.id }));
}
