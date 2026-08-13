import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  authenticateToken,
  requireRole,
  AuthenticatedRequest,
} from "../middleware/auth";

const usersRouter = Router();

const validRoles = [
  "SUPER_ADMIN",
  "ORG_ADMIN",
  "RECEPTION",
  "TECHNICIAN",
];

const userSelect = {
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

// ============================================================
// GET /users
// GET /users?organizationId=xxx
// ============================================================

usersRouter.get(
  "/",
  authenticateToken,
  requireRole("SUPER_ADMIN", "ORG_ADMIN"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const requestedOrganizationId =
        req.query.organizationId as string | undefined;

      if (
        requestedOrganizationId &&
        !canAccessOrganization(req, requestedOrganizationId)
      ) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      const organizationId =
        requestedOrganizationId ??
        (req.user!.role === "SUPER_ADMIN"
          ? undefined
          : req.user!.organizationId);

      const users = await prisma.user.findMany({
        where: organizationId ? { organizationId } : undefined,
        select: userSelect,
        orderBy: {
          name: "asc",
        },
      });

      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);

      res.status(500).json({
        error: "Failed to fetch users",
      });
    }
  }
);

// ============================================================
// GET /users/:id
// ============================================================

usersRouter.get(
  "/:id",
  authenticateToken,
  requireRole("SUPER_ADMIN", "ORG_ADMIN"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.params.id as string;

      const user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          ...userSelect,
          assignedTickets: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          error: "User not found",
        });
      }

      if (!canAccessOrganization(req, user.organizationId)) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);

      res.status(500).json({
        error: "Failed to fetch user",
      });
    }
  }
);

// ============================================================
// POST /users
// ============================================================

usersRouter.post(
  "/",
  authenticateToken,
  requireRole("SUPER_ADMIN", "ORG_ADMIN"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const {
        organizationId,
        name,
        email,
        passwordHash,
        phone,
        role,
      } = req.body;

      if (
        !organizationId ||
        !name ||
        !email ||
        !passwordHash ||
        !role
      ) {
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

      if (!canAccessOrganization(req, organizationId)) {
        return res.status(403).json({
          error: "Access denied for this organization",
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
        select: userSelect,
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

      res.status(500).json({
        error: "Failed to create user",
      });
    }
  }
);

// ============================================================
// PATCH /users/:id
// ============================================================

usersRouter.patch(
  "/:id",
  authenticateToken,
  requireRole("SUPER_ADMIN", "ORG_ADMIN"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.params.id as string;

      const {
        name,
        email,
        passwordHash,
        phone,
        role,
        active,
        lastLogin,
      } = req.body;

      const existingUser = await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          organizationId: true,
        },
      });

      if (!existingUser) {
        return res.status(404).json({
          error: "User not found",
        });
      }

      if (
        !canAccessOrganization(
          req,
          existingUser.organizationId
        )
      ) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      if (role !== undefined && !validRoles.includes(role)) {
        return res.status(400).json({
          error: "Invalid user role",
          validRoles,
        });
      }

      const user = await prisma.user.update({
        where: {
          id: userId,
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
        select: userSelect,
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

      res.status(500).json({
        error: "Failed to update user",
      });
    }
  }
);

// ============================================================
// DELETE /users/:id
// Soft delete: preserves history
// ============================================================

usersRouter.delete(
  "/:id",
  authenticateToken,
  requireRole("SUPER_ADMIN", "ORG_ADMIN"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.params.id as string;

      const existingUser = await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          organizationId: true,
        },
      });

      if (!existingUser) {
        return res.status(404).json({
          error: "User not found",
        });
      }

      if (
        !canAccessOrganization(
          req,
          existingUser.organizationId
        )
      ) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      const user = await prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          active: false,
        },
        select: userSelect,
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

      res.status(500).json({
        error: "Failed to deactivate user",
      });
    }
  }
);

export { usersRouter };