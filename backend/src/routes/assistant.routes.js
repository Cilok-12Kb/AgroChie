import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { requireUser } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";
import * as assistant from "../controllers/assistant.controller.js";

export const assistantRoutes = Router();
assistantRoutes.use(requireUser);
assistantRoutes.post("/chat", rateLimit({ windowMs: 10 * 60_000, max: 20 }), asyncHandler(assistant.chat));
assistantRoutes.get("/sessions/:id", asyncHandler(assistant.session));