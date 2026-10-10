import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { requireUser } from "../middleware/auth.js";
import * as crop from "../controllers/crop.controller.js";

export const cropRoutes = Router();
cropRoutes.use(requireUser);
cropRoutes.post("/leaf-quality", asyncHandler(crop.leafQuality));