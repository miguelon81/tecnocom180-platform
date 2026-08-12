import { Router } from "express";
import { prisma } from "../lib/prisma";

const organizationsRouter = Router();

// GET /organizations
organizationsRouter.get("/", async (_req, res) => {
  try {
    const organizations = await prisma.organization.findMany({
      include: {
        sites: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    res.json(organizations);
  } catch (error) {
    console.error("Error fetching organizations:", error);
    res.status(500).json({
      error: "Failed to fetch organizations",
    });
  }
});

// GET /organizations/:id
organizationsRouter.get("/:id", async (req, res) => {
  try {
    const organization = await prisma.organization.findUnique({
      where: {
        id: req.params.id,
      },
      include: {
        sites: true,
      },
    });

    if (!organization) {
      return res.status(404).json({
        error: "Organization not found",
      });
    }

    res.json(organization);
  } catch (error) {
    console.error("Error fetching organization:", error);
    res.status(500).json({
      error: "Failed to fetch organization",
    });
  }
});

// POST /organizations
organizationsRouter.post("/", async (req, res) => {
  try {
    const {
      name,
      slug,
      phone,
      email,
      timezone,
    } = req.body;

    if (!name || !slug) {
      return res.status(400).json({
        error: "name and slug are required",
      });
    }

    const organization = await prisma.organization.create({
      data: {
        name,
        slug,
        phone,
        email,
        timezone,
      },
      include: {
        sites: true,
      },
    });

    res.status(201).json(organization);
  } catch (error) {
    console.error("Error creating organization:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        error: "An organization with this slug already exists",
      });
    }

    res.status(500).json({
      error: "Failed to create organization",
    });
  }
});

// PATCH /organizations/:id
organizationsRouter.patch("/:id", async (req, res) => {
  try {
    const {
      name,
      slug,
      phone,
      email,
      timezone,
      active,
    } = req.body;

    if (
      name === undefined &&
      slug === undefined &&
      phone === undefined &&
      email === undefined &&
      timezone === undefined &&
      active === undefined
    ) {
      return res.status(400).json({
        error: "At least one field is required",
      });
    }

    const organization = await prisma.organization.update({
      where: {
        id: req.params.id,
      },
      data: {
        ...(name !== undefined && { name }),
        ...(slug !== undefined && { slug }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(timezone !== undefined && { timezone }),
        ...(active !== undefined && { active }),
      },
      include: {
        sites: true,
      },
    });

    res.json(organization);
  } catch (error) {
    console.error("Error updating organization:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        error: "An organization with this slug already exists",
      });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return res.status(404).json({
        error: "Organization not found",
      });
    }

    res.status(500).json({
      error: "Failed to update organization",
    });
  }
});

// DELETE /organizations/:id
organizationsRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.organization.delete({
      where: {
        id: req.params.id,
      },
    });

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting organization:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return res.status(404).json({
        error: "Organization not found",
      });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2003"
    ) {
      return res.status(409).json({
        error: "Organization cannot be deleted because it has related records",
      });
    }

    res.status(500).json({
      error: "Failed to delete organization",
    });
  }
});

export { organizationsRouter };