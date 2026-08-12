import { Router } from "express";
import { prisma } from "../lib/prisma";

const areasRouter = Router();

// GET /areas
// GET /areas?siteId=xxx
areasRouter.get("/", async (req, res) => {
  try {
    const siteId = req.query.siteId as string | undefined;

    const areas = await prisma.area.findMany({
      where: siteId ? { siteId } : undefined,
      include: {
        site: true,
        devices: true,
        rooms: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    res.json(areas);
  } catch (error) {
    console.error("Error fetching areas:", error);
    res.status(500).json({ error: "Failed to fetch areas" });
  }
});

// GET /areas/:id
areasRouter.get("/:id", async (req, res) => {
  try {
    const area = await prisma.area.findUnique({
      where: {
        id: req.params.id,
      },
      include: {
        site: true,
        devices: true,
        rooms: true,
      },
    });

    if (!area) {
      return res.status(404).json({
        error: "Area not found",
      });
    }

    res.json(area);
  } catch (error) {
    console.error("Error fetching area:", error);
    res.status(500).json({ error: "Failed to fetch area" });
  }
});

// POST /areas
areasRouter.post("/", async (req, res) => {
  try {
    const { siteId, name, type } = req.body;

    if (!siteId || !name) {
      return res.status(400).json({
        error: "siteId and name are required",
      });
    }

    const area = await prisma.area.create({
      data: {
        siteId,
        name,
        ...(type !== undefined && { type }),
      },
      include: {
        site: true,
        devices: true,
        rooms: true,
      },
    });

    res.status(201).json(area);
  } catch (error) {
    console.error("Error creating area:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2003"
    ) {
      return res.status(404).json({
        error: "Site not found",
      });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        error: "An area with this name already exists in this site",
      });
    }

    res.status(500).json({ error: "Failed to create area" });
  }
});

// PATCH /areas/:id
areasRouter.patch("/:id", async (req, res) => {
  try {
    const { siteId, name, type } = req.body;

    const area = await prisma.area.update({
      where: {
        id: req.params.id,
      },
      data: {
        ...(siteId !== undefined && { siteId }),
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
      },
      include: {
        site: true,
        devices: true,
        rooms: true,
      },
    });

    res.json(area);
  } catch (error) {
    console.error("Error updating area:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return res.status(404).json({
        error: "Area not found",
      });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        error: "An area with this name already exists in this site",
      });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2003"
    ) {
      return res.status(404).json({
        error: "Site not found",
      });
    }

    res.status(500).json({ error: "Failed to update area" });
  }
});

// DELETE /areas/:id
areasRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.area.delete({
      where: {
        id: req.params.id,
      },
    });

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting area:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return res.status(404).json({
        error: "Area not found",
      });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2003"
    ) {
      return res.status(409).json({
        error: "Area cannot be deleted because it has related records",
      });
    }

    res.status(500).json({ error: "Failed to delete area" });
  }
});

export { areasRouter };