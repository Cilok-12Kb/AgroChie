import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { requireUser } from "../middleware/auth.js";
import * as season from "../controllers/season.controller.js";

export const seasonRoutes = Router();
seasonRoutes.use(requireUser);
seasonRoutes.get("/:id", asyncHandler(season.get)); // [REVISI] 18.3
seasonRoutes.patch("/:id", asyncHandler(season.patch)); // [REVISI] 18.4
seasonRoutes.post("/:id/close", asyncHandler(season.close));
seasonRoutes.post("/:id/predict-cost", asyncHandler(season.predict));
seasonRoutes.post("/:id/stop-financing", asyncHandler(season.stop)); // [REVISI] 18.5
seasonRoutes.post("/:id/start-financing", asyncHandler(season.start));