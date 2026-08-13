import { Router } from "express";
import { prisma } from "../lib/prisma";

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

// GET /tickets
ticketsRouter.get("/", async (_req, res) => {
  try {
    const tickets = await prisma.ticket.findMany({
      include: ticketInclude,
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(tickets);
  } catch (error) {
    console.error("Error fetching tickets:", error);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

// GET /tickets/:id
ticketsRouter.get("/:id", async (req, res) => {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: {
        id: req.params.id,
      },
      include: ticketInclude,
    });

    if (!ticket) {
      return res.status(404).json({
        error: "Ticket not found",
      });
    }

    res.json(ticket);
  } catch (error) {
    console.error("Error fetching ticket:", error);
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
});

// POST /tickets
ticketsRouter.post("/", async (req, res) => {
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

    const ticket = await prisma.ticket.create({
      data: {
        organizationId,
        siteId,
        areaId,
        deviceId,
        roomId,
        assignedToId,
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
      return res.status(404).json({
        error: "Related record not found",
      });
    }

    res.status(500).json({ error: "Failed to create ticket" });
  }
});

// PATCH /tickets/:id
ticketsRouter.patch("/:id", async (req, res) => {
  try {
    const {
      status,
      assignedToId,
      title,
      description,
    } = req.body;

    const validStatuses = [
      "OPEN",
      "PENDING",
      "IN_PROGRESS",
      "RESOLVED",
      "CLOSED",
    ];

    if (status !== undefined && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: "Invalid ticket status",
        validStatuses,
      });
    }

    const ticket = await prisma.ticket.update({
      where: {
        id: req.params.id,
      },
      data: {
        ...(status !== undefined && { status }),
        ...(assignedToId !== undefined && { assignedToId }),
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
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
      return res.status(404).json({
        error: "Related record not found",
      });
    }

    res.status(500).json({ error: "Failed to update ticket" });
  }
});

// DELETE /tickets/:id
ticketsRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.ticket.delete({
      where: {
        id: req.params.id,
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
        error: "Ticket cannot be deleted because it has related records",
      });
    }

    res.status(500).json({ error: "Failed to delete ticket" });
  }
});

export { ticketsRouter };