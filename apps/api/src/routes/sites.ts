import { Router } from "express";
import { prisma } from "../lib/prisma";

const sitesRouter = Router();

sitesRouter.get("/", async (_req, res) => {
  try {
    const sites = await prisma.site.findMany({
      include: {
        organization: true,
      },
    });

    res.json(sites);
  } catch (error) {
    console.error("Error fetching sites:", error);
    res.status(500).json({ error: "Failed to fetch sites" });
  }
});

sitesRouter.post("/", async (req, res) => {
  try {
    const {
      organizationId,
      name,
      code,
      address,
      city,
      state,
      country,
    } = req.body;

    if (!organizationId || !name || !code) {
      return res.status(400).json({
        error: "organizationId, name and code are required",
      });
    }

    const site = await prisma.site.create({
      data: {
        organizationId,
        name,
        code,
        address,
        city,
        state,
        country,
      },
    });

    res.status(201).json(site);
  } catch (error) {
    console.error("Error creating site:", error);
    res.status(500).json({ error: "Failed to create site" });
  }
});

export { sitesRouter };