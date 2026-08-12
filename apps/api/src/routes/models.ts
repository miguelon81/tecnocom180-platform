import { Router } from "express";
import { prisma } from "../lib/prisma";

const modelsRouter = Router();

// GET /models
modelsRouter.get("/", async (_req, res) => {
  try {
    const models = await prisma.deviceModel.findMany({
      include: {
        brand: true,
        devices: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    res.json(models);
  } catch (error) {
    console.error("Error fetching models:", error);
    res.status(500).json({ error: "Failed to fetch models" });
  }
});

// GET /models/:id
modelsRouter.get("/:id", async (req, res) => {
  try {
    const model = await prisma.deviceModel.findUnique({
      where: {
        id: req.params.id,
      },
      include: {
        brand: true,
        devices: true,
      },
    });

    if (!model) {
      return res.status(404).json({
        error: "Model not found",
      });
    }

    res.json(model);
  } catch (error) {
    console.error("Error fetching model:", error);
    res.status(500).json({ error: "Failed to fetch model" });
  }
});

// POST /models
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
      include: {
        brand: true,
      },
    });

    res.status(201).json(model);
  } catch (error) {
    console.error("Error creating model:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return res.status(404).json({
        error: "Brand not found",
      });
    }

    res.status(500).json({
      error: "Failed to create model",
    });
  }
});

// PATCH /models/:id
modelsRouter.patch("/:id", async (req, res) => {
  try {
    const { brandId, name, type } = req.body;

    if (
      brandId === undefined &&
      name === undefined &&
      type === undefined
    ) {
      return res.status(400).json({
        error: "At least one field is required",
      });
    }

    const model = await prisma.deviceModel.update({
      where: {
        id: req.params.id,
      },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(brandId !== undefined && {
          brand: {
            connect: {
              id: brandId,
            },
          },
        }),
      },
      include: {
        brand: true,
        devices: true,
      },
    });

    res.json(model);
  } catch (error) {
    console.error("Error updating model:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return res.status(404).json({
        error: "Model or brand not found",
      });
    }

    res.status(500).json({
      error: "Failed to update model",
    });
  }
});

// DELETE /models/:id
modelsRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.deviceModel.delete({
      where: {
        id: req.params.id,
      },
    });

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting model:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return res.status(404).json({
        error: "Model not found",
      });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2003"
    ) {
      return res.status(409).json({
        error: "Model cannot be deleted because it has related devices",
      });
    }

    res.status(500).json({
      error: "Failed to delete model",
    });
  }
});

export { modelsRouter };