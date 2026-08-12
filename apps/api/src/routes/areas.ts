import { Router } from "express";
import { prisma } from "../lib/prisma";

const areasRouter = Router();

areasRouter.get("/", async (req, res) => {
  try {
    const areas = await prisma.area.findMany({
      where: {
        siteId: req.query.siteId as string | undefined,
      },
      include: {
        site: true,
        devices: true,
      },
    });

    res.json(areas);
  } catch (error) {
    console.error("Error fetching areas:", error);
    res.status(500).json({ error: "Failed to fetch areas" });
  }
});

areasRouter.post("/", async (req, res) => {
  try {
    const { siteId, name } = req.body;

    if (!siteId || !name) {
      return res.status(400).json({
        error: "siteId and name are required",
      });
    }

    const area = await prisma.area.create({
      data: {
        siteId,
        name,
      },
    });

    res.status(201).json(area);
  } catch (error) {
    console.error("Error creating area:", error);
    res.status(500).json({ error: "Failed to create area" });
  }
});

export { areasRouter };
