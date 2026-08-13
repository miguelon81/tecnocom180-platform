import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  authenticateToken,
  requireRole,
  AuthenticatedRequest,
} from "../middleware/auth";

const devicesRouter = Router();

const deviceInclude = {
  site: true,
  area: true,
  model: {
    include: {
      brand: true,
    },
  },
};

function canAccessOrganization(
  req: AuthenticatedRequest,
  organizationId: string
) {
  if (!req.user) {
    return false;
  }

  if (req.user.role === "SUPER_ADMIN") {
    return true;
  }

  return req.user.organizationId === organizationId;
}

// GET /devices
// GET /devices?siteId=xxx
// GET /devices?areaId=xxx
// GET /devices?modelId=xxx
devicesRouter.get(
  "/",
  authenticateToken,
  requireRole("SUPER_ADMIN", "ORG_ADMIN", "TECHNICIAN"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const siteId = req.query.siteId as string | undefined;
      const areaId = req.query.areaId as string | undefined;
      const modelId = req.query.modelId as string | undefined;

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

      if (areaId) {
        const area = await prisma.area.findUnique({
          where: {
            id: areaId,
          },
          select: {
            siteId: true,
            site: {
              select: {
                organizationId: true,
              },
            },
          },
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

        if (siteId && area.siteId !== siteId) {
          return res.status(400).json({
            error: "Area does not belong to the specified site",
          });
        }

        organizationId ??= area.site.organizationId;
      }

      const devices = await prisma.device.findMany({
        where: {
          ...(organizationId && {
            site: {
              organizationId,
            },
          }),
          ...(siteId && { siteId }),
          ...(areaId && { areaId }),
          ...(modelId && { modelId }),
        },
        include: deviceInclude,
        orderBy: {
          createdAt: "desc",
        },
      });

      res.json(devices);
    } catch (error) {
      console.error("Error fetching devices:", error);

      res.status(500).json({
        error: "Failed to fetch devices",
      });
    }
  }
);

// GET /devices/:id
devicesRouter.get(
  "/:id",
  authenticateToken,
  requireRole("SUPER_ADMIN", "ORG_ADMIN", "TECHNICIAN"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const device = await prisma.device.findUnique({
        where: {
          id: req.params.id as string,
        },
        include: {
          ...deviceInclude,
          tickets: true,
        },
      });

      if (!device) {
        return res.status(404).json({
          error: "Device not found",
        });
      }

      if (
        !canAccessOrganization(
          req,
          device.site.organizationId
        )
      ) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      res.json(device);
    } catch (error) {
      console.error("Error fetching device:", error);

      res.status(500).json({
        error: "Failed to fetch device",
      });
    }
  }
);

// POST /devices
devicesRouter.post(
  "/",
  authenticateToken,
  requireRole("SUPER_ADMIN", "ORG_ADMIN"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const {
        siteId,
        areaId,
        modelId,
        hostname,
        serial,
        ip,
        mac,
        firmware,
        online,
        installedAt,
      } = req.body;

      if (!siteId || !modelId) {
        return res.status(400).json({
          error: "siteId and modelId are required",
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

      const model = await prisma.deviceModel.findUnique({
        where: {
          id: modelId,
        },
        select: {
          id: true,
        },
      });

      if (!model) {
        return res.status(404).json({
          error: "Model not found",
        });
      }

      if (areaId) {
        const area = await prisma.area.findUnique({
          where: {
            id: areaId,
          },
          select: {
            id: true,
            siteId: true,
          },
        });

        if (!area) {
          return res.status(404).json({
            error: "Area not found",
          });
        }

        if (area.siteId !== siteId) {
          return res.status(400).json({
            error: "Area does not belong to the specified site",
          });
        }
      }

      const device = await prisma.device.create({
        data: {
          siteId,
          areaId: areaId ?? null,
          modelId,
          hostname,
          serial,
          ip,
          mac,
          firmware,
          ...(online !== undefined && { online }),
          ...(installedAt !== undefined && { installedAt }),
        },
        include: deviceInclude,
      });

      res.status(201).json(device);
    } catch (error) {
      console.error("Error creating device:", error);

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2003"
      ) {
        return res.status(400).json({
          error: "Invalid site, area or model",
        });
      }

      res.status(500).json({
        error: "Failed to create device",
      });
    }
  }
);

// PATCH /devices/:id
devicesRouter.patch(
  "/:id",
  authenticateToken,
  requireRole("SUPER_ADMIN", "ORG_ADMIN", "TECHNICIAN"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const {
        siteId,
        areaId,
        modelId,
        hostname,
        serial,
        ip,
        mac,
        firmware,
        online,
        installedAt,
      } = req.body;

      const deviceId = req.params.id as string;

      const existingDevice = await prisma.device.findUnique({
        where: {
          id: deviceId,
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

      if (!existingDevice) {
        return res.status(404).json({
          error: "Device not found",
        });
      }

      if (
        !canAccessOrganization(
          req,
          existingDevice.site.organizationId
        )
      ) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      const targetSiteId = siteId ?? existingDevice.siteId;

      if (siteId !== undefined) {
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
      }

      if (modelId !== undefined) {
        const model = await prisma.deviceModel.findUnique({
          where: {
            id: modelId,
          },
          select: {
            id: true,
          },
        });

        if (!model) {
          return res.status(404).json({
            error: "Model not found",
          });
        }
      }

      if (areaId !== undefined && areaId !== null) {
        const area = await prisma.area.findUnique({
          where: {
            id: areaId,
          },
          select: {
            id: true,
            siteId: true,
          },
        });

        if (!area) {
          return res.status(404).json({
            error: "Area not found",
          });
        }

        if (area.siteId !== targetSiteId) {
          return res.status(400).json({
            error: "Area does not belong to the specified site",
          });
        }
      }

      const device = await prisma.device.update({
        where: {
          id: deviceId,
        },
        data: {
          ...(siteId !== undefined && { siteId }),
          ...(areaId !== undefined && {
            areaId: areaId ?? null,
          }),
          ...(modelId !== undefined && { modelId }),
          ...(hostname !== undefined && { hostname }),
          ...(serial !== undefined && { serial }),
          ...(ip !== undefined && { ip }),
          ...(mac !== undefined && { mac }),
          ...(firmware !== undefined && { firmware }),
          ...(online !== undefined && { online }),
          ...(installedAt !== undefined && { installedAt }),
        },
        include: {
          ...deviceInclude,
          tickets: true,
        },
      });

      res.json(device);
    } catch (error) {
      console.error("Error updating device:", error);

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2025"
      ) {
        return res.status(404).json({
          error: "Device not found",
        });
      }

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2003"
      ) {
        return res.status(400).json({
          error: "Invalid site, area or model",
        });
      }

      res.status(500).json({
        error: "Failed to update device",
      });
    }
  }
);

// DELETE /devices/:id
devicesRouter.delete(
  "/:id",
  authenticateToken,
  requireRole("SUPER_ADMIN", "ORG_ADMIN"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const deviceId = req.params.id as string;

      const existingDevice = await prisma.device.findUnique({
        where: {
          id: deviceId,
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

      if (!existingDevice) {
        return res.status(404).json({
          error: "Device not found",
        });
      }

      if (
        !canAccessOrganization(
          req,
          existingDevice.site.organizationId
        )
      ) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      await prisma.device.delete({
        where: {
          id: deviceId,
        },
      });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting device:", error);

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2025"
      ) {
        return res.status(404).json({
          error: "Device not found",
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
            "Device cannot be deleted because it has related records",
        });
      }

      res.status(500).json({
        error: "Failed to delete device",
      });
    }
  }
);

export { devicesRouter };
