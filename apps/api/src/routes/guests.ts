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
// HELPERS
// ============================================================

/**
 * Obtiene la organización permitida para el usuario.
 *
 * SUPER_ADMIN:
 *   undefined = puede acceder a cualquier organización.
 *
 * Otros roles:
 *   quedan limitados a su organización.
 */
function getOrganizationId(
  req: AuthenticatedRequest,
): string | undefined {
  return req.user!.role === "SUPER_ADMIN"
    ? undefined
    : req.user!.organizationId;
}

/**
 * Estados que realmente bloquean una habitación
 * dentro del calendario de reservaciones.
 *
 * CHECKED_OUT y CANCELLED liberan la habitación.
 */
const blockingStayStatuses = [
  "RESERVED",
  "CHECKED_IN",
] as const;

/**
 * Busca una estancia que se traslape con el intervalo solicitado.
 *
 * Regla:
 *
 * existing.checkIn < requested.checkOut
 * AND
 * existing.checkOut > requested.checkIn
 *
 * Esto permite reservas adyacentes:
 *
 * anterior: 01/09 14:00 → 05/09 12:00
 * nueva:    05/09 14:00 → 08/09 12:00
 */
async function findOverlappingStay(
  roomId: string,
  start: Date,
  end: Date,
) {
  return prisma.guestStay.findFirst({
    where: {
      roomId,
      checkIn: {
        lt: end,
      },
      checkOut: {
        gt: start,
      },
      status: {
        in: [...blockingStayStatuses],
      },
    },
    include: {
      guest: true,
    },
  });
}

/**
 * Valida y convierte las fechas recibidas desde HTTP.
 */
function parseStayDates(
  checkIn: unknown,
  checkOut: unknown,
) {
  if (
    typeof checkIn !== "string" ||
    typeof checkOut !== "string"
  ) {
    return null;
  }

  const start = new Date(checkIn);
  const end = new Date(checkOut);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  ) {
    return null;
  }

  return {
    start,
    end,
  };
}

// ============================================================
// GET /guests
// ============================================================

guestsRouter.get(
  "/",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "OPERATIONS",
    "RECEPTION",
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const siteId =
        typeof req.query.siteId === "string"
          ? req.query.siteId
          : undefined;

      const organizationId = getOrganizationId(req);

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
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "OPERATIONS",
    "RECEPTION",
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const guestId = req.params.id as string;

      const organizationId = getOrganizationId(req);

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
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "OPERATIONS",
    "RECEPTION",
  ),
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

      const organizationId = getOrganizationId(req);

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

      const dates = parseStayDates(
        checkIn,
        checkOut,
      );

      if (!dates) {
        return res.status(400).json({
          error: "Invalid check-in/check-out dates",
        });
      }

      const { start, end } = dates;

      // --------------------------------------------------------
      // Create guest + stay atomically.
      //
      // Availability is checked inside the transaction so the
      // reservation check and creation belong to the same DB
      // operation.
      // --------------------------------------------------------

      const result = await prisma.$transaction(
        async (tx) => {
          const overlappingStay =
            await tx.guestStay.findFirst({
              where: {
                roomId,
                checkIn: {
                  lt: end,
                },
                checkOut: {
                  gt: start,
                },
                status: {
                  in: [...blockingStayStatuses],
                },
              },
              include: {
                guest: true,
              },
            });

          if (overlappingStay) {
            const error = new Error(
              "ROOM_ALREADY_RESERVED",
            );

            (
              error as Error & {
                conflictingStay?: unknown;
              }
            ).conflictingStay = overlappingStay;

            throw error;
          }

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
        },
      );

      return res.status(201).json(result);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "ROOM_ALREADY_RESERVED"
      ) {
        const conflictingStay = (
          error as Error & {
            conflictingStay?: {
              id: string;
              guestId: string;
              guest: {
                name: string;
              };
              checkIn: Date;
              checkOut: Date;
              status: string;
            };
          }
        ).conflictingStay;

        return res.status(409).json({
          error:
            "Room is already occupied during the requested dates",
          roomId: req.body.roomId,
          conflictingStay: conflictingStay
            ? {
                id: conflictingStay.id,
                guestId: conflictingStay.guestId,
                guestName:
                  conflictingStay.guest.name,
                checkIn:
                  conflictingStay.checkIn,
                checkOut:
                  conflictingStay.checkOut,
                status:
                  conflictingStay.status,
              }
            : undefined,
        });
      }

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
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "OPERATIONS",
    "RECEPTION",
  ),
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

      const organizationId = getOrganizationId(req);

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
          name: name.trim(),
          email: email?.trim() || null,
          phone: phone?.trim() || null,
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
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "OPERATIONS",
    "RECEPTION",
  ),
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
          error:
            "roomId, checkIn and checkOut are required",
        });
      }

      const organizationId = getOrganizationId(req);

      // --------------------------------------------------------
      // Validate guest
      // --------------------------------------------------------

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

      // --------------------------------------------------------
      // Validate room
      // --------------------------------------------------------

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

      // --------------------------------------------------------
      // Validate dates
      // --------------------------------------------------------

      const dates = parseStayDates(
        checkIn,
        checkOut,
      );

      if (!dates) {
        return res.status(400).json({
          error: "Invalid check-in/check-out dates",
        });
      }

      const { start, end } = dates;

      // --------------------------------------------------------
      // Availability + creation
      // --------------------------------------------------------

      const stay = await prisma.$transaction(
        async (tx) => {
          const overlappingStay =
            await tx.guestStay.findFirst({
              where: {
                roomId,
                checkIn: {
                  lt: end,
                },
                checkOut: {
                  gt: start,
                },
                status: {
                  in: [...blockingStayStatuses],
                },
              },
              include: {
                guest: true,
              },
            });

          if (overlappingStay) {
            const error = new Error(
              "ROOM_ALREADY_RESERVED",
            );

            (
              error as Error & {
                conflictingStay?: unknown;
              }
            ).conflictingStay = overlappingStay;

            throw error;
          }

          return tx.guestStay.create({
            data: {
              guestId,
              roomId,
              checkIn: start,
              checkOut: end,
              notes: notes?.trim() || null,
              status: "RESERVED",
            },
            include: {
              guest: true,
              room: true,
              wifiAccess: true,
            },
          });
        },
      );

      return res.status(201).json(stay);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "ROOM_ALREADY_RESERVED"
      ) {
        const conflictingStay = (
          error as Error & {
            conflictingStay?: {
              id: string;
              guestId: string;
              guest: {
                name: string;
              };
              checkIn: Date;
              checkOut: Date;
              status: string;
            };
          }
        ).conflictingStay;

        return res.status(409).json({
          error:
            "Room is already occupied during the requested dates",
          roomId: req.body.roomId,
          conflictingStay: conflictingStay
            ? {
                id: conflictingStay.id,
                guestId: conflictingStay.guestId,
                guestName:
                  conflictingStay.guest.name,
                checkIn:
                  conflictingStay.checkIn,
                checkOut:
                  conflictingStay.checkOut,
                status:
                  conflictingStay.status,
              }
            : undefined,
        });
      }

      console.error(
        "Error creating guest stay:",
        error,
      );

      return res.status(500).json({
        error: "Failed to create guest stay",
      });
    }
  },
);

// ============================================================
// POST /guests/:guestId/stays/:stayId/checkin
// ============================================================

guestsRouter.post(
  "/:guestId/stays/:stayId/checkin",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "OPERATIONS",
    "RECEPTION",
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const guestId = req.params.guestId as string;
      const stayId = req.params.stayId as string;

      const organizationId = getOrganizationId(req);

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
          error:
            "Only reserved stays can be checked in",
          status: stay.status,
        });
      }

      const now = new Date();

      // --------------------------------------------------------
      // Check-in window
      // --------------------------------------------------------

      const scheduledCheckIn =
        new Date(stay.checkIn);

      if (Number.isNaN(scheduledCheckIn.getTime())) {
        return res.status(400).json({
          error:
            "Invalid reservation check-in date",
        });
      }

      const earliestCheckIn =
        new Date(scheduledCheckIn);

      earliestCheckIn.setHours(9, 0, 0, 0);

      if (now < earliestCheckIn) {
        return res.status(409).json({
          error: "Check-in is not available yet",
          earliestCheckIn,
          scheduledCheckIn: stay.checkIn,
        });
      }

      // --------------------------------------------------------
      // Reservation expiration
      // --------------------------------------------------------

      const scheduledCheckOut =
        new Date(stay.checkOut);

      if (now >= scheduledCheckOut) {
        return res.status(409).json({
          error:
            "The reservation has already expired",
          checkOut: stay.checkOut,
        });
      }

      // --------------------------------------------------------
      // Check room physical status
      //
      // A room can be reserved while CLEANING or
      // MAINTENANCE for a future date, but it should
      // not be checked in until it is operational.
      // --------------------------------------------------------

      if (
        stay.room.status === "MAINTENANCE" ||
        stay.room.status === "CLEANING"
      ) {
        return res.status(409).json({
          error:
            "Room is not ready for check-in",
          roomStatus: stay.room.status,
        });
      }

      // --------------------------------------------------------
      // Check-in + WiFi
      // --------------------------------------------------------

      const checkedInStay =
        await prisma.$transaction(async (tx) => {
          const roomNumber =
            stay.room.number.replace(/\s+/g, "");

          const guestCode = guestId
            .replace(/-/g, "")
            .slice(0, 6)
            .toUpperCase();

          let wifiAccess = stay.wifiAccess;

          if (!wifiAccess) {
            const token = crypto.randomUUID();

            wifiAccess =
              await tx.guestWifiAccess.create({
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

          const updatedStay =
            await tx.guestStay.update({
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
      console.error(
        "Error checking in guest:",
        error,
      );

      return res.status(500).json({
        error: "Failed to check in guest",
      });
    }
  },
);

// ============================================================
// POST /guests/:guestId/stays/:stayId/cancel
// ============================================================

guestsRouter.post(
  "/:guestId/stays/:stayId/cancel",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "OPERATIONS",
    "RECEPTION",
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const guestId = req.params.guestId as string;
      const stayId = req.params.stayId as string;

      const organizationId = getOrganizationId(req);

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
          error:
            "Only reserved stays can be cancelled",
          status: stay.status,
        });
      }

      const now = new Date();

      const cancelledStay =
        await prisma.$transaction(async (tx) => {
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
      console.error(
        "Error cancelling guest stay:",
        error,
      );

      return res.status(500).json({
        error: "Failed to cancel guest stay",
      });
    }
  },
);

// ============================================================
// POST /guests/:guestId/stays/:stayId/checkout
// ============================================================

guestsRouter.post(
  "/:guestId/stays/:stayId/checkout",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "OPERATIONS",
    "RECEPTION",
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const guestId = req.params.guestId as string;
      const stayId = req.params.stayId as string;

      const organizationId = getOrganizationId(req);

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
          error:
            "Only checked-in stays can be checked out",
          status: stay.status,
        });
      }

      const now = new Date();

      const checkedOutStay =
        await prisma.$transaction(async (tx) => {
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
      console.error(
        "Error checking out guest:",
        error,
      );

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
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "OPERATIONS",
    "RECEPTION",
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const guestId = req.params.guestId as string;
      const stayId = req.params.stayId as string;

      const organizationId = getOrganizationId(req);

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
          error:
            "WiFi access already exists for this stay",
          wifiAccess: stay.wifiAccess,
        });
      }

      const token = crypto.randomUUID();

      const wifiAccess =
        await prisma.guestWifiAccess.create({
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
      console.error(
        "Error creating guest WiFi access:",
        error,
      );

      return res.status(500).json({
        error:
          "Failed to create guest WiFi access",
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
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "OPERATIONS",
    "RECEPTION",
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const guestId = req.params.guestId as string;
      const stayId = req.params.stayId as string;

      const organizationId = getOrganizationId(req);

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
          error:
            "WiFi access has not been created for this stay",
        });
      }

      if (stay.wifiAccess.status === "ACTIVE") {
        return res.status(409).json({
          error:
            "WiFi access is already active",
          wifiAccess: stay.wifiAccess,
        });
      }

      const now = new Date();

      if (stay.wifiAccess.expiresAt <= now) {
        return res.status(400).json({
          error: "WiFi access has already expired",
        });
      }

      // --------------------------------------------------------
      // DEMO CREDENTIALS
      // --------------------------------------------------------

      const roomNumber =
        stay.room.number.replace(/\s+/g, "");

      const guestCode = guestId
        .replace(/-/g, "")
        .slice(0, 6)
        .toUpperCase();

      const username =
        `H${roomNumber}-${guestCode}`;

      const password =
        `TC180-${crypto
          .randomBytes(4)
          .toString("hex")
          .toUpperCase()}`;

      const accessUrl =
        `http://localhost:5173/guest-wifi/${stay.wifiAccess.token}`;

      const wifiAccess =
        await prisma.guestWifiAccess.update({
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
      console.error(
        "Error activating guest WiFi access:",
        error,
      );

      return res.status(500).json({
        error:
          "Failed to activate guest WiFi access",
      });
    }
  },
);

// ============================================================
// GET /guests/wifi/public/:token
// Public guest WiFi access
// ============================================================

guestsRouter.get(
  "/wifi/public/:token",
  async (req, res) => {
    try {
      const token =
        req.params.token as string;

      const wifiAccess =
        await prisma.guestWifiAccess.findUnique({
          where: {
            token,
          },
          include: {
            stay: {
              include: {
                guest: true,
                room: true,
              },
            },
          },
        });

      if (!wifiAccess) {
        return res.status(404).json({
          error: "WiFi access not found",
        });
      }

      const now = new Date();

      if (
        wifiAccess.status !== "ACTIVE" ||
        wifiAccess.expiresAt <= now ||
        wifiAccess.stay.status !== "CHECKED_IN"
      ) {
        return res.status(410).json({
          error: "WiFi access is no longer available",
        });
      }

      return res.json({
        guest: {
          name: wifiAccess.stay.guest.name,
        },
        room: {
          number: wifiAccess.stay.room.number,
        },
        wifi: {
          username: wifiAccess.username,
          password: wifiAccess.password,
          expiresAt: wifiAccess.expiresAt,
        },
      });
    } catch (error) {
      console.error(
        "Error fetching public guest WiFi access:",
        error,
      );

      return res.status(500).json({
        error: "Failed to fetch WiFi access",
      });
    }
  },
);

export { guestsRouter };