import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  authenticateToken,
  requireRole,
  AuthenticatedRequest,
} from "../middleware/auth";

const modelsRouter = Router();

// Los valores deben coincidir con el enum DeviceType de Prisma.
const validDeviceTypes = [
  "ROUTER",
  "SWITCH",
  "ACCESS_POINT",
  "CAMERA",
  "NVR",
  "UPS",
  "MODEM",
  "SERVER",
  "NAS",
  "IOT",
  "OTHER",
] as const;

type DeviceTypeValue =
  (typeof validDeviceTypes)[number];

function isValidDeviceType(
  value: unknown,
): value is DeviceTypeValue {
  return (
    typeof value === "string" &&
    validDeviceTypes.includes(
      value as DeviceTypeValue,
    )
  );
}

function getModelId(req: AuthenticatedRequest) {
  return Array.isArray(req.params.id)
    ? req.params.id[0]
    : req.params.id;
}

// GET /models
modelsRouter.get(
  "/",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "RECEPTION",
    "TECHNICIAN",
  ),
  async (_req: AuthenticatedRequest, res) => {
    try {
      const models =
        await prisma.deviceModel.findMany({
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
      console.error(
        "Error fetching models:",
        error,
      );

      res.status(500).json({
        error: "Failed to fetch models",
      });
    }
  },
);

// GET /models/:id
modelsRouter.get(
  "/:id",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "RECEPTION",
    "TECHNICIAN",
  ),
  async (
    req: AuthenticatedRequest,
    res,
  ) => {
    try {
      const modelId = getModelId(req);

      const model =
        await prisma.deviceModel.findUnique({
          where: {
            id: modelId,
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
      console.error(
        "Error fetching model:",
        error,
      );

      res.status(500).json({
        error: "Failed to fetch model",
      });
    }
  },
);

// POST /models
modelsRouter.post(
  "/",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
  ),
  async (
    req: AuthenticatedRequest,
    res,
  ) => {
    try {
      const {
        brandId,
        name,
        type,
      } = req.body;

      if (!brandId || !name || !type) {
        return res.status(400).json({
          error:
            "brandId, name and type are required",
        });
      }

      if (
        typeof name !== "string" ||
        !name.trim()
      ) {
        return res.status(400).json({
          error:
            "name must be a non-empty string",
        });
      }

      if (!isValidDeviceType(type)) {
        return res.status(400).json({
          error: "Invalid device type",
          validDeviceTypes,
        });
      }

      const brand =
        await prisma.brand.findUnique({
          where: {
            id: brandId,
          },
          select: {
            id: true,
          },
        });

      if (!brand) {
        return res.status(404).json({
          error: "Brand not found",
        });
      }

      const model =
        await prisma.deviceModel.create({
          data: {
            brandId,
            name: name.trim(),
            type,
          },
          include: {
            brand: true,
            devices: true,
          },
        });

      res.status(201).json(model);
    } catch (error) {
      console.error(
        "Error creating model:",
        error,
      );

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2003"
      ) {
        return res.status(404).json({
          error: "Brand not found",
        });
      }

      res.status(500).json({
        error: "Failed to create model",
      });
    }
  },
);

// PATCH /models/:id
modelsRouter.patch(
  "/:id",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
  ),
  async (
    req: AuthenticatedRequest,
    res,
  ) => {
    try {
      const modelId = getModelId(req);

      const {
        brandId,
        name,
        type,
      } = req.body;

      if (
        brandId === undefined &&
        name === undefined &&
        type === undefined
      ) {
        return res.status(400).json({
          error:
            "At least one field is required",
        });
      }

      if (
        name !== undefined &&
        (
          typeof name !== "string" ||
          !name.trim()
        )
      ) {
        return res.status(400).json({
          error:
            "name must be a non-empty string",
        });
      }

      if (
        type !== undefined &&
        !isValidDeviceType(type)
      ) {
        return res.status(400).json({
          error: "Invalid device type",
          validDeviceTypes,
        });
      }

      if (brandId !== undefined) {
        const brand =
          await prisma.brand.findUnique({
            where: {
              id: brandId,
            },
            select: {
              id: true,
            },
          });

        if (!brand) {
          return res.status(404).json({
            error: "Brand not found",
          });
        }
      }

      const model =
        await prisma.deviceModel.update({
          where: {
            id: modelId,
          },
          data: {
            ...(name !== undefined && {
              name: name.trim(),
            }),
            ...(type !== undefined && {
              type,
            }),
            ...(brandId !== undefined && {
              brandId,
            }),
          },
          include: {
            brand: true,
            devices: true,
          },
        });

      res.json(model);
    } catch (error) {
      console.error(
        "Error updating model:",
        error,
      );

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
        return res.status(404).json({
          error: "Brand not found",
        });
      }

      res.status(500).json({
        error: "Failed to update model",
      });
    }
  },
);

// DELETE /models/:id
modelsRouter.delete(
  "/:id",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
  ),
  async (
    req: AuthenticatedRequest,
    res,
  ) => {
    try {
      const modelId = getModelId(req);

      await prisma.deviceModel.delete({
        where: {
          id: modelId,
        },
      });

      res.status(204).send();
    } catch (error) {
      console.error(
        "Error deleting model:",
        error,
      );

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
          error:
            "Model cannot be deleted because it has related devices",
        });
      }

      res.status(500).json({
        error: "Failed to delete model",
      });
    }
  },
);

export { modelsRouter };