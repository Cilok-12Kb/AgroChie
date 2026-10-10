import express from "express";
import { routes } from "./routes/index.js";
import { notFound, errorHandler } from "./middleware/error-handler.js";

export const app = express();
app.use("/api/crops", express.json({ limit: "8mb" })); // hanya untuk foto daun
app.use(express.json());
app.use("/api", routes);
app.use(notFound);
app.use(errorHandler);