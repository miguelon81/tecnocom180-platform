import { Router } from "express";
import { prisma } from "../lib/prisma";

const usersRouter = Router();

const validRoles = [
  "SUPER_ADMIN",
  "ORG_ADMIN",
  "RECEPTION",
  "TECHNICIAN",
];

// GET /users
// GET /users?organizationId=xxx
usersRouter.get("/", async (req, res) => {
  try {
    const organizationId = req.query.organizationId as string | undefined;

    const users = await prisma.user.findMany({
      where: organizationId ? { organizationId } : undefined,
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
        organization: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// GET /users/:id
usersRouter.get("/:id", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: req.params.id,
      },
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
        organization: true,
        assignedTickets: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// POST /users
usersRouter.post("/", async (req, res) => {
  try {
    const {
      organizationId,
      name,
      email,
      passwordHash,
      phone,
      role,
    } = req.body;

    if (!organizationId || !name || !email || !passwordHash || !role) {
      return res.status(400).json({
        error:
          "organizationId, name, email, passwordHash and role are required",
      });
    }

    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: "Invalid user role",
        validRoles,
      });
    }

    const user = await prisma.user.create({
      data: {
        organizationId,
        name,
        email,
        passwordHash,
        phone,
        role,
      },
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
        organization: true,
      },
    });

    res.status(201).json(user);
  } catch (error) {
    console.error("Error creating user:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        error: "A user with this email already exists",
      });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2003"
    ) {
      return res.status(409).json({
        error: "Organization not found",
      });
    }

    res.status(500).json({ error: "Failed to create user" });
  }
});

// PATCH /users/:id
usersRouter.patch("/:id", async (req, res) => {
  try {
    const {
      name,
      email,
      passwordHash,
      phone,
      role,
      active,
      lastLogin,
    } = req.body;

    if (role !== undefined && !validRoles.includes(role)) {
      return res.status(400).json({
        error: "Invalid user role",
        validRoles,
      });
    }

    const user = await prisma.user.update({
      where: {
        id: req.params.id,
      },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(passwordHash !== undefined && { passwordHash }),
        ...(phone !== undefined && { phone }),
        ...(role !== undefined && { role }),
        ...(active !== undefined && { active }),
        ...(lastLogin !== undefined && {
          lastLogin: new Date(lastLogin),
        }),
      },
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
        organization: true,
      },
    });

    res.json(user);
  } catch (error) {
    console.error("Error updating user:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        error: "A user with this email already exists",
      });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    res.status(500).json({ error: "Failed to update user" });
  }
});

// DELETE /users/:id
// Soft delete: preserves history
usersRouter.delete("/:id", async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: {
        id: req.params.id,
      },
      data: {
        active: false,
      },
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
    });

    res.json(user);
  } catch (error) {
    console.error("Error deactivating user:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    res.status(500).json({ error: "Failed to deactivate user" });
  }
});

export { usersRouter };