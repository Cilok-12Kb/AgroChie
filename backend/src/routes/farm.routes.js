import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { requireUser } from "../middleware/auth.js";
import * as farm from "../controllers/farm.controller.js";
export const farmRoutes = Router();
farmRoutes.use(requireUser);
farmRoutes.get("/", asyncHandler(farm.list));
farmRoutes.post("/", asyncHandler(farm.create));