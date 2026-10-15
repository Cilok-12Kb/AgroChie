import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { requireUser, optionalUser } from "../middleware/auth.js";
import { loginRateLimit, guestRateLimit, emailRateLimit, verifyEmailRateLimit } from "../middleware/rate-limit.js";
import * as auth from "../controllers/auth.controller.js";
export const authRoutes = Router();
authRoutes.post("/register", asyncHandler(auth.register));
// [REVISI] bagian 17.4: login, me, logout
authRoutes.post("/login", loginRateLimit(), asyncHandler(auth.login)); // [REVISI] 17.5: batas per IP
authRoutes.get("/me", requireUser, asyncHandler(auth.me));
authRoutes.post("/logout", optionalUser, asyncHandler(auth.logout)); // [REVISI] 17.6: kenali tamu
authRoutes.post("/guest", guestRateLimit(), asyncHandler(auth.guest)); // 17.6: 20 per jam per IP
// [REVISI] langkah 6: tambah dan verifikasi email (pembatas per IP)
authRoutes.post("/email", emailRateLimit(), requireUser, asyncHandler(auth.setEmailHandler));
authRoutes.post("/email/resend-verification", emailRateLimit(), requireUser, asyncHandler(auth.resendVerificationHandler));
authRoutes.post("/verify-email", verifyEmailRateLimit(), asyncHandler(auth.verifyEmailHandler));