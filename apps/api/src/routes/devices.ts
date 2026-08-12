import { Router } from "express";
import { prisma } from "../lib/prisma";

const devicesRouter = Router();

devicesRouter.get("/", async (_req, res) => {
  try {
    const devices = await prisma.device.findMany({
      include: {
        model: {
          include: {
            brand: true,
          },
        },
        site: true,
        area: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(devices);
  } catch (error) {
    console.error("Error fetching devices:", error);

    res.status(500).json({
      error: "Failed to fetch devices",
    });
  }
});

export { devicesRouter };