import express from "express";
import { routes } from "./routes/index.js";
import { notFound, errorHandler } from "./middleware/error-handler.js";

import { env } from "./config/env.js";
import { applySecurity } from "./middleware/security.js";
import { createDevRoutes } from "./routes/dev.routes.js";

export const app = express();
applySecurity(app, env); // [REVISI] bagian 17.8: helmet, CORS, cookie-parser, trust proxy
app.use("/api/crops", express.json({ limit: "8mb" })); // hanya untuk foto daun
app.use(express.json());
app.use("/api", routes);
app.use("/dev", createDevRoutes(env)); // [REVISI] halaman uji development; 404 di production
app.use(notFound);
app.use(errorHandler);