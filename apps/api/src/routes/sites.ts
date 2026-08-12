import { Router } from "express";
import { prisma } from "../lib/prisma";

const sitesRouter = Router();

// GET /sites
sitesRouter.get("/", async (_req, res) => {
  try {
    const sites = await prisma.site.findMany({
      include: {
        organization: true,
        areas: true,
        rooms: true,
        devices: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    res.json(sites);
  } catch (error) {
    console.error("Error fetching sites:", error);
    res.status(500).json({ error: "Failed to fetch sites" });
  }
});

// GET /sites/:id
sitesRouter.get("/:id", async (req, res) => {
  try {
    const site = await prisma.site.findUnique({
      where: {
        id: req.params.id,
      },
      include: {
        organization: true,
        areas: true,
        rooms: true,
        devices: true,
      },
    });

    if (!site) {
      return res.status(404).json({
        error: "Site not found",
      });
    }

    res.json(site);
  } catch (error) {
    console.error("Error fetching site:", error);
    res.status(500).json({ error: "Failed to fetch site" });
  }
});

// POST /sites
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
      active,
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
        ...(active !== undefined && { active }),
      },
      include: {
        organization: true,
      },
    });

    res.status(201).json(site);
  } catch (error) {
    console.error("Error creating site:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        error: "A site with this code already exists",
      });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2003"
    ) {
      return res.status(404).json({
        error: "Organization not found",
      });
    }

    res.status(500).json({ error: "Failed to create site" });
  }
});

// PATCH /sites/:id
sitesRouter.patch("/:id", async (req, res) => {
  try {
    const {
      organizationId,
      name,
      code,
      address,
      city,
      state,
      country,
      active,
    } = req.body;

    const site = await prisma.site.update({
      where: {
        id: req.params.id,
      },
      data: {
        ...(organizationId !== undefined && { organizationId }),
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(address !== undefined && { address }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
        ...(country !== undefined && { country }),
        ...(active !== undefined && { active }),
      },
      include: {
        organization: true,
        areas: true,
        rooms: true,
        devices: true,
      },
    });

    res.json(site);
  } catch (error) {
    console.error("Error updating site:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        error: "A site with this code already exists",
      });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return res.status(404).json({
        error: "Site not found",
      });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2003"
    ) {
      return res.status(404).json({
        error: "Organization not found",
      });
    }

    res.status(500).json({ error: "Failed to update site" });
  }
});

// DELETE /sites/:id
sitesRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.site.delete({
      where: {
        id: req.params.id,
      },
    });

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting site:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return res.status(404).json({
        error: "Site not found",
      });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2003"
    ) {
      return res.status(409).json({
        error: "Site cannot be deleted because it has related records",
      });
    }

    res.status(500).json({ error: "Failed to delete site" });
  }
});

export { sitesRouter };