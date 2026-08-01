import { Router } from "express";

const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "tecnocom180-api"
  });
});

export { healthRouter };