import { Router } from "express";
import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../utils/async-handler.js";
import { authRoutes } from "./auth.routes.js";
import { farmRoutes } from "./farm.routes.js";
import { seasonRoutes } from "./season.routes.js";
import { cropRoutes } from "./crop.routes.js";
import { assistantRoutes } from "./assistant.routes.js";
import { historyRoutes } from "./history.routes.js";
import { weatherRoutes } from "./weather.routes.js";
import { extendedSeasonRoutes } from "./extended-season.routes.js";

export const routes = Router();

routes.get("/health", asyncHandler(async (_req, res) => {
  const [{ now }] = await prisma.$queryRaw`SELECT now() AS now`;
  res.json({ ok: true, dbTime: now, users: await prisma.user.count() });
}));

routes.use("/auth", authRoutes);
routes.use("/farms", farmRoutes);
routes.use("/seasons", seasonRoutes);
routes.use("/crops", cropRoutes);
routes.use("/assistant", assistantRoutes);
routes.use("/history", historyRoutes);
routes.use("/weather", weatherRoutes);
routes.use("/seasons", extendedSeasonRoutes);