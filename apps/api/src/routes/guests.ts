import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import {
  authenticateToken,
  requireRole,
  AuthenticatedRequest,
} from "../middleware/auth";

const guestsRouter = Router();

// ============================================================
// GET /guests
// ============================================================

guestsRouter.get(
  "/",
  authenticateToken,
  requireRole("SUPER_ADMIN", "ORG_ADMIN", "OPERATIONS", "RECEPTION"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const siteId =
        typeof req.query.siteId === "string"
          ? req.query.siteId
          : undefined;

      const organizationId =
        req.user!.role === "SUPER_ADMIN"
          ? undefined
          : req.user!.organizationId;

      const guests = await prisma.guest.findMany({
        where: {
          siteId,
          site: organizationId
            ? {
                organizationId,
              }
            : undefined,
        },
        include: {
          site: true,
          stays: {
            include: {
              room: true,
              wifiAccess: true,
            },
            orderBy: {
              checkIn: "desc",
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return res.json(guests);
    } catch (error) {
      console.error("Error fetching guests:", error);

      return res.status(500).json({
        error: "Failed to fetch guests",
      });
    }
  },
);

// ============================================================
// GET /guests/:id
// ============================================================

guestsRouter.get(
  "/:id",
  authenticateToken,
  requireRole("SUPER_ADMIN", "ORG_ADMIN", "OPERATIONS", "RECEPTION"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const guestId = req.params.id as string;

      const organizationId =
        req.user!.role === "SUPER_ADMIN"
          ? undefined
          : req.user!.organizationId;

      const guest = await prisma.guest.findFirst({
        where: {
          id: guestId,
          site: organizationId
            ? {
                organizationId,
              }
            : undefined,
        },
        include: {
          site: true,
          stays: {
            include: {
              room: true,
              wifiAccess: true,
            },
            orderBy: {
              checkIn: "desc",
            },
          },
        },
      });

      if (!guest) {
        return res.status(404).json({
          error: "Guest not found",
        });
      }

      return res.json(guest);
    } catch (error) {
      console.error("Error fetching guest:", error);

      return res.status(500).json({
        error: "Failed to fetch guest",
      });
    }
  },
);

// ============================================================
// POST /guests/reservations
// Create guest + reservation in one operation
// ============================================================

guestsRouter.post(
  "/reservations",
  authenticateToken,
  requireRole("SUPER_ADMIN", "ORG_ADMIN", "OPERATIONS", "RECEPTION"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const {
        siteId,
        name,
        email,
        phone,
        roomId,
        checkIn,
        checkOut,
        notes,
      } = req.body;

      // --------------------------------------------------------
      // Required fields
      // --------------------------------------------------------

      if (
        !siteId ||
        !name ||
        !roomId ||
        !checkIn ||
        !checkOut
      ) {
        return res.status(400).json({
          error:
            "siteId, name, roomId, checkIn and checkOut are required",
        });
      }

      const organizationId =
        req.user!.role === "SUPER_ADMIN"
          ? undefined
          : req.user!.organizationId;

      // --------------------------------------------------------
      // Validate site
      // --------------------------------------------------------

      const site = await prisma.site.findFirst({
        where: {
          id: siteId,
          organizationId,
        },
      });

      if (!site) {
        return res.status(404).json({
          error: "Site not found",
        });
      }

      // --------------------------------------------------------
      // Validate room
      // --------------------------------------------------------

      const room = await prisma.room.findFirst({
        where: {
          id: roomId,
          siteId,
          site: organizationId
            ? {
                organizationId,
              }
            : undefined,
        },
      });

      if (!room) {
        return res.status(404).json({
          error: "Room not found",
        });
      }

      // --------------------------------------------------------
      // Validate dates
      // --------------------------------------------------------

      const start = new Date(checkIn);
      const end = new Date(checkOut);

      if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end <= start
      ) {
        return res.status(400).json({
          error: "Invalid check-in/check-out dates",
        });
      }

      // --------------------------------------------------------
      // Room availability
      //
      // Adjacent reservations are allowed.
      //
      // Previous:
      //   checkOut = 2026-09-06 14:00
      //
      // New:
      //   checkIn  = 2026-09-06 14:00
      //
      // These do NOT overlap.
      // --------------------------------------------------------

      const overlappingStay =
        await prisma.guestStay.findFirst({
          where: {
            roomId,
            checkIn: {
              lt: end,
            },
            checkOut: {
              gt: start,
            },
            status: {
              not: "CANCELLED",
            },
          },
          include: {
            guest: true,
          },
        });

      if (overlappingStay) {
        return res.status(409).json({
          error:
            "Room is already occupied during the requested dates",
          roomId,
          conflictingStay: {
            id: overlappingStay.id,
            guestId: overlappingStay.guestId,
            guestName: overlappingStay.guest.name,
            checkIn: overlappingStay.checkIn,
            checkOut: overlappingStay.checkOut,
            status: overlappingStay.status,
          },
        });
      }

      // --------------------------------------------------------
      // Create guest + stay atomically
      // --------------------------------------------------------

      const result = await prisma.$transaction(async (tx) => {
        const guest = await tx.guest.create({
          data: {
            siteId,
            name: name.trim(),
            email: email?.trim() || null,
            phone: phone?.trim() || null,
          },
        });

        const stay = await tx.guestStay.create({
          data: {
            guestId: guest.id,
            roomId,
            checkIn: start,
            checkOut: end,
            notes: notes?.trim() || null,
            status: "RESERVED",
          },
          include: {
            room: true,
            wifiAccess: true,
          },
        });

        return {
          guest,
          stay,
        };
      });

      return res.status(201).json(result);
    } catch (error) {
      console.error(
        "Error creating guest reservation:",
        error,
      );

      return res.status(500).json({
        error: "Failed to create guest reservation",
      });
    }
  },
);

// ============================================================
// POST /guests
// ============================================================

guestsRouter.post(
  "/",
  authenticateToken,
  requireRole("SUPER_ADMIN", "ORG_ADMIN", "OPERATIONS", "RECEPTION"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const {
        siteId,
        name,
        email,
        phone,
      } = req.body;

      if (!siteId || !name) {
        return res.status(400).json({
          error: "siteId and name are required",
        });
      }

      const organizationId =
        req.user!.role === "SUPER_ADMIN"
          ? undefined
          : req.user!.organizationId;

      const site = await prisma.site.findFirst({
        where: {
          id: siteId,
          organizationId,
        },
      });

      if (!site) {
        return res.status(404).json({
          error: "Site not found",
        });
      }

      const guest = await prisma.guest.create({
        data: {
          siteId,
          name,
          email: email || null,
          phone: phone || null,
        },
      });

      return res.status(201).json(guest);
    } catch (error) {
      console.error("Error creating guest:", error);

      return res.status(500).json({
        error: "Failed to create guest",
      });
    }
  },
);

// ============================================================
// POST /guests/:id/stays
// ============================================================

guestsRouter.post(
  "/:id/stays",
  authenticateToken,
  requireRole("SUPER_ADMIN", "ORG_ADMIN", "OPERATIONS", "RECEPTION"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const guestId = req.params.id as string;

      const {
        roomId,
        checkIn,
        checkOut,
        notes,
      } = req.body;

      if (!roomId || !checkIn || !checkOut) {
        return res.status(400).json({
          error: "roomId, checkIn and checkOut are required",
        });
      }

      const organizationId =
        req.user!.role === "SUPER_ADMIN"
          ? undefined
          : req.user!.organizationId;

      const guest = await prisma.guest.findFirst({
        where: {
          id: guestId,
          site: organizationId
            ? {
                organizationId,
              }
            : undefined,
        },
      });

      if (!guest) {
        return res.status(404).json({
          error: "Guest not found",
        });
      }

      const room = await prisma.room.findFirst({
        where: {
          id: roomId,
          site: organizationId
            ? {
                organizationId,
              }
            : undefined,
        },
      });

      if (!room) {
        return res.status(404).json({
          error: "Room not found",
        });
      }

      if (room.siteId !== guest.siteId) {
        return res.status(400).json({
          error: "Room does not belong to guest site",
        });
      }

      const start = new Date(checkIn);
      const end = new Date(checkOut);

      if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end <= start
      ) {
        return res.status(400).json({
          error: "Invalid check-in/check-out dates",
        });
      }

        // ========================================================
      // ROOM AVAILABILITY
      // Prevent overlapping stays for the same room.
      // Adjacent stays are allowed:
      // previous.checkOut === new.checkIn
      // ========================================================

   const overlappingStay = await prisma.guestStay.findFirst({
  where: {
    roomId,
    checkIn: {
      lt: end,
    },
    checkOut: {
      gt: start,
    },
    status: {
      in: ["RESERVED", "CHECKED_IN"],
    },
  },
  include: {
    guest: true,
  },
});

      if (overlappingStay) {
        return res.status(409).json({
          error: "Room is already occupied during the requested dates",
          roomId,
          conflictingStay: {
            id: overlappingStay.id,
            guestId: overlappingStay.guestId,
            guestName: overlappingStay.guest.name,
            checkIn: overlappingStay.checkIn,
            checkOut: overlappingStay.checkOut,
            status: overlappingStay.status,
          },
        });
      }

      const stay = await prisma.guestStay.create({
        data: {
          guestId,
          roomId,
          checkIn: start,
          checkOut: end,
          notes: notes || null,
        },
        include: {
          guest: true,
          room: true,
          wifiAccess: true,
        },
      });

      return res.status(201).json(stay);
    } catch (error) {
      console.error("Error creating guest stay:", error);

      return res.status(500).json({
        error: "Failed to create guest stay",
      });
    }
  },
);

// ============================================================
// POST /guests/:guestId/stays/:stayId/checkin
// Register guest check-in
// ============================================================

guestsRouter.post(
  "/:guestId/stays/:stayId/checkin",
  authenticateToken,
  requireRole("SUPER_ADMIN", "ORG_ADMIN", "OPERATIONS", "RECEPTION"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const guestId = req.params.guestId as string;
      const stayId = req.params.stayId as string;

      const organizationId =
        req.user!.role === "SUPER_ADMIN"
          ? undefined
          : req.user!.organizationId;

      const stay = await prisma.guestStay.findFirst({
        where: {
          id: stayId,
          guestId,
          guest: organizationId
            ? {
                site: {
                  organizationId,
                },
              }
            : undefined,
        },
        include: {
          guest: true,
          room: true,
          wifiAccess: true,
        },
      });

      if (!stay) {
        return res.status(404).json({
          error: "Guest stay not found",
        });
      }

      if (stay.status !== "RESERVED") {
        return res.status(409).json({
          error: "Only reserved stays can be checked in",
          status: stay.status,
        });
      }

      const now = new Date();

      // ========================================================
      // CHECK-IN WINDOW
      //
      // Hotel standard check-in: approximately 14:00
      // Maximum early check-in: 5 hours
      // Earliest allowed check-in: 09:00
      //
      // The guest cannot check in before the reservation date.
      // ========================================================

      const scheduledCheckIn = new Date(stay.checkIn);

      if (Number.isNaN(scheduledCheckIn.getTime())) {
        return res.status(400).json({
          error: "Invalid reservation check-in date",
        });
      }

      // Use the calendar date of the reservation.
      // The server runs using the hotel's local date/time.
      const earliestCheckIn = new Date(scheduledCheckIn);

      earliestCheckIn.setHours(9, 0, 0, 0);

      if (now < earliestCheckIn) {
        return res.status(409).json({
          error: "Check-in is not available yet",
          earliestCheckIn,
          scheduledCheckIn: stay.checkIn,
        });
      }

      // ========================================================
      // CHECK-OUT PROTECTION
      // A reservation cannot be checked in after its checkout.
      // ========================================================

      const scheduledCheckOut = new Date(stay.checkOut);

      if (now >= scheduledCheckOut) {
        return res.status(409).json({
          error: "The reservation has already expired",
          checkOut: stay.checkOut,
        });
      }

      // ========================================================
      // CHECK-IN + WIFI ACCESS
      //
      // Check-in is the moment at which Internet access becomes
      // available to the guest.
      //
      // If WiFi access already exists, activate/reuse it.
      // If it does not exist, create it and activate it.
      // ========================================================

      const checkedInStay = await prisma.$transaction(async (tx) => {
        const roomNumber = stay.room.number.replace(/\s+/g, "");
        const guestCode = guestId
          .replace(/-/g, "")
          .slice(0, 6)
          .toUpperCase();

        let wifiAccess = stay.wifiAccess;

        if (!wifiAccess) {
          const token = crypto.randomUUID();

          wifiAccess = await tx.guestWifiAccess.create({
            data: {
              stayId: stay.id,
              token,
              status: "PENDING",
              expiresAt: stay.checkOut,
            },
          });
        }

        const username =
          wifiAccess.username ||
          `H${roomNumber}-${guestCode}`;

        const password =
          wifiAccess.password ||
          `TC180-${crypto
            .randomBytes(4)
            .toString("hex")
            .toUpperCase()}`;

        const accessUrl =
          wifiAccess.accessUrl ||
          `http://localhost:5173/guest-wifi/${wifiAccess.token}`;

        const updatedWifiAccess =
          await tx.guestWifiAccess.update({
            where: {
              id: wifiAccess.id,
            },
            data: {
              username,
              password,
              accessUrl,
              status: "ACTIVE",
              activatedAt:
                wifiAccess.activatedAt || now,
              deactivatedAt: null,
              expiresAt: stay.checkOut,
            },
          });

        const updatedStay = await tx.guestStay.update({
          where: {
            id: stay.id,
          },
          data: {
            status: "CHECKED_IN",
            actualCheckIn: now,
          },
          include: {
            guest: true,
            room: true,
            wifiAccess: true,
          },
        });

        await tx.room.update({
          where: {
            id: stay.roomId,
          },
          data: {
            status: "OCCUPIED",
          },
        });

        return {
          ...updatedStay,
          wifiAccess: updatedWifiAccess,
        };
      });

      return res.json(checkedInStay);
    } catch (error) {
      console.error("Error checking in guest:", error);

      return res.status(500).json({
        error: "Failed to check in guest",
      });
    }
  },
);

// ============================================================
// POST /guests/:guestId/stays/:stayId/cancel
// Cancel guest stay
// ============================================================

guestsRouter.post(
  "/:guestId/stays/:stayId/cancel",
  authenticateToken,
  requireRole("SUPER_ADMIN", "ORG_ADMIN", "OPERATIONS", "RECEPTION"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const guestId = req.params.guestId as string;
      const stayId = req.params.stayId as string;

      const organizationId =
        req.user!.role === "SUPER_ADMIN"
          ? undefined
          : req.user!.organizationId;

      const stay = await prisma.guestStay.findFirst({
        where: {
          id: stayId,
          guestId,
          guest: organizationId
            ? {
                site: {
                  organizationId,
                },
              }
            : undefined,
        },
        include: {
          guest: true,
          room: true,
          wifiAccess: true,
        },
      });

      if (!stay) {
        return res.status(404).json({
          error: "Guest stay not found",
        });
      }

      if (stay.status !== "RESERVED") {
        return res.status(409).json({
          error: "Only reserved stays can be cancelled",
          status: stay.status,
        });
      }

      const now = new Date();

      const cancelledStay = await prisma.$transaction(async (tx) => {
        if (stay.wifiAccess) {
          await tx.guestWifiAccess.update({
            where: {
              id: stay.wifiAccess.id,
            },
            data: {
              status: "DISABLED",
              deactivatedAt: now,
            },
          });
        }

        return tx.guestStay.update({
          where: {
            id: stay.id,
          },
          data: {
            status: "CANCELLED",
          },
          include: {
            guest: true,
            room: true,
            wifiAccess: true,
          },
        });
      });

      return res.json(cancelledStay);
    } catch (error) {
      console.error("Error cancelling guest stay:", error);

      return res.status(500).json({
        error: "Failed to cancel guest stay",
      });
    }
  },
);

// ============================================================
// POST /guests/:guestId/stays/:stayId/checkout
// Register guest checkout
// ============================================================

guestsRouter.post(
  "/:guestId/stays/:stayId/checkout",
  authenticateToken,
  requireRole("SUPER_ADMIN", "ORG_ADMIN", "OPERATIONS", "RECEPTION"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const guestId = req.params.guestId as string;
      const stayId = req.params.stayId as string;

      const organizationId =
        req.user!.role === "SUPER_ADMIN"
          ? undefined
          : req.user!.organizationId;

      const stay = await prisma.guestStay.findFirst({
        where: {
          id: stayId,
          guestId,
          guest: organizationId
            ? {
                site: {
                  organizationId,
                },
              }
            : undefined,
        },
        include: {
          guest: true,
          room: true,
          wifiAccess: true,
        },
      });

      if (!stay) {
        return res.status(404).json({
          error: "Guest stay not found",
        });
      }

      if (stay.status !== "CHECKED_IN") {
        return res.status(409).json({
          error: "Only checked-in stays can be checked out",
          status: stay.status,
        });
      }

      const now = new Date();

      const checkedOutStay = await prisma.$transaction(async (tx) => {
        if (stay.wifiAccess) {
          await tx.guestWifiAccess.update({
            where: {
              id: stay.wifiAccess.id,
            },
            data: {
              status: "DISABLED",
              deactivatedAt: now,
            },
          });
        }

        await tx.room.update({
          where: {
            id: stay.roomId,
          },
          data: {
            status: "CLEANING",
          },
        });

        return tx.guestStay.update({
          where: {
            id: stay.id,
          },
          data: {
            status: "CHECKED_OUT",
            actualCheckOut: now,
          },
          include: {
            guest: true,
            room: true,
            wifiAccess: true,
          },
        });
      });

      return res.json(checkedOutStay);
    } catch (error) {
      console.error("Error checking out guest:", error);

      return res.status(500).json({
        error: "Failed to check out guest",
      });
    }
  },
);

// ============================================================
// POST /guests/:guestId/stays/:stayId/wifi
// ============================================================

guestsRouter.post(
  "/:guestId/stays/:stayId/wifi",
  authenticateToken,
  requireRole("SUPER_ADMIN", "ORG_ADMIN", "OPERATIONS", "RECEPTION"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const guestId = req.params.guestId as string;
      const stayId = req.params.stayId as string;

      const organizationId =
        req.user!.role === "SUPER_ADMIN"
          ? undefined
          : req.user!.organizationId;

      const stay = await prisma.guestStay.findFirst({
        where: {
          id: stayId,
          guestId,
          guest: organizationId
            ? {
                site: {
                  organizationId,
                },
              }
            : undefined,
        },
        include: {
          guest: true,
          room: true,
          wifiAccess: true,
        },
      });

      if (!stay) {
        return res.status(404).json({
          error: "Guest stay not found",
        });
      }

      if (stay.wifiAccess) {
        return res.status(409).json({
          error: "WiFi access already exists for this stay",
          wifiAccess: stay.wifiAccess,
        });
      }

      const token = crypto.randomUUID();

      const wifiAccess = await prisma.guestWifiAccess.create({
        data: {
          stayId: stay.id,
          token,
          status: "PENDING",
          expiresAt: stay.checkOut,
        },
      });

      return res.status(201).json({
        wifiAccess,
        guest: stay.guest,
        room: stay.room,
        stay: {
          id: stay.id,
          checkIn: stay.checkIn,
          checkOut: stay.checkOut,
          status: stay.status,
        },
      });
    } catch (error) {
      console.error("Error creating guest WiFi access:", error);

      return res.status(500).json({
        error: "Failed to create guest WiFi access",
      });
    }
  },
);

// ============================================================
// POST /guests/:guestId/stays/:stayId/wifi/activate
// ============================================================

guestsRouter.post(
  "/:guestId/stays/:stayId/wifi/activate",
  authenticateToken,
  requireRole("SUPER_ADMIN", "ORG_ADMIN", "OPERATIONS", "RECEPTION"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const guestId = req.params.guestId as string;
      const stayId = req.params.stayId as string;

      const organizationId =
        req.user!.role === "SUPER_ADMIN"
          ? undefined
          : req.user!.organizationId;

      const stay = await prisma.guestStay.findFirst({
        where: {
          id: stayId,
          guestId,
          guest: organizationId
            ? {
                site: {
                  organizationId,
                },
              }
            : undefined,
        },
        include: {
          guest: true,
          room: true,
          wifiAccess: true,
        },
      });

      if (!stay) {
        return res.status(404).json({
          error: "Guest stay not found",
        });
      }

      if (!stay.wifiAccess) {
        return res.status(404).json({
          error: "WiFi access has not been created for this stay",
        });
      }

      if (stay.wifiAccess.status === "ACTIVE") {
        return res.status(409).json({
          error: "WiFi access is already active",
          wifiAccess: stay.wifiAccess,
        });
      }

      const now = new Date();

      if (stay.wifiAccess.expiresAt <= now) {
        return res.status(400).json({
          error: "WiFi access has already expired",
        });
      }

      // ========================================================
      // DEMO CREDENTIALS
      // ========================================================

      const roomNumber = stay.room.number.replace(/\s+/g, "");
      const guestCode = guestId.replace(/-/g, "").slice(0, 6).toUpperCase();

      const username = `H${roomNumber}-${guestCode}`;
      const password = `TC180-${crypto
        .randomBytes(4)
        .toString("hex")
        .toUpperCase()}`;

      const accessUrl = `http://localhost:5173/guest-wifi/${stay.wifiAccess.token}`;

      const wifiAccess = await prisma.guestWifiAccess.update({
        where: {
          id: stay.wifiAccess.id,
        },
        data: {
          username,
          password,
          accessUrl,
          status: "ACTIVE",
          activatedAt: now,
          deactivatedAt: null,
          expiresAt: stay.checkOut,
        },
      });

      return res.json({
        wifiAccess,
        guest: stay.guest,
        room: stay.room,
        stay: {
          id: stay.id,
          checkIn: stay.checkIn,
          checkOut: stay.checkOut,
          status: stay.status,
        },
        mode: "DEMO",
      });
    } catch (error) {
      console.error("Error activating guest WiFi access:", error);

      return res.status(500).json({
        error: "Failed to activate guest WiFi access",
      });
    }
  },
);

export { guestsRouter };