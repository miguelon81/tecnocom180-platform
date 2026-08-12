import express from "express";
import { healthRouter } from "./routes/health";
import { devicesRouter } from "./routes/devices";

const app = express();

app.use(express.json());

app.use("/health", healthRouter);
app.use("/devices", devicesRouter);

export { app };