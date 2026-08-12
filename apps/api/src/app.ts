import express from "express";
import { healthRouter } from "./routes/health";
import { devicesRouter } from "./routes/devices";
import { organizationsRouter } from "./routes/organizations";
import { sitesRouter } from "./routes/sites";
import { brandsRouter } from "./routes/brands";
import { modelsRouter } from "./routes/models";
import { areasRouter } from "./routes/areas";
import { ticketsRouter } from "./routes/tickets";
import { roomsRouter } from "./routes/rooms";

const app = express();

app.use(express.json());

app.use("/health", healthRouter);
app.use("/devices", devicesRouter);
app.use("/organizations", organizationsRouter);
app.use("/sites", sitesRouter);
app.use("/brands", brandsRouter);
app.use("/models", modelsRouter);
app.use("/areas", areasRouter);
app.use("/tickets", ticketsRouter);
app.use("/rooms", roomsRouter);
export { app };