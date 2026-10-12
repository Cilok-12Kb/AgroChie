import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { requireUser, optionalUser } from "../middleware/auth.js";
import { loginRateLimit, guestRateLimit } from "../middleware/rate-limit.js";
import * as auth from "../controllers/auth.controller.js";
export const authRoutes = Router();
authRoutes.post("/register", asyncHandler(auth.register));
// [REVISI] bagian 17.4: login, me, logout
authRoutes.post("/login", loginRateLimit(), asyncHandler(auth.login)); // [REVISI] 17.5: batas per IP
authRoutes.get("/me", requireUser, asyncHandler(auth.me));
authRoutes.post("/logout", optionalUser, asyncHandler(auth.logout)); // [REVISI] 17.6: kenali tamu
authRoutes.post("/guest", guestRateLimit(), asyncHandler(auth.guest)); // 17.6: 20 per jam per IP