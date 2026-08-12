import { Router } from "express";
import { prisma } from "../lib/prisma";

const devicesRouter = Router();

// GET /devices
devicesRouter.get("/", async (_req, res) => {
  try {
    const devices = await prisma.device.findMany({
      include: {
        model: {
          include: {
            brand: true,
          },
        },
      },
    });

    res.json(devices);
  } catch (error) {
    console.error("Error fetching devices:", error);
    res.status(500).json({ error: "Failed to fetch devices" });
  }
});

// POST /devices
devicesRouter.post("/", async (req, res) => {
  try {
    const {
      siteId,
      areaId,
      modelId,
      hostname,
      serial,
      ip,
      mac,
      firmware,
    } = req.body;

    if (!siteId || !modelId) {
      return res.status(400).json({
        error: "siteId and modelId are required",
      });
    }

    const device = await prisma.device.create({
      data: {
        siteId,
        areaId,
        modelId,
        hostname,
        serial,
        ip,
        mac,
        firmware,
      },
      include: {
        model: {
          include: {
            brand: true,
          },
        },
      },
    });

    res.status(201).json(device);
  } catch (error) {
    console.error("Error creating device:", error);
    res.status(500).json({ error: "Failed to create device" });
  }
});

export { devicesRouter };