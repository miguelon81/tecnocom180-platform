import { Router } from "express";
import { prisma } from "../lib/prisma";

const devicesRouter = Router();

// GET /devices
// GET /devices?siteId=xxx
// GET /devices?areaId=xxx
// GET /devices?modelId=xxx
devicesRouter.get("/", async (req, res) => {
  try {
    const siteId = req.query.siteId as string | undefined;
    const areaId = req.query.areaId as string | undefined;
    const modelId = req.query.modelId as string | undefined;

    const devices = await prisma.device.findMany({
      where: {
        ...(siteId && { siteId }),
        ...(areaId && { areaId }),
        ...(modelId && { modelId }),
      },
      include: {
        site: true,
        area: true,
        model: {
          include: {
            brand: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(devices);
  } catch (error) {
    console.error("Error fetching devices:", error);
    res.status(500).json({ error: "Failed to fetch devices" });
  }
});

// GET /devices/:id
devicesRouter.get("/:id", async (req, res) => {
  try {
    const device = await prisma.device.findUnique({
      where: {
        id: req.params.id,
      },
      include: {
        site: true,
        area: true,
        model: {
          include: {
            brand: true,
          },
        },
        tickets: true,
      },
    });

    if (!device) {
      return res.status(404).json({
        error: "Device not found",
      });
    }

    res.json(device);
  } catch (error) {
    console.error("Error fetching device:", error);
    res.status(500).json({ error: "Failed to fetch device" });
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
      online,
      installedAt,
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
        ...(online !== undefined && { online }),
        ...(installedAt !== undefined && { installedAt }),
      },
      include: {
        site: true,
        area: true,
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

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2003"
    ) {
      return res.status(400).json({
        error: "Invalid site, area or model",
      });
    }

    res.status(500).json({ error: "Failed to create device" });
  }
});

// PATCH /devices/:id
devicesRouter.patch("/:id", async (req, res) => {
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
      online,
      installedAt,
    } = req.body;

    const device = await prisma.device.update({
      where: {
        id: req.params.id,
      },
      data: {
        ...(siteId !== undefined && { siteId }),
        ...(areaId !== undefined && { areaId }),
        ...(modelId !== undefined && { modelId }),
        ...(hostname !== undefined && { hostname }),
        ...(serial !== undefined && { serial }),
        ...(ip !== undefined && { ip }),
        ...(mac !== undefined && { mac }),
        ...(firmware !== undefined && { firmware }),
        ...(online !== undefined && { online }),
        ...(installedAt !== undefined && { installedAt }),
      },
      include: {
        site: true,
        area: true,
        model: {
          include: {
            brand: true,
          },
        },
        tickets: true,
      },
    });

    res.json(device);
  } catch (error) {
    console.error("Error updating device:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return res.status(404).json({
        error: "Device not found",
      });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2003"
    ) {
      return res.status(400).json({
        error: "Invalid site, area or model",
      });
    }

    res.status(500).json({ error: "Failed to update device" });
  }
});

// DELETE /devices/:id
devicesRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.device.delete({
      where: {
        id: req.params.id,
      },
    });

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting device:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return res.status(404).json({
        error: "Device not found",
      });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2003"
    ) {
      return res.status(409).json({
        error: "Device cannot be deleted because it has related records",
      });
    }

    res.status(500).json({ error: "Failed to delete device" });
  }
});

export { devicesRouter };