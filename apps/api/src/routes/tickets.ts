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
  assignedTo: {
    select: {
      id: true,
      organizationId: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      active: true,
      lastLogin: true,
      createdAt: true,
      updatedAt: true,
    },
  },
};

const validStatuses = [
  "OPEN",
  "PENDING",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
] as const;

const validTypes = [
  "WIFI",
  "INTERNET",
  "TV",
  "CAMERA",
  "NETWORK",
  "OTHER",
] as const;

const validSources = [
  "QR_GUEST",
  "MANUAL",
  "API",
  "AUTOMATIC",
] as const;

type TicketStatusValue = (typeof validStatuses)[number];
type TicketTypeValue = (typeof validTypes)[number];
type TicketSourceValue = (typeof validSources)[number];

const managementRoles = [
  "SUPER_ADMIN",
  "ORG_ADMIN",
  "OPERATIONS",
] as const;

const ticketAccessRoles = [
  "SUPER_ADMIN",
  "ORG_ADMIN",
  "OPERATIONS",
  "RECEPTION",
  "TECHNICIAN",
] as const;

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

function isManagementRole(role: string) {
  return managementRoles.includes(
    role as (typeof managementRoles)[number]
  );
}

// =====================================================
// GET /tickets
// =====================================================

ticketsRouter.get(
  "/",
  authenticateToken,
  requireRole(...ticketAccessRoles),
  async (req: AuthenticatedRequest, res) => {
    try {
      const siteId = req.query.siteId as string | undefined;
      const areaId = req.query.areaId as string | undefined;
      const roomId = req.query.roomId as string | undefined;
      const deviceId = req.query.deviceId as string | undefined;
      const status = req.query.status as string | undefined;
      const type = req.query.type as string | undefined;
      const source = req.query.source as string | undefined;

      let organizationId: string | undefined;

      // ---------------------------------------------
      // SITE FILTER
      // ---------------------------------------------

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

      // ---------------------------------------------
      // AREA FILTER
      // ---------------------------------------------

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

      // ---------------------------------------------
      // ROOM FILTER
      // ---------------------------------------------

      if (roomId) {
        const room = await prisma.room.findUnique({
          where: {
            id: roomId,
          },
          select: {
            siteId: true,
            areaId: true,
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

        if (siteId && room.siteId !== siteId) {
          return res.status(400).json({
            error: "Room does not belong to the specified site",
          });
        }

        if (areaId && room.areaId !== areaId) {
          return res.status(400).json({
            error: "Room does not belong to the specified area",
          });
        }

        organizationId ??= room.site.organizationId;
      }

      // ---------------------------------------------
      // DEVICE FILTER
      // ---------------------------------------------

      if (deviceId) {
        const device = await prisma.device.findUnique({
          where: {
            id: deviceId,
          },
          select: {
            siteId: true,
            areaId: true,
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

        if (siteId && device.siteId !== siteId) {
          return res.status(400).json({
            error: "Device does not belong to the specified site",
          });
        }

        if (
          areaId &&
          device.areaId &&
          device.areaId !== areaId
        ) {
          return res.status(400).json({
            error: "Device does not belong to the specified area",
          });
        }

        organizationId ??= device.site.organizationId;
      }

      // ---------------------------------------------
      // VALIDATE STATUS
      // ---------------------------------------------

      if (
        status &&
        !validStatuses.includes(status as TicketStatusValue)
      ) {
        return res.status(400).json({
          error: "Invalid ticket status",
          validStatuses,
        });
      }

      // ---------------------------------------------
      // VALIDATE TYPE
      // ---------------------------------------------

      if (
        type &&
        !validTypes.includes(type as TicketTypeValue)
      ) {
        return res.status(400).json({
          error: "Invalid ticket type",
          validTypes,
        });
      }

      // ---------------------------------------------
      // VALIDATE SOURCE
      // ---------------------------------------------

      if (
        source &&
        !validSources.includes(source as TicketSourceValue)
      ) {
        return res.status(400).json({
          error: "Invalid ticket source",
          validSources,
        });
      }

      // ---------------------------------------------
      // FETCH TICKETS
      // ---------------------------------------------

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
            status: status as TicketStatusValue,
          }),

          ...(type && {
            type: type as TicketTypeValue,
          }),

          ...(source && {
            source: source as TicketSourceValue,
          }),

          ...(req.user!.role === "TECHNICIAN" && {
            assignedToId: req.user!.userId,
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

// =====================================================
// GET /tickets/:id
// =====================================================

ticketsRouter.get(
  "/:id",
  authenticateToken,
  requireRole(...ticketAccessRoles),
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

      if (
        req.user!.role === "TECHNICIAN" &&
        ticket.assignedToId !== req.user!.userId
      ) {
        return res.status(403).json({
          error:
            "Technicians can only access tickets assigned to them",
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

// =====================================================
// POST /tickets
// =====================================================

ticketsRouter.post(
  "/",
  authenticateToken,
  requireRole(...ticketAccessRoles),
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
        source,
        title,
        description,
      } = req.body;

      // ---------------------------------------------
      // REQUIRED FIELDS
      // ---------------------------------------------

      if (!organizationId || !type || !title) {
        return res.status(400).json({
          error: "organizationId, type and title are required",
        });
      }

      // ---------------------------------------------
      // ORGANIZATION ACCESS
      // ---------------------------------------------

      if (!canAccessOrganization(req, organizationId)) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      if (req.user!.role === "TECHNICIAN") {
        return res.status(403).json({
          error: "Technicians cannot create tickets",
        });
      }

      // ---------------------------------------------
      // VALIDATE TYPE
      // ---------------------------------------------

      if (!validTypes.includes(type as TicketTypeValue)) {
        return res.status(400).json({
          error: "Invalid ticket type",
          validTypes,
        });
      }

      // ---------------------------------------------
      // VALIDATE SOURCE
      // ---------------------------------------------

      if (
        source !== undefined &&
        !validSources.includes(source as TicketSourceValue)
      ) {
        return res.status(400).json({
          error: "Invalid ticket source",
          validSources,
        });
      }

      // ---------------------------------------------
      // RECEPTION CANNOT ASSIGN
      // ---------------------------------------------

      if (
        req.user!.role === "RECEPTION" &&
        assignedToId
      ) {
        return res.status(403).json({
          error: "Reception cannot assign tickets",
        });
      }

      // =================================================
      // RESOURCE VALIDATION
      //
      // Organization
      //      ?
      // Site
      //      ?
      // Area
      //      ?
      // Room / Device
      //
      // Todos los recursos relacionados deben ser
      // coherentes entre sí.
      // =================================================

      let validatedSiteId: string | null = null;
      let validatedAreaId: string | null = null;
      let roomAreaId: string | null = null;
      let deviceAreaId: string | null = null;

      // ---------------------------------------------
      // SITE
      // ---------------------------------------------

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

        if (site.organizationId !== organizationId) {
          return res.status(400).json({
            error:
              "Site does not belong to the specified organization",
          });
        }

        validatedSiteId = site.id;
      }

      // ---------------------------------------------
      // AREA
      // ---------------------------------------------

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

        if (area.site.organizationId !== organizationId) {
          return res.status(400).json({
            error:
              "Area does not belong to the specified organization",
          });
        }

        if (
          validatedSiteId &&
          area.siteId !== validatedSiteId
        ) {
          return res.status(400).json({
            error:
              "Area does not belong to the specified site",
          });
        }

        validatedSiteId ??= area.siteId;
        validatedAreaId = area.id;
      }

      // ---------------------------------------------
      // DEVICE
      // ---------------------------------------------

      if (deviceId) {
        const device = await prisma.device.findUnique({
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

        if (!device) {
          return res.status(404).json({
            error: "Device not found",
          });
        }

        if (device.site.organizationId !== organizationId) {
          return res.status(400).json({
            error:
              "Device does not belong to the specified organization",
          });
        }

        if (
          validatedSiteId &&
          device.siteId !== validatedSiteId
        ) {
          return res.status(400).json({
            error:
              "Device does not belong to the specified site",
          });
        }

        if (
          validatedAreaId &&
          device.areaId &&
          device.areaId !== validatedAreaId
        ) {
          return res.status(400).json({
            error:
              "Device does not belong to the specified area",
          });
        }

        if (!validatedSiteId) {
          validatedSiteId = device.siteId;
        }

        deviceAreaId = device.areaId;
      }

      // ---------------------------------------------
      // ROOM
      // ---------------------------------------------

      if (roomId) {
        const room = await prisma.room.findUnique({
          where: {
            id: roomId,
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

        if (!room) {
          return res.status(404).json({
            error: "Room not found",
          });
        }

        if (room.site.organizationId !== organizationId) {
          return res.status(400).json({
            error:
              "Room does not belong to the specified organization",
          });
        }

        if (
          validatedSiteId &&
          room.siteId !== validatedSiteId
        ) {
          return res.status(400).json({
            error:
              "Room does not belong to the specified site",
          });
        }

        if (
          validatedAreaId &&
          room.areaId !== validatedAreaId
        ) {
          return res.status(400).json({
            error:
              "Room does not belong to the specified area",
          });
        }

        if (
          deviceId &&
          deviceAreaId &&
          room.areaId &&
          deviceAreaId !== room.areaId
        ) {
          return res.status(400).json({
            error:
              "Room and device do not belong to the same area",
          });
        }

        if (!validatedSiteId) {
          validatedSiteId = room.siteId;
        }

        if (!validatedAreaId && room.areaId) {
          validatedAreaId = room.areaId;
        }

        roomAreaId = room.areaId;
      }

      // ---------------------------------------------
      // FINAL CONSISTENCY CHECK
      // ---------------------------------------------

      if (
        validatedAreaId &&
        roomAreaId &&
        validatedAreaId !== roomAreaId
      ) {
        return res.status(400).json({
          error:
            "Room does not belong to the specified area",
        });
      }

      if (
        validatedAreaId &&
        deviceAreaId &&
        deviceAreaId !== validatedAreaId
      ) {
        return res.status(400).json({
          error:
            "Device does not belong to the specified area",
        });
      }

      const finalSiteId = validatedSiteId;

      // ---------------------------------------------
      // ASSIGNED USER
      // ---------------------------------------------

      if (assignedToId) {
        if (!isManagementRole(req.user!.role)) {
          return res.status(403).json({
            error:
              "Insufficient permissions to assign tickets",
          });
        }

        const user = await prisma.user.findUnique({
          where: {
            id: assignedToId,
          },
          select: {
            id: true,
            organizationId: true,
            role: true,
            active: true,
          },
        });

        if (!user) {
          return res.status(404).json({
            error: "Assigned user not found",
          });
        }

        if (!user.active) {
          return res.status(400).json({
            error: "Assigned user is inactive",
          });
        }

        if (user.organizationId !== organizationId) {
          return res.status(400).json({
            error:
              "Assigned user does not belong to the specified organization",
          });
        }

        if (user.role !== "TECHNICIAN") {
          return res.status(400).json({
            error:
              "Tickets can only be assigned to technicians",
          });
        }
      }

      // ---------------------------------------------
      // CREATE TICKET
      // ---------------------------------------------

      const ticket = await prisma.ticket.create({
        data: {
          organizationId,
          siteId: finalSiteId,
          areaId: areaId ?? null,
          deviceId: deviceId ?? null,
          roomId: roomId ?? null,
          assignedToId: assignedToId ?? null,
          type,
          source: source ?? "MANUAL",
          title,
          description: description ?? null,
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

// =====================================================
// PATCH /tickets/:id
// =====================================================

ticketsRouter.patch(
  "/:id",
  authenticateToken,
  requireRole(...ticketAccessRoles),
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
          assignedToId: true,
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

      // ---------------------------------------------
      // TECHNICIAN
      // ---------------------------------------------

      if (req.user!.role === "TECHNICIAN") {
        if (
          existingTicket.assignedToId !== req.user!.userId
        ) {
          return res.status(403).json({
            error:
              "Technicians can only update tickets assigned to them",
          });
        }

        if (assignedToId !== undefined) {
          return res.status(403).json({
            error:
              "Technicians cannot assign or reassign tickets",
          });
        }

        if (
          title !== undefined ||
          description !== undefined
        ) {
          return res.status(403).json({
            error:
              "Technicians cannot modify ticket details",
          });
        }
      }

      // ---------------------------------------------
      // RECEPTION
      // ---------------------------------------------

      if (req.user!.role === "RECEPTION") {
        return res.status(403).json({
          error:
            "Reception cannot modify ticket status or assignment",
        });
      }

      // ---------------------------------------------
      // STATUS
      // ---------------------------------------------

      if (
        status !== undefined &&
        !validStatuses.includes(
          status as TicketStatusValue
        )
      ) {
        return res.status(400).json({
          error: "Invalid ticket status",
          validStatuses,
        });
      }

      // ---------------------------------------------
      // ASSIGNED USER
      // ---------------------------------------------

      if (
        assignedToId !== undefined &&
        assignedToId !== null
      ) {
        if (!isManagementRole(req.user!.role)) {
          return res.status(403).json({
            error:
              "Insufficient permissions to assign tickets",
          });
        }

        const user = await prisma.user.findUnique({
          where: {
            id: assignedToId,
          },
          select: {
            organizationId: true,
            role: true,
            active: true,
          },
        });

        if (!user) {
          return res.status(404).json({
            error: "Assigned user not found",
          });
        }

        if (!user.active) {
          return res.status(400).json({
            error: "Assigned user is inactive",
          });
        }

        if (
          user.organizationId !==
          existingTicket.organizationId
        ) {
          return res.status(400).json({
            error:
              "Assigned user does not belong to the ticket organization",
          });
        }

        if (user.role !== "TECHNICIAN") {
          return res.status(400).json({
            error:
              "Tickets can only be assigned to technicians",
          });
        }
      }

      // ---------------------------------------------
      // UPDATE TICKET
      // ---------------------------------------------

      const ticket = await prisma.ticket.update({
        where: {
          id: ticketId,
        },

        data: {
          ...(status !== undefined && {
            status,
          }),

          ...(assignedToId !== undefined && {
            assignedToId: assignedToId ?? null,
          }),

          ...(title !== undefined && {
            title,
          }),

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

// =====================================================
// GET /tickets/:id/comments
// =====================================================

ticketsRouter.get(
  "/:id/comments",
  authenticateToken,
  requireRole(...ticketAccessRoles),
  async (req: AuthenticatedRequest, res) => {
    try {
      const ticketId = req.params.id as string;

      const ticket = await prisma.ticket.findUnique({
        where: {
          id: ticketId,
        },
        select: {
          organizationId: true,
          assignedToId: true,
        },
      });

      if (!ticket) {
        return res.status(404).json({
          error: "Ticket not found",
        });
      }

      if (
        !canAccessOrganization(
          req,
          ticket.organizationId
        )
      ) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      if (
        req.user!.role === "TECHNICIAN" &&
        ticket.assignedToId !== req.user!.userId
      ) {
        return res.status(403).json({
          error:
            "Technicians can only access comments for their tickets",
        });
      }

      const comments = await prisma.ticketComment.findMany({
        where: {
          ticketId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      res.json(comments);
    } catch (error) {
      console.error(
        "Error fetching ticket comments:",
        error
      );

      res.status(500).json({
        error: "Failed to fetch ticket comments",
      });
    }
  }
);

// =====================================================
// POST /tickets/:id/comments
// =====================================================

ticketsRouter.post(
  "/:id/comments",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "OPERATIONS",
    "TECHNICIAN"
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const ticketId = req.params.id as string;
      const { comment } = req.body;

      if (
        typeof comment !== "string" ||
        !comment.trim()
      ) {
        return res.status(400).json({
          error: "Comment is required",
        });
      }

      const ticket = await prisma.ticket.findUnique({
        where: {
          id: ticketId,
        },
        select: {
          organizationId: true,
          assignedToId: true,
        },
      });

      if (!ticket) {
        return res.status(404).json({
          error: "Ticket not found",
        });
      }

      if (
        !canAccessOrganization(
          req,
          ticket.organizationId
        )
      ) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      if (
        req.user!.role === "TECHNICIAN" &&
        ticket.assignedToId !== req.user!.userId
      ) {
        return res.status(403).json({
          error:
            "Technicians can only comment on tickets assigned to them",
        });
      }

      const ticketComment =
        await prisma.ticketComment.create({
          data: {
            ticketId,
            userId: req.user!.userId,
            comment: comment.trim(),
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
        });

      res.status(201).json(ticketComment);
    } catch (error) {
      console.error(
        "Error creating ticket comment:",
        error
      );

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
        error: "Failed to create ticket comment",
      });
    }
  }
);

// =====================================================
// DELETE /tickets/:id
// =====================================================

ticketsRouter.delete(
  "/:id",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "OPERATIONS"
  ),
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
