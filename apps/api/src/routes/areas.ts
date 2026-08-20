import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  authenticateToken,
  requireRole,
  AuthenticatedRequest,
} from "../middleware/auth";

const areasRouter = Router();

const areaInclude = {
  site: true,
  devices: true,
  rooms: true,
};

function canAccessOrganization(
  req: AuthenticatedRequest,
  organizationId: string,
) {
  if (!req.user) {
    return false;
  }

  if (req.user.role === "SUPER_ADMIN") {
    return true;
  }

  return req.user.organizationId === organizationId;
}

// GET /areas
// GET /areas?siteId=xxx
areasRouter.get(
  "/",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "RECEPTION",
    "TECHNICIAN",
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const siteId =
        typeof req.query.siteId === "string"
          ? req.query.siteId
          : undefined;

      let organizationId: string | undefined;

      if (siteId) {
        const site = await prisma.site.findUnique({
          where: {
            id: siteId,
          },
          select: {
            organizationId: true,
          },
        });

        if (!site) {
          return res.status(404).json({
            error: "Site not found",
          });
        }

        if (!canAccessOrganization(req, site.organizationId)) {
          return res.status(403).json({
            error: "Access denied for this organization",
          });
        }

        organizationId = site.organizationId;
      } else if (req.user!.role !== "SUPER_ADMIN") {
        organizationId = req.user!.organizationId;
      }

      const areas = await prisma.area.findMany({
        where: siteId
          ? {
              siteId,
            }
          : organizationId
            ? {
                site: {
                  organizationId,
                },
              }
            : undefined,
        include: areaInclude,
        orderBy: {
          name: "asc",
        },
      });

      res.json(areas);
    } catch (error) {
      console.error("Error fetching areas:", error);

      res.status(500).json({
        error: "Failed to fetch areas",
      });
    }
  },
);

// GET /areas/:id
areasRouter.get(
  "/:id",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "RECEPTION",
    "TECHNICIAN",
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const areaId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;

      const area = await prisma.area.findUnique({
        where: {
          id: areaId,
        },
        include: areaInclude,
      });

      if (!area) {
        return res.status(404).json({
          error: "Area not found",
        });
      }

      if (!canAccessOrganization(req, area.site.organizationId)) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      res.json(area);
    } catch (error) {
      console.error("Error fetching area:", error);

      res.status(500).json({
        error: "Failed to fetch area",
      });
    }
  },
);

// POST /areas
areasRouter.post(
  "/",
  authenticateToken,
  requireRole("SUPER_ADMIN", "ORG_ADMIN"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const {
        siteId,
        name,
        type,
      } = req.body;

      if (!siteId || !name) {
        return res.status(400).json({
          error: "siteId and name are required",
        });
      }

      const site = await prisma.site.findUnique({
        where: {
          id: siteId,
        },
        select: {
          id: true,
          organizationId: true,
        },
      });

      if (!site) {
        return res.status(404).json({
          error: "Site not found",
        });
      }

      if (!canAccessOrganization(req, site.organizationId)) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      const area = await prisma.area.create({
        data: {
          siteId,
          name,
          ...(type !== undefined && { type }),
        },
        include: areaInclude,
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
          error:
            "An area with this name already exists in this site",
        });
      }

      res.status(500).json({
        error: "Failed to create area",
      });
    }
  },
);

// PATCH /areas/:id
areasRouter.patch(
  "/:id",
  authenticateToken,
  requireRole("SUPER_ADMIN", "ORG_ADMIN"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const areaId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;

      const {
        siteId,
        name,
        type,
      } = req.body;

      const existingArea = await prisma.area.findUnique({
        where: {
          id: areaId,
        },
        select: {
          id: true,
          siteId: true,
          site: {
            select: {
              organizationId: true,
            },
          },
        },
      });

      if (!existingArea) {
        return res.status(404).json({
          error: "Area not found",
        });
      }

      if (
        !canAccessOrganization(
          req,
          existingArea.site.organizationId,
        )
      ) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      // Si se cambia el Site, primero verificamos que exista.
      if (
        siteId !== undefined &&
        siteId !== existingArea.siteId
      ) {
        const targetSite = await prisma.site.findUnique({
          where: {
            id: siteId,
          },
          select: {
            id: true,
            organizationId: true,
          },
        });

        if (!targetSite) {
          return res.status(404).json({
            error: "Target site not found",
          });
        }

        // Solo SUPER_ADMIN puede mover un Area
        // entre organizaciones.
        if (
          targetSite.organizationId !==
            existingArea.site.organizationId &&
          req.user!.role !== "SUPER_ADMIN"
        ) {
          return res.status(403).json({
            error:
              "Only SUPER_ADMIN can move an area between organizations",
          });
        }

        if (
          !canAccessOrganization(
            req,
            targetSite.organizationId,
          )
        ) {
          return res.status(403).json({
            error: "Access denied for target organization",
          });
        }
      }

      const area = await prisma.area.update({
        where: {
          id: areaId,
        },
        data: {
          ...(siteId !== undefined && { siteId }),
          ...(name !== undefined && { name }),
          ...(type !== undefined && { type }),
        },
        include: areaInclude,
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
          error:
            "An area with this name already exists in this site",
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

      res.status(500).json({
        error: "Failed to update area",
      });
    }
  },
);

// DELETE /areas/:id
areasRouter.delete(
  "/:id",
  authenticateToken,
  requireRole("SUPER_ADMIN", "ORG_ADMIN"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const areaId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;

      const existingArea = await prisma.area.findUnique({
        where: {
          id: areaId,
        },
        select: {
          id: true,
          site: {
            select: {
              organizationId: true,
            },
          },
        },
      });

      if (!existingArea) {
        return res.status(404).json({
          error: "Area not found",
        });
      }

      if (
        !canAccessOrganization(
          req,
          existingArea.site.organizationId,
        )
      ) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      await prisma.area.delete({
        where: {
          id: areaId,
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
          error:
            "Area cannot be deleted because it has related records",
        });
      }

      res.status(500).json({
        error: "Failed to delete area",
      });
    }
  },
);

export { areasRouter };