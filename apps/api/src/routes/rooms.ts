import { Router } from "express";
import { prisma } from "../lib/prisma";


const roomsRouter = Router();

// GET /rooms
// GET /rooms?siteId=xxx
roomsRouter.get("/", async (req, res) => {
  try {
    const siteId = req.query.siteId as string | undefined;

    const rooms = await prisma.room.findMany({
      where: siteId ? { siteId } : undefined,
      include: {
        site: true,
        area: true,
      },
      orderBy: {
        number: "asc",
      },
    });

    res.json(rooms);
  } catch (error) {
    console.error("Error fetching rooms:", error);
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
});
// GET /rooms/:id
roomsRouter.get("/:id", async (req, res) => {
  try {
    const room = await prisma.room.findUnique({
      where: {
        id: req.params.id,
      },
      include: {
        site: true,
        area: true,
        tickets: true,
      },
    });

    if (!room) {
      return res.status(404).json({
        error: "Room not found",
      });
    }

    res.json(room);
  } catch (error) {
    console.error("Error fetching room:", error);
    res.status(500).json({ error: "Failed to fetch room" });
  }
});
// PATCH /rooms/:id
roomsRouter.patch("/:id", async (req, res) => {
  try {
    const { number, floor, status, areaId } = req.body;
const validStatuses = [
  "AVAILABLE",
  "OCCUPIED",
  "MAINTENANCE",
  "CLEANING",
];

if (status !== undefined && !validStatuses.includes(status)) {
  return res.status(400).json({
    error: "Invalid room status",
    validStatuses,
  });
}
    const room = await prisma.room.update({
      where: {
        id: req.params.id,
      },
      data: {
        ...(number !== undefined && { number }),
        ...(floor !== undefined && { floor }),
        ...(status !== undefined && { status }),
        ...(areaId !== undefined && { areaId }),
      },
      include: {
        site: true,
        area: true,
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
        error: "A room with this number already exists in this site",
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

    res.status(500).json({ error: "Failed to update room" });
  }
});
// DELETE /rooms/:id
roomsRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.room.delete({
      where: {
        id: req.params.id,
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
        error: "Room cannot be deleted because it has related records",
      });
    }

    res.status(500).json({ error: "Failed to delete room" });
  }
});
// POST /rooms
roomsRouter.post("/", async (req, res) => {
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

    const room = await prisma.room.create({
      data: {
        siteId,
        areaId,
        number,
        floor,
        status,
      },
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
        error: "A room with this number already exists in this site",
      });
    }

    res.status(500).json({ error: "Failed to create room" });
  }
});

export { roomsRouter };