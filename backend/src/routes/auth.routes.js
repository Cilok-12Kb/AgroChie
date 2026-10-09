import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import * as auth from "../controllers/auth.controller.js";
export const authRoutes = Router();
authRoutes.post("/register", asyncHandler(auth.register));