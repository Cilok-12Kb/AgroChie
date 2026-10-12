import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { requireUser } from "../middleware/auth.js";
import { loginRateLimit } from "../middleware/rate-limit.js";
import * as auth from "../controllers/auth.controller.js";
export const authRoutes = Router();
authRoutes.post("/register", asyncHandler(auth.register));
// [REVISI] bagian 17.4: login, me, logout
authRoutes.post("/login", loginRateLimit(), asyncHandler(auth.login)); // [REVISI] 17.5: batas per IP
authRoutes.get("/me", requireUser, asyncHandler(auth.me));
authRoutes.post("/logout", asyncHandler(auth.logout));