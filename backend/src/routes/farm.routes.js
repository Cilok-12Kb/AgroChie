import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { requireUser } from "../middleware/auth.js";
import * as farm from "../controllers/farm.controller.js";
export const farmRoutes = Router();
farmRoutes.use(requireUser);
farmRoutes.get("/", asyncHandler(farm.list));
farmRoutes.post("/", asyncHandler(farm.create));
farmRoutes.get("/:id", asyncHandler(farm.get)); // [REVISI] bagian 17.9
farmRoutes.patch("/:id", asyncHandler(farm.patch));