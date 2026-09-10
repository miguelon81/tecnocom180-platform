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

function isGlobalRole(req: AuthenticatedRequest) {
  return (
    req.user?.role === "SUPER_ADMIN" ||
    req.user?.role === "OPERATIONS"
  );
}

function canAccessOrganization(
  req: AuthenticatedRequest,
  organizationId: string,
) {
  if (!req.user) {
    return false;
  }

  if (isGlobalRole(req)) {
    return true;
  }

  return req.user.organizationId === organizationId;
}

function requiresSiteAssignment(req: AuthenticatedRequest) {
  return (
    req.user?.role === "RECEPTION" ||
    req.user?.role === "TECHNICIAN"
  );
}

async function canAccessSite(
  req: AuthenticatedRequest,
  siteId: string,
) {
  if (!req.user) {
    return false;
  }

  if (isGlobalRole(req)) {
    return true;
  }

  const site = await prisma.site.findUnique({
    where: {
      id: siteId,
    },
    select: {
      organizationId: true,
    },
  });

  if (!site) {
    return false;
  }

  if (site.organizationId !== req.user.organizationId) {
    return false;
  }

  if (!requiresSiteAssignment(req)) {
    return true;
  }

  const assignment = await prisma.userSite.findUnique({
    where: {
      userId_siteId: {
        userId: req.user.userId,
        siteId,
      },
    },
    select: {
      id: true,
    },
  });

  return Boolean(assignment);
}

async function getAccessibleSiteIds(
  req: AuthenticatedRequest,
) {
  if (!req.user || !requiresSiteAssignment(req)) {
    return undefined;
  }

  const assignments = await prisma.userSite.findMany({
    where: {
      userId: req.user.userId,
    },
    select: {
      siteId: true,
    },
  });

  return assignments.map((assignment) => assignment.siteId);
}

function getDeviceId(req: AuthenticatedRequest) {
  return Array.isArray(req.params.id)
    ? req.params.id[0]
    : req.params.id;
}

function optionalText(value: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

async function generateDeviceCode() {
  const prefix = "TC180-";

  const devices = await prisma.device.findMany({
    where: {
      deviceCode: {
        startsWith: prefix,
      },
    },
    select: {
      deviceCode: true,
    },
  });

  let highestNumber = 0;

  for (const device of devices) {
    if (!device.deviceCode) {
      continue;
    }

    const numericPart = device.deviceCode.slice(
      prefix.length,
    );

    // Solo acepta códigos normales:
    // TC180-000001
    // TC180-000002
    // etc.
    //
    // Ignora:
    // TC180-AG-000001
    // u otros prefijos especiales.
    if (!/^\d{6}$/.test(numericPart)) {
      continue;
    }

    const parsedNumber = Number(numericPart);

    if (parsedNumber > highestNumber) {
      highestNumber = parsedNumber;
    }
  }

  const nextNumber = highestNumber + 1;

  return `${prefix}${String(nextNumber).padStart(
    6,
    "0",
  )}`;
}
// ============================================================
// GET /devices
// GET /devices?siteId=xxx
// GET /devices?areaId=xxx
// GET /devices?modelId=xxx
// ============================================================

devicesRouter.get(
  "/",
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
      const siteId =
        typeof req.query.siteId === "string"
          ? req.query.siteId
          : undefined;

      const areaId =
        typeof req.query.areaId === "string"
          ? req.query.areaId
          : undefined;

      const modelId =
        typeof req.query.modelId === "string"
          ? req.query.modelId
          : undefined;

      let organizationId: string | undefined;

      if (siteId) {
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

        if (
          !canAccessOrganization(
            req,
            site.organizationId,
          )
        ) {
          return res.status(403).json({
            error:
              "Access denied for this organization",
          });
        }

        if (!(await canAccessSite(req, site.id))) {
          return res.status(403).json({
            error: "Access denied for this site",
          });
        }

        organizationId = site.organizationId;
      } else if (!isGlobalRole(req)) {
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

        if (
          !canAccessOrganization(
            req,
            area.site.organizationId,
          )
        ) {
          return res.status(403).json({
            error:
              "Access denied for this organization",
          });
        }

        if (!(await canAccessSite(req, area.siteId))) {
          return res.status(403).json({
            error: "Access denied for this site",
          });
        }

        if (siteId && area.siteId !== siteId) {
          return res.status(400).json({
            error:
              "Area does not belong to the specified site",
          });
        }

        organizationId ??=
          area.site.organizationId;
      }

      if (modelId) {
        const model =
          await prisma.deviceModel.findUnique({
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

      const accessibleSiteIds =
        await getAccessibleSiteIds(req);

      const devices = await prisma.device.findMany({
        where: {
          ...(organizationId && {
            site: {
              organizationId,
            },
          }),

          ...(siteId && {
            siteId,
          }),

          ...(areaId && {
            areaId,
          }),

          ...(modelId && {
            modelId,
          }),

          ...(accessibleSiteIds && {
            siteId: {
              in: accessibleSiteIds,
            },
          }),
        },
        include: deviceInclude,
        orderBy: {
          createdAt: "desc",
        },
      });

      return res.json(devices);
    } catch (error) {
      console.error("Error fetching devices:", error);

      return res.status(500).json({
        error: "Failed to fetch devices",
      });
    }
  },
);

// ============================================================
// GET /devices/:id/telemetry
// ============================================================

devicesRouter.get(
  "/:id/telemetry",
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
      const deviceId = getDeviceId(req);

      const device = await prisma.device.findUnique({
        where: {
          id: deviceId,
        },
        select: {
          id: true,
          deviceCode: true,
          siteId: true,
          site: {
            select: {
              organizationId: true,
            },
          },
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
          device.site.organizationId,
        )
      ) {
        return res.status(403).json({
          error:
            "Access denied for this organization",
        });
      }

      if (!(await canAccessSite(req, device.siteId))) {
        return res.status(403).json({
          error: "Access denied for this site",
        });
      }

      const telemetry =
        await prisma.deviceTelemetry.findMany({
          where: {
            deviceId,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 100,
        });

      return res.json({
        deviceId: device.id,
        deviceCode: device.deviceCode,
        telemetry,
      });
    } catch (error) {
      console.error(
        "Error fetching device telemetry:",
        error,
      );

      return res.status(500).json({
        error: "Failed to fetch device telemetry",
      });
    }
  },
);

// ============================================================
// GET /devices/:id/telemetry/latest
// ============================================================

devicesRouter.get(
  "/:id/telemetry/latest",
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
      const deviceId = getDeviceId(req);

      const device = await prisma.device.findUnique({
        where: {
          id: deviceId,
        },
        select: {
          id: true,
          deviceCode: true,
          siteId: true,
          site: {
            select: {
              organizationId: true,
            },
          },
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
          device.site.organizationId,
        )
      ) {
        return res.status(403).json({
          error:
            "Access denied for this organization",
        });
      }

      if (!(await canAccessSite(req, device.siteId))) {
        return res.status(403).json({
          error: "Access denied for this site",
        });
      }

      const telemetry =
        await prisma.deviceTelemetry.findFirst({
          where: {
            deviceId,
          },
          orderBy: {
            createdAt: "desc",
          },
        });

      if (!telemetry) {
        return res.status(404).json({
          error:
            "No telemetry found for this device",
        });
      }

      return res.json({
        deviceId: device.id,
        deviceCode: device.deviceCode,
        telemetry,
      });
    } catch (error) {
      console.error(
        "Error fetching latest device telemetry:",
        error,
      );

      return res.status(500).json({
        error:
          "Failed to fetch latest device telemetry",
      });
    }
  },
);

// ============================================================
// GET /devices/:id
// ============================================================

devicesRouter.get(
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
      const deviceId = getDeviceId(req);

      const device = await prisma.device.findUnique({
        where: {
          id: deviceId,
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
          device.site.organizationId,
        )
      ) {
        return res.status(403).json({
          error:
            "Access denied for this organization",
        });
      }

      if (!(await canAccessSite(req, device.siteId))) {
        return res.status(403).json({
          error: "Access denied for this site",
        });
      }

      return res.json(device);
    } catch (error) {
      console.error("Error fetching device:", error);

      return res.status(500).json({
        error: "Failed to fetch device",
      });
    }
  },
);

// ============================================================
// POST /devices
// ============================================================

devicesRouter.post(
  "/",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "OPERATIONS",
    "ORG_ADMIN",
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const {
        siteId,
        areaId,
        modelId,
        name,
        hostname,
        serial,
        ip,
        mac,
        firmware,
        installedAt,
        notes,
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

      if (
        !canAccessOrganization(
          req,
          site.organizationId,
        )
      ) {
        return res.status(403).json({
          error:
            "Access denied for this organization",
        });
      }

      const model =
        await prisma.deviceModel.findUnique({
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

        if (area.siteId !== siteId) {
          return res.status(400).json({
            error:
              "Area does not belong to the specified site",
          });
        }

        if (
          !canAccessOrganization(
            req,
            area.site.organizationId,
          )
        ) {
          return res.status(403).json({
            error:
              "Access denied for this organization",
          });
        }
      }

      const deviceCode =
        await generateDeviceCode();

      const device = await prisma.device.create({
        data: {
          deviceCode,
          siteId,
          areaId: areaId ?? null,
          modelId,

          name: optionalText(name),
          hostname: optionalText(hostname),
          serial: optionalText(serial),
          ip: optionalText(ip),
          mac: optionalText(mac),
          firmware: optionalText(firmware),
          notes: optionalText(notes),

          ...(installedAt !== undefined && {
            installedAt:
              installedAt === null ||
              installedAt === ""
                ? null
                : new Date(installedAt),
          }),
        },
        include: deviceInclude,
      });

      return res.status(201).json(device);
    } catch (error) {
      console.error("Error creating device:", error);

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return res.status(409).json({
          error:
            "A device with the specified unique data already exists",
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

      return res.status(500).json({
        error: "Failed to create device",
      });
    }
  },
);

// ============================================================
// PATCH /devices/:id
// ============================================================

devicesRouter.patch(
  "/:id",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "OPERATIONS",
    "ORG_ADMIN",
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const deviceId = getDeviceId(req);

      const {
        siteId,
        areaId,
        modelId,
        name,
        hostname,
        serial,
        ip,
        mac,
        firmware,
        installedAt,
        notes,
      } = req.body;

      const existingDevice =
        await prisma.device.findUnique({
          where: {
            id: deviceId,
          },
          select: {
            id: true,
            siteId: true,
            areaId: true,
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
          existingDevice.site.organizationId,
        )
      ) {
        return res.status(403).json({
          error:
            "Access denied for this organization",
        });
      }

      const targetSiteId =
        siteId ?? existingDevice.siteId;

      let targetOrganizationId =
        existingDevice.site.organizationId;

      if (siteId !== undefined) {
        const targetSite =
          await prisma.site.findUnique({
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
            error: "Site not found",
          });
        }

        targetOrganizationId =
          targetSite.organizationId;

        if (
          targetOrganizationId !==
            existingDevice.site.organizationId &&
          !isGlobalRole(req)
        ) {
          return res.status(403).json({
            error:
              "Only SUPER_ADMIN or OPERATIONS can move a device between organizations",
          });
        }

        if (
          !canAccessOrganization(
            req,
            targetOrganizationId,
          )
        ) {
          return res.status(403).json({
            error:
              "Access denied for target organization",
          });
        }
      }

      if (modelId !== undefined) {
        const model =
          await prisma.deviceModel.findUnique({
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

      const siteIsChanging =
        siteId !== undefined &&
        siteId !== existingDevice.siteId;

      const targetAreaId:
        | string
        | null
        | undefined =
        areaId !== undefined
          ? areaId
          : siteIsChanging
            ? null
            : existingDevice.areaId;

      if (
        targetAreaId !== null &&
        targetAreaId !== undefined
      ) {
        const area = await prisma.area.findUnique({
          where: {
            id: targetAreaId,
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

        if (!area) {
          return res.status(404).json({
            error: "Area not found",
          });
        }

        if (area.siteId !== targetSiteId) {
          return res.status(400).json({
            error:
              "Area does not belong to the specified site",
          });
        }

        if (
          !canAccessOrganization(
            req,
            area.site.organizationId,
          )
        ) {
          return res.status(403).json({
            error:
              "Access denied for area organization",
          });
        }

        if (
          area.site.organizationId !==
          targetOrganizationId
        ) {
          return res.status(400).json({
            error:
              "Area does not belong to the target organization",
          });
        }
      }

      const device = await prisma.device.update({
        where: {
          id: deviceId,
        },
        data: {
          ...(siteId !== undefined && {
            siteId,
          }),

          ...(areaId !== undefined ||
          siteIsChanging
            ? {
                areaId: targetAreaId,
              }
            : {}),

          ...(modelId !== undefined && {
            modelId,
          }),

          ...(name !== undefined && {
            name: optionalText(name),
          }),

          ...(hostname !== undefined && {
            hostname: optionalText(hostname),
          }),

          ...(serial !== undefined && {
            serial: optionalText(serial),
          }),

          ...(ip !== undefined && {
            ip: optionalText(ip),
          }),

          ...(mac !== undefined && {
            mac: optionalText(mac),
          }),

          ...(firmware !== undefined && {
            firmware: optionalText(firmware),
          }),

          ...(notes !== undefined && {
            notes: optionalText(notes),
          }),

          ...(installedAt !== undefined && {
            installedAt:
              installedAt === null ||
              installedAt === ""
                ? null
                : new Date(installedAt),
          }),
        },
        include: {
          ...deviceInclude,
          tickets: true,
        },
      });

      return res.json(device);
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
        error.code === "P2002"
      ) {
        return res.status(409).json({
          error:
            "A device with the specified unique data already exists",
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

      return res.status(500).json({
        error: "Failed to update device",
      });
    }
  },
);

// ============================================================
// DELETE /devices/:id
// ============================================================

devicesRouter.delete(
  "/:id",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "OPERATIONS",
    "ORG_ADMIN",
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const deviceId = getDeviceId(req);

      const existingDevice =
        await prisma.device.findUnique({
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
          existingDevice.site.organizationId,
        )
      ) {
        return res.status(403).json({
          error:
            "Access denied for this organization",
        });
      }

      await prisma.device.delete({
        where: {
          id: deviceId,
        },
      });

      return res.status(204).send();
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

      return res.status(500).json({
        error: "Failed to delete device",
      });
    }
  },
);

export { devicesRouter };