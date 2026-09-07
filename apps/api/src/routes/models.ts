import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  authenticateToken,
  requireRole,
  AuthenticatedRequest,
} from "../middleware/auth";

const modelsRouter = Router();

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

// ============================================================
// GET /models
// Catálogo global: todos los roles operativos pueden leerlo.
// ============================================================

modelsRouter.get(
  "/",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "OPERATIONS",
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
          orderBy: [
            {
              brand: {
                name: "asc",
              },
            },
            {
              name: "asc",
            },
          ],
        });

      return res.json(models);
    } catch (error) {
      console.error(
        "Error fetching models:",
        error,
      );

      return res.status(500).json({
        error: "Failed to fetch models",
      });
    }
  },
);

// ============================================================
// GET /models/:id
// ============================================================

modelsRouter.get(
  "/:id",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "OPERATIONS",
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

      return res.json(model);
    } catch (error) {
      console.error(
        "Error fetching model:",
        error,
      );

      return res.status(500).json({
        error: "Failed to fetch model",
      });
    }
  },
);

// ============================================================
// POST /models
// Catálogo global: solo roles globales pueden modificarlo.
// ============================================================

modelsRouter.post(
  "/",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "OPERATIONS",
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
        typeof brandId !== "string" ||
        !brandId.trim()
      ) {
        return res.status(400).json({
          error:
            "brandId must be a non-empty string",
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

      const normalizedBrandId =
        brandId.trim();

      const normalizedName =
        name.trim();

      const brand =
        await prisma.brand.findUnique({
          where: {
            id: normalizedBrandId,
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
            brandId: normalizedBrandId,
            name: normalizedName,
            type,
          },
          include: {
            brand: true,
            devices: true,
          },
        });

      return res.status(201).json(model);
    } catch (error) {
      console.error(
        "Error creating model:",
        error,
      );

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return res.status(409).json({
          error:
            "This model already exists for the selected brand",
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

      return res.status(500).json({
        error: "Failed to create model",
      });
    }
  },
);

// ============================================================
// PATCH /models/:id
// ============================================================

modelsRouter.patch(
  "/:id",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "OPERATIONS",
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
        brandId !== undefined &&
        (
          typeof brandId !== "string" ||
          !brandId.trim()
        )
      ) {
        return res.status(400).json({
          error:
            "brandId must be a non-empty string",
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

      const normalizedBrandId =
        typeof brandId === "string"
          ? brandId.trim()
          : undefined;

      if (normalizedBrandId !== undefined) {
        const brand =
          await prisma.brand.findUnique({
            where: {
              id: normalizedBrandId,
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

            ...(normalizedBrandId !== undefined && {
              brandId: normalizedBrandId,
            }),
          },
          include: {
            brand: true,
            devices: true,
          },
        });

      return res.json(model);
    } catch (error) {
      console.error(
        "Error updating model:",
        error,
      );

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return res.status(409).json({
          error:
            "This model already exists for the selected brand",
        });
      }

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

      return res.status(500).json({
        error: "Failed to update model",
      });
    }
  },
);

// ============================================================
// DELETE /models/:id
// ============================================================

modelsRouter.delete(
  "/:id",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "OPERATIONS",
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

      return res.status(204).send();
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

      return res.status(500).json({
        error: "Failed to delete model",
      });
    }
  },
);

export { modelsRouter };