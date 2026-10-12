import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { requireUser } from "../middleware/auth.js";
import * as season from "../controllers/season.controller.js";
import * as expense from "../controllers/expense.controller.js"; // [REVISI] 18.8

export const seasonRoutes = Router();
seasonRoutes.use(requireUser);
seasonRoutes.get("/:id", asyncHandler(season.get)); // [REVISI] 18.3
seasonRoutes.patch("/:id", asyncHandler(season.patch)); // [REVISI] 18.4
seasonRoutes.get("/:id/expenses/summary", asyncHandler(expense.summary)); // [REVISI] 18.8 (sebelum :expenseId)
seasonRoutes.get("/:id/expenses", asyncHandler(expense.list)); // [REVISI] 18.8
seasonRoutes.post("/:id/expenses", asyncHandler(expense.create)); // [REVISI] 18.8
seasonRoutes.delete("/:id/expenses/:expenseId", asyncHandler(expense.remove)); // [REVISI] 18.8
seasonRoutes.post("/:id/close", asyncHandler(season.close));
seasonRoutes.post("/:id/predict-cost", asyncHandler(season.predict));
seasonRoutes.post("/:id/stop-financing", asyncHandler(season.stop)); // [REVISI] 18.5
seasonRoutes.post("/:id/start-planting", asyncHandler(season.plant)); // [REVISI] 18.7
seasonRoutes.post("/:id/recalc-cost", asyncHandler(season.recalc)); // [REVISI] 18.6
seasonRoutes.post("/:id/start-financing", asyncHandler(season.start));