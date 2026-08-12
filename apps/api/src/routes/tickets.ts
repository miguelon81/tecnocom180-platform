import { Router } from "express";
import { prisma } from "../lib/prisma";

const ticketsRouter = Router();

// GET /tickets
ticketsRouter.get("/", async (_req, res) => {
  try {
    const tickets = await prisma.ticket.findMany({
      include: {
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
      },
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
      include: {
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
      },
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
      include: {
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
      },
    });

    res.status(201).json(ticket);
  } catch (error) {
    console.error("Error creating ticket:", error);
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

    const ticket = await prisma.ticket.update({
      where: {
        id: req.params.id,
      },
      data: {
        status,
        assignedToId,
        title,
        description,
      },
      include: {
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
      },
    });

    res.json(ticket);
  } catch (error) {
    console.error("Error updating ticket:", error);
    res.status(500).json({ error: "Failed to update ticket" });
  }
});

export { ticketsRouter };