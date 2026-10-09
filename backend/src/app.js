import express from "express";
import { routes } from "./routes/index.js";
import { notFound, errorHandler } from "./middleware/error-handler.js";

export const app = express();
app.use(express.json());
app.use("/api", routes);
app.use(notFound);
app.use(errorHandler);