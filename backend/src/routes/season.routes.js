import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { requireUser } from "../middleware/auth.js";
import * as season from "../controllers/season.controller.js";

export const seasonRoutes = Router();
seasonRoutes.use(requireUser);
seasonRoutes.post("/:id/close", asyncHandler(season.close));
seasonRoutes.post("/:id/predict-cost", asyncHandler(season.predict));
seasonRoutes.post("/:id/start-financing", asyncHandler(season.start));