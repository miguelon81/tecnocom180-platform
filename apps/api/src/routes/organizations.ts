import { Router } from "express";
import { prisma } from "../lib/prisma";

const organizationsRouter = Router();

// GET /organizations
organizationsRouter.get("/", async (_req, res) => {
  try {
    const organizations = await prisma.organization.findMany();

    res.json(organizations);
  } catch (error) {
    console.error("Error fetching organizations:", error);
    res.status(500).json({ error: "Failed to fetch organizations" });
  }
});

// POST /organizations
organizationsRouter.post("/", async (req, res) => {
  try {
    const { name, slug, phone, email, timezone } = req.body;

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
    });

    res.status(201).json(organization);
  } catch (error) {
    console.error("Error creating organization:", error);
    res.status(500).json({ error: "Failed to create organization" });
  }
});

export { organizationsRouter };