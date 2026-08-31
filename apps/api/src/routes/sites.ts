import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  authenticateToken,
  requireRole,
  AuthenticatedRequest,
} from "../middleware/auth";

const sitesRouter = Router();

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


const siteInclude = {
  organization: true,
  areas: true,
  rooms: true,
  devices: {
    include: {
      model: {
        include: {
          brand: true,
        },
      },
    },
  },
};

// GET /sites
sitesRouter.get(
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
      const where =
        req.user!.role === "SUPER_ADMIN"
          ? {}
          : {
              organizationId: req.user!.organizationId,
            };

      const sites = await prisma.site.findMany({
        where,
        include: siteInclude,
        orderBy: {
          name: "asc",
        },
      });

      res.json(sites);
    } catch (error) {
      console.error("Error fetching sites:", error);

      res.status(500).json({
        error: "Failed to fetch sites",
      });
    }
  },
);

// GET /sites/:id
sitesRouter.get(
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
      const siteId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;

      const site = await prisma.site.findUnique({
        where: {
          id: siteId,
        },
        include: siteInclude,
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

      res.json(site);
    } catch (error) {
      console.error("Error fetching site:", error);

      res.status(500).json({
        error: "Failed to fetch site",
      });
    }
  },
);

// POST /sites
sitesRouter.post(
  "/",
  authenticateToken,
  requireRole("SUPER_ADMIN", "ORG_ADMIN"),
  async (req: AuthenticatedRequest, res) => {
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

      if (!name || !code) {
        return res.status(400).json({
          error: "name and code are required",
        });
      }

      // SUPER_ADMIN puede elegir la organización.
      // ORG_ADMIN siempre queda limitado a su propia organización.
      const targetOrganizationId =
        req.user!.role === "SUPER_ADMIN"
          ? organizationId
          : req.user!.organizationId;

      if (!targetOrganizationId) {
        return res.status(400).json({
          error: "organizationId is required",
        });
      }

      if (
        !canAccessOrganization(
          req,
          targetOrganizationId,
        )
      ) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      const site = await prisma.site.create({
        data: {
          organizationId: targetOrganizationId,
          name,
          code,
          address,
          city,
          state,
          country,
          ...(active !== undefined && { active }),
        },
        include: siteInclude,
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

      res.status(500).json({
        error: "Failed to create site",
      });
    }
  },
);

// PATCH /sites/:id
sitesRouter.patch(
  "/:id",
  authenticateToken,
  requireRole("SUPER_ADMIN", "ORG_ADMIN"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const siteId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;

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

      const existingSite = await prisma.site.findUnique({
        where: {
          id: siteId,
        },
        select: {
          id: true,
          organizationId: true,
        },
      });

      if (!existingSite) {
        return res.status(404).json({
          error: "Site not found",
        });
      }

      if (
        !canAccessOrganization(
          req,
          existingSite.organizationId,
        )
      ) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      // Solo SUPER_ADMIN puede mover un sitio
      // entre organizaciones.
      if (
        organizationId !== undefined &&
        organizationId !== existingSite.organizationId &&
        req.user!.role !== "SUPER_ADMIN"
      ) {
        return res.status(403).json({
          error: "Only SUPER_ADMIN can change site organization",
        });
      }

      if (
        organizationId !== undefined &&
        !canAccessOrganization(req, organizationId)
      ) {
        return res.status(403).json({
          error: "Access denied for target organization",
        });
      }

      const site = await prisma.site.update({
        where: {
          id: siteId,
        },
        data: {
          ...(organizationId !== undefined && {
            organizationId,
          }),
          ...(name !== undefined && { name }),
          ...(code !== undefined && { code }),
          ...(address !== undefined && { address }),
          ...(city !== undefined && { city }),
          ...(state !== undefined && { state }),
          ...(country !== undefined && { country }),
          ...(active !== undefined && { active }),
        },
        include: siteInclude,
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

      res.status(500).json({
        error: "Failed to update site",
      });
    }
  },
);

// DELETE /sites/:id
sitesRouter.delete(
  "/:id",
  authenticateToken,
  requireRole("SUPER_ADMIN", "ORG_ADMIN"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const siteId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;

      const existingSite = await prisma.site.findUnique({
        where: {
          id: siteId,
        },
        select: {
          id: true,
          organizationId: true,
        },
      });

      if (!existingSite) {
        return res.status(404).json({
          error: "Site not found",
        });
      }

      if (
        !canAccessOrganization(
          req,
          existingSite.organizationId,
        )
      ) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      await prisma.site.delete({
        where: {
          id: siteId,
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
          error:
            "Site cannot be deleted because it has related records",
        });
      }

      res.status(500).json({
        error: "Failed to delete site",
      });
    }
  },
);

export { sitesRouter };