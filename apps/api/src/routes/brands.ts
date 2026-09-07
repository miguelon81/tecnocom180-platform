import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  authenticateToken,
  requireRole,
  AuthenticatedRequest,
} from "../middleware/auth";

const brandsRouter = Router();

function getBrandId(req: AuthenticatedRequest) {
  return Array.isArray(req.params.id)
    ? req.params.id[0]
    : req.params.id;
}

// ============================================================
// GET /brands
// Catálogo global: todos los roles operativos pueden leerlo.
// ============================================================

brandsRouter.get(
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
      const brands = await prisma.brand.findMany({
        include: {
          models: true,
        },
        orderBy: {
          name: "asc",
        },
      });

      return res.json(brands);
    } catch (error) {
      console.error("Error fetching brands:", error);

      return res.status(500).json({
        error: "Failed to fetch brands",
      });
    }
  },
);

// ============================================================
// GET /brands/:id
// ============================================================

brandsRouter.get(
  "/:id",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "OPERATIONS",
    "ORG_ADMIN",
    "RECEPTION",
    "TECHNICIAN",
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const brandId = getBrandId(req);

      const brand = await prisma.brand.findUnique({
        where: {
          id: brandId,
        },
        include: {
          models: {
            include: {
              devices: true,
            },
          },
        },
      });

      if (!brand) {
        return res.status(404).json({
          error: "Brand not found",
        });
      }

      return res.json(brand);
    } catch (error) {
      console.error("Error fetching brand:", error);

      return res.status(500).json({
        error: "Failed to fetch brand",
      });
    }
  },
);

// ============================================================
// POST /brands
// Catálogo global: solo roles globales pueden modificarlo.
// ============================================================

brandsRouter.post(
  "/",
  authenticateToken,
  requireRole("SUPER_ADMIN", "OPERATIONS"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { name } = req.body;

      if (
        !name ||
        typeof name !== "string" ||
        !name.trim()
      ) {
        return res.status(400).json({
          error: "name is required",
        });
      }

      const brand = await prisma.brand.create({
        data: {
          name: name.trim(),
        },
      });

      return res.status(201).json(brand);
    } catch (error) {
      console.error("Error creating brand:", error);

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return res.status(409).json({
          error: "A brand with this name already exists",
        });
      }

      return res.status(500).json({
        error: "Failed to create brand",
      });
    }
  },
);

// ============================================================
// PATCH /brands/:id
// ============================================================

brandsRouter.patch(
  "/:id",
  authenticateToken,
  requireRole("SUPER_ADMIN", "OPERATIONS"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const brandId = getBrandId(req);
      const { name } = req.body;

      if (
        !name ||
        typeof name !== "string" ||
        !name.trim()
      ) {
        return res.status(400).json({
          error: "name is required",
        });
      }

      const brand = await prisma.brand.update({
        where: {
          id: brandId,
        },
        data: {
          name: name.trim(),
        },
        include: {
          models: true,
        },
      });

      return res.json(brand);
    } catch (error) {
      console.error("Error updating brand:", error);

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return res.status(409).json({
          error: "A brand with this name already exists",
        });
      }

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

      return res.status(500).json({
        error: "Failed to update brand",
      });
    }
  },
);

// ============================================================
// DELETE /brands/:id
// ============================================================

brandsRouter.delete(
  "/:id",
  authenticateToken,
  requireRole("SUPER_ADMIN", "OPERATIONS"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const brandId = getBrandId(req);

      const brand = await prisma.brand.findUnique({
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

      await prisma.brand.delete({
        where: {
          id: brandId,
        },
      });

      return res.status(204).send();
    } catch (error) {
      console.error("Error deleting brand:", error);

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

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2003"
      ) {
        return res.status(409).json({
          error:
            "Brand cannot be deleted because it has related models",
        });
      }

      return res.status(500).json({
        error: "Failed to delete brand",
      });
    }
  },
);

export { brandsRouter };