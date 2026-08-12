import { Router } from "express";
import { prisma } from "../lib/prisma";

const modelsRouter = Router();

modelsRouter.get("/", async (_req, res) => {
  try {
    const models = await prisma.deviceModel.findMany({
      include: {
        brand: true,
      },
    });

    res.json(models);
  } catch (error) {
    console.error("Error fetching models:", error);
    res.status(500).json({ error: "Failed to fetch models" });
  }
});

modelsRouter.post("/", async (req, res) => {
  try {
    const { brandId, name, type } = req.body;

    if (!brandId || !name || !type) {
      return res.status(400).json({
        error: "brandId, name and type are required",
      });
    }

    const model = await prisma.deviceModel.create({
      data: {
        name,
        type,
        brand: {
          connect: {
            id: brandId,
          },
        },
      },
    });

    res.status(201).json(model);
  } catch (error) {
    console.error("Error creating model:", error);
    res.status(500).json({ error: "Failed to create model" });
  }
});

export { modelsRouter };