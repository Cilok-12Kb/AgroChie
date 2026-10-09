import { HttpError } from "../utils/http-error.js";

export function requireUser(req, _res, next) {
  const id = req.header("x-user-id");
  if (!id) return next(new HttpError(401, "Belum masuk"));
  req.userId = id;
  next();
}