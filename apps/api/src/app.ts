import express from "express";
import { healthRouter } from "./routes/health";
import { devicesRouter } from "./routes/devices";
import { organizationsRouter } from "./routes/organizations";
import { sitesRouter } from "./routes/sites";
import { brandsRouter } from "./routes/brands";
import { modelsRouter } from "./routes/models";

const app = express();

app.use(express.json());

app.use("/health", healthRouter);
app.use("/devices", devicesRouter);
app.use("/organizations", organizationsRouter);
app.use("/sites", sitesRouter);
app.use("/brands", brandsRouter);
app.use("/models", modelsRouter);
export { app };