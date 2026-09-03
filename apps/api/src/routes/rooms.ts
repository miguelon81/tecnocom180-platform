import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  authenticateToken,
  requireRole,
  AuthenticatedRequest,
} from "../middleware/auth";

const roomsRouter = Router();

const validStatuses = [
  "AVAILABLE",
  "OCCUPIED",
  "MAINTENANCE",
  "CLEANING",
];

const roomInclude = {
  site: true,
  area: true,
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

// GET /rooms
// GET /rooms?siteId=xxx
roomsRouter.get(
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
      const requestedSiteId =
        req.query.siteId as string | undefined;

      let organizationId: string | undefined;

      if (requestedSiteId) {
        const site = await prisma.site.findUnique({
          where: {
            id: requestedSiteId,
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

     const rooms = await prisma.room.findMany({
  where: requestedSiteId
    ? {
        siteId: requestedSiteId,
      }
    : organizationId
      ? {
          site: {
            organizationId,
          },
        }
      : undefined,
  include: roomInclude,
        orderBy: [
          {
            siteId: "asc",
          },
          {
            number: "asc",
          },
        ],
      });

      res.json(rooms);
    } catch (error) {
      console.error("Error fetching rooms:", error);

      res.status(500).json({
        error: "Failed to fetch rooms",
      });
    }
  },
);

// GET /rooms/:id
roomsRouter.get(
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
      const roomId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;

      const room = await prisma.room.findUnique({
        where: {
          id: roomId,
        },
        include: {
          ...roomInclude,
          tickets: true,
        },
      });

      if (!room) {
        return res.status(404).json({
          error: "Room not found",
        });
      }

      if (!canAccessOrganization(req, room.site.organizationId)) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      res.json(room);
    } catch (error) {
      console.error("Error fetching room:", error);

      res.status(500).json({
        error: "Failed to fetch room",
      });
    }
  },
);

// POST /rooms
roomsRouter.post(
  "/",
  authenticateToken,
  requireRole("SUPER_ADMIN", "ORG_ADMIN"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const {
        siteId,
        areaId,
        number,
        floor,
        status,
      } = req.body;

      if (!siteId || !number) {
        return res.status(400).json({
          error: "siteId and number are required",
        });
      }

      if (
        status !== undefined &&
        !validStatuses.includes(status)
      ) {
        return res.status(400).json({
          error: "Invalid room status",
          validStatuses,
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

      const room = await prisma.room.create({
        data: {
          siteId,
          areaId: areaId ?? null,
          number,
          floor: floor ?? null,
          status: status ?? "AVAILABLE",
        },
        include: roomInclude,
      });

      res.status(201).json(room);
    } catch (error) {
      console.error("Error creating room:", error);

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return res.status(409).json({
          error:
            "A room with this number already exists in this site",
        });
      }

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2003"
      ) {
        return res.status(409).json({
          error: "Invalid site or area reference",
        });
      }

      res.status(500).json({
        error: "Failed to create room",
      });
    }
  },
);

// PATCH /rooms/:id
roomsRouter.patch(
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
      const {
        number,
        floor,
        status,
        areaId,
      } = req.body;

      const roomId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;

      const existingRoom = await prisma.room.findUnique({
        where: {
          id: roomId,
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

      if (!existingRoom) {
        return res.status(404).json({
          error: "Room not found",
        });
      }
const role = req.user!.role;

if (role === "RECEPTION") {
  if (
    number !== undefined ||
    floor !== undefined ||
    areaId !== undefined
  ) {
    return res.status(403).json({
      error:
        "Reception can only change the room status",
    });
  }
}

if (role === "TECHNICIAN") {
  if (
    number !== undefined ||
    floor !== undefined ||
    areaId !== undefined
  ) {
    return res.status(403).json({
      error:
        "Technician cannot modify room data",
    });
  }

  if (status !== "MAINTENANCE") {
    return res.status(403).json({
      error:
        "Technician can only set a room to maintenance",
    });
  }
}

      if (
        !canAccessOrganization(
          req,
          existingRoom.site.organizationId,
        )
      ) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      if (
        status !== undefined &&
        !validStatuses.includes(status)
      ) {
        return res.status(400).json({
          error: "Invalid room status",
          validStatuses,
        });
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

        if (area.siteId !== existingRoom.siteId) {
          return res.status(400).json({
            error: "Area does not belong to the room site",
          });
        }
      }

      const room = await prisma.room.update({
        where: {
          id: roomId,
        },
        data: {
          ...(number !== undefined && { number }),
          ...(floor !== undefined && { floor }),
          ...(status !== undefined && { status }),
          ...(areaId !== undefined && {
            areaId: areaId ?? null,
          }),
        },
        include: {
          ...roomInclude,
          tickets: true,
        },
      });

      res.json(room);
    } catch (error) {
      console.error("Error updating room:", error);

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return res.status(409).json({
          error:
            "A room with this number already exists in this site",
        });
      }

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2025"
      ) {
        return res.status(404).json({
          error: "Room not found",
        });
      }

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2003"
      ) {
        return res.status(409).json({
          error: "Invalid area reference",
        });
      }

      res.status(500).json({
        error: "Failed to update room",
      });
    }
  },
);

// DELETE /rooms/:id
roomsRouter.delete(
  "/:id",
  authenticateToken,
  requireRole("SUPER_ADMIN", "ORG_ADMIN"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const roomId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;

      const existingRoom = await prisma.room.findUnique({
        where: {
          id: roomId,
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

      if (!existingRoom) {
        return res.status(404).json({
          error: "Room not found",
        });
      }

      if (
        !canAccessOrganization(
          req,
          existingRoom.site.organizationId,
        )
      ) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      await prisma.room.delete({
        where: {
          id: roomId,
        },
      });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting room:", error);

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2025"
      ) {
        return res.status(404).json({
          error: "Room not found",
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
            "Room cannot be deleted because it has related records",
        });
      }

      res.status(500).json({
        error: "Failed to delete room",
      });
    }
  },
);

export { roomsRouter };