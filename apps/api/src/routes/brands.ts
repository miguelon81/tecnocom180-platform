import { Router } from "express";
import { prisma } from "../lib/prisma";

const brandsRouter = Router();

brandsRouter.get("/", async (_req, res) => {
  try {
    const brands = await prisma.brand.findMany({
      include: {
        models: true,
      },
    });

    res.json(brands);
  } catch (error) {
    console.error("Error fetching brands:", error);
    res.status(500).json({ error: "Failed to fetch brands" });
  }
});

brandsRouter.post("/", async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        error: "name is required",
      });
    }

    const brand = await prisma.brand.create({
      data: { name },
    });

    res.status(201).json(brand);
  } catch (error) {
    console.error("Error creating brand:", error);
    res.status(500).json({ error: "Failed to create brand" });
  }
});

export { brandsRouter };