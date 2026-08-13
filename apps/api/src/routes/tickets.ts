import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  authenticateToken,
  requireRole,
  AuthenticatedRequest,
} from "../middleware/auth";

const ticketsRouter = Router();

const ticketInclude = {
  organization: true,
  site: true,
  area: true,
  device: {
    include: {
      model: {
        include: {
          brand: true,
        },
      },
    },
  },
  room: true,
  assignedTo: true,
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

// GET /tickets
// GET /tickets?siteId=xxx
// GET /tickets?areaId=xxx
// GET /tickets?roomId=xxx
// GET /tickets?deviceId=xxx
// GET /tickets?status=OPEN
// GET /tickets?type=WIFI
ticketsRouter.get(
  "/",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "RECEPTION",
    "TECHNICIAN"
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const siteId = req.query.siteId as string | undefined;
      const areaId = req.query.areaId as string | undefined;
      const roomId = req.query.roomId as string | undefined;
      const deviceId = req.query.deviceId as string | undefined;
      const status = req.query.status as string | undefined;
      const type = req.query.type as string | undefined;

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

      if (roomId) {
        const room = await prisma.room.findUnique({
          where: {
            id: roomId,
          },
          select: {
            site: {
              select: {
                organizationId: true,
              },
            },
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

        organizationId ??= room.site.organizationId;
      }

      if (deviceId) {
        const device = await prisma.device.findUnique({
          where: {
            id: deviceId,
          },
          select: {
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

        if (!canAccessOrganization(req, device.site.organizationId)) {
          return res.status(403).json({
            error: "Access denied for this organization",
          });
        }

        organizationId ??= device.site.organizationId;
      }

      const validStatuses = [
        "OPEN",
        "PENDING",
        "IN_PROGRESS",
        "RESOLVED",
        "CLOSED",
      ];

      const validTypes = [
        "WIFI",
        "INTERNET",
        "TV",
        "CAMERA",
        "NETWORK",
        "OTHER",
      ];

      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({
          error: "Invalid ticket status",
          validStatuses,
        });
      }

      if (type && !validTypes.includes(type)) {
        return res.status(400).json({
          error: "Invalid ticket type",
          validTypes,
        });
      }

      const tickets = await prisma.ticket.findMany({
        where: {
          ...(organizationId && {
            organizationId,
          }),
          ...(siteId && {
            siteId,
          }),
          ...(areaId && {
            areaId,
          }),
          ...(roomId && {
            roomId,
          }),
          ...(deviceId && {
            deviceId,
          }),
          ...(status && {
            status: status as
              | "OPEN"
              | "PENDING"
              | "IN_PROGRESS"
              | "RESOLVED"
              | "CLOSED",
          }),
          ...(type && {
            type: type as
              | "WIFI"
              | "INTERNET"
              | "TV"
              | "CAMERA"
              | "NETWORK"
              | "OTHER",
          }),
        },
        include: ticketInclude,
        orderBy: {
          createdAt: "desc",
        },
      });

      res.json(tickets);
    } catch (error) {
      console.error("Error fetching tickets:", error);

      res.status(500).json({
        error: "Failed to fetch tickets",
      });
    }
  }
);

// GET /tickets/:id
ticketsRouter.get(
  "/:id",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "RECEPTION",
    "TECHNICIAN"
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const ticket = await prisma.ticket.findUnique({
        where: {
          id: req.params.id as string,
        },
        include: ticketInclude,
      });

      if (!ticket) {
        return res.status(404).json({
          error: "Ticket not found",
        });
      }

      if (!canAccessOrganization(req, ticket.organizationId)) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      res.json(ticket);
    } catch (error) {
      console.error("Error fetching ticket:", error);

      res.status(500).json({
        error: "Failed to fetch ticket",
      });
    }
  }
);

// POST /tickets
ticketsRouter.post(
  "/",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "RECEPTION",
    "TECHNICIAN"
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const {
        organizationId,
        siteId,
        areaId,
        deviceId,
        roomId,
        assignedToId,
        type,
        title,
        description,
      } = req.body;

      if (!organizationId || !type || !title) {
        return res.status(400).json({
          error: "organizationId, type and title are required",
        });
      }

      if (!canAccessOrganization(req, organizationId)) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      const validTypes = [
        "WIFI",
        "INTERNET",
        "TV",
        "CAMERA",
        "NETWORK",
        "OTHER",
      ];

      if (!validTypes.includes(type)) {
        return res.status(400).json({
          error: "Invalid ticket type",
          validTypes,
        });
      }

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

        if (site.organizationId !== organizationId) {
          return res.status(400).json({
            error: "Site does not belong to the specified organization",
          });
        }
      }

      if (areaId) {
        const area = await prisma.area.findUnique({
          where: {
            id: areaId,
          },
          select: {
            siteId: true,
          },
        });

        if (!area) {
          return res.status(404).json({
            error: "Area not found",
          });
        }

        if (siteId && area.siteId !== siteId) {
          return res.status(400).json({
            error: "Area does not belong to the specified site",
          });
        }
      }

      if (deviceId) {
        const device = await prisma.device.findUnique({
          where: {
            id: deviceId,
          },
          select: {
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

        if (device.site.organizationId !== organizationId) {
          return res.status(400).json({
            error: "Device does not belong to the specified organization",
          });
        }
      }

      if (roomId) {
        const room = await prisma.room.findUnique({
          where: {
            id: roomId,
          },
          select: {
            site: {
              select: {
                organizationId: true,
              },
            },
          },
        });

        if (!room) {
          return res.status(404).json({
            error: "Room not found",
          });
        }

        if (room.site.organizationId !== organizationId) {
          return res.status(400).json({
            error: "Room does not belong to the specified organization",
          });
        }
      }

      if (assignedToId) {
        const user = await prisma.user.findUnique({
          where: {
            id: assignedToId,
          },
          select: {
            organizationId: true,
          },
        });

        if (!user) {
          return res.status(404).json({
            error: "Assigned user not found",
          });
        }

        if (user.organizationId !== organizationId) {
          return res.status(400).json({
            error: "Assigned user does not belong to the specified organization",
          });
        }
      }

      const ticket = await prisma.ticket.create({
        data: {
          organizationId,
          siteId: siteId ?? null,
          areaId: areaId ?? null,
          deviceId: deviceId ?? null,
          roomId: roomId ?? null,
          assignedToId: assignedToId ?? null,
          type,
          title,
          description,
        },
        include: ticketInclude,
      });

      res.status(201).json(ticket);
    } catch (error) {
      console.error("Error creating ticket:", error);

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2003"
      ) {
        return res.status(400).json({
          error: "Related record not found",
        });
      }

      res.status(500).json({
        error: "Failed to create ticket",
      });
    }
  }
);

// PATCH /tickets/:id
ticketsRouter.patch(
  "/:id",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "RECEPTION",
    "TECHNICIAN"
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const {
        status,
        assignedToId,
        title,
        description,
      } = req.body;

      const ticketId = req.params.id as string;

      const existingTicket = await prisma.ticket.findUnique({
        where: {
          id: ticketId,
        },
        select: {
          id: true,
          organizationId: true,
        },
      });

      if (!existingTicket) {
        return res.status(404).json({
          error: "Ticket not found",
        });
      }

      if (
        !canAccessOrganization(
          req,
          existingTicket.organizationId
        )
      ) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      const validStatuses = [
        "OPEN",
        "PENDING",
        "IN_PROGRESS",
        "RESOLVED",
        "CLOSED",
      ];

      if (
        status !== undefined &&
        !validStatuses.includes(status)
      ) {
        return res.status(400).json({
          error: "Invalid ticket status",
          validStatuses,
        });
      }

      if (assignedToId !== undefined && assignedToId !== null) {
        const user = await prisma.user.findUnique({
          where: {
            id: assignedToId,
          },
          select: {
            organizationId: true,
          },
        });

        if (!user) {
          return res.status(404).json({
            error: "Assigned user not found",
          });
        }

        if (
          user.organizationId !==
          existingTicket.organizationId
        ) {
          return res.status(400).json({
            error: "Assigned user does not belong to the ticket organization",
          });
        }
      }

      const ticket = await prisma.ticket.update({
        where: {
          id: ticketId,
        },
        data: {
          ...(status !== undefined && { status }),
          ...(assignedToId !== undefined && {
            assignedToId: assignedToId ?? null,
          }),
          ...(title !== undefined && { title }),
          ...(description !== undefined && {
            description,
          }),
        },
        include: ticketInclude,
      });

      res.json(ticket);
    } catch (error) {
      console.error("Error updating ticket:", error);

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2025"
      ) {
        return res.status(404).json({
          error: "Ticket not found",
        });
      }

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2003"
      ) {
        return res.status(400).json({
          error: "Related record not found",
        });
      }

      res.status(500).json({
        error: "Failed to update ticket",
      });
    }
  }
);

// DELETE /tickets/:id
ticketsRouter.delete(
  "/:id",
  authenticateToken,
  requireRole("SUPER_ADMIN", "ORG_ADMIN"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const ticketId = req.params.id as string;

      const existingTicket = await prisma.ticket.findUnique({
        where: {
          id: ticketId,
        },
        select: {
          id: true,
          organizationId: true,
        },
      });

      if (!existingTicket) {
        return res.status(404).json({
          error: "Ticket not found",
        });
      }

      if (
        !canAccessOrganization(
          req,
          existingTicket.organizationId
        )
      ) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      await prisma.ticket.delete({
        where: {
          id: ticketId,
        },
      });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting ticket:", error);

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2025"
      ) {
        return res.status(404).json({
          error: "Ticket not found",
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
            "Ticket cannot be deleted because it has related records",
        });
      }

      res.status(500).json({
        error: "Failed to delete ticket",
      });
    }
  }
);

export { ticketsRouter };