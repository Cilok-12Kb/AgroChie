import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { requireUser } from "../middleware/auth.js";
import * as farm from "../controllers/farm.controller.js";
import * as season from "../controllers/season.controller.js";
export const farmRoutes = Router();
farmRoutes.use(requireUser);
farmRoutes.get("/", asyncHandler(farm.list));
farmRoutes.post("/", asyncHandler(farm.create));
farmRoutes.get("/:id", asyncHandler(farm.get)); // [REVISI] bagian 17.9
farmRoutes.patch("/:id", asyncHandler(farm.patch));
farmRoutes.post("/:farmId/seasons", asyncHandler(season.create)); // [REVISI] 18.3
farmRoutes.get("/:farmId/seasons", asyncHandler(season.listByFarm)); // [REVISI] 18.3