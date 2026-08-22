import { Router } from "express";
import bcrypt from "bcryptjs";
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
] as const;

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

function isValidRole(role: unknown): role is (typeof validRoles)[number] {
  return (
    typeof role === "string" &&
    validRoles.includes(role as (typeof validRoles)[number])
  );
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
        typeof req.query.organizationId === "string"
          ? req.query.organizationId
          : undefined;

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
        where: organizationId
          ? { organizationId }
          : undefined,
        select: userSelect,
        orderBy: {
          name: "asc",
        },
      });

      return res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);

      return res.status(500).json({
        error: "Failed to fetch users",
      });
    }
  },
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

      return res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);

      return res.status(500).json({
        error: "Failed to fetch user",
      });
    }
  },
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

      if (!isValidRole(role)) {
        return res.status(400).json({
          error: "Invalid user role",
          validRoles,
        });
      }

      if (
        req.user!.role === "ORG_ADMIN" &&
        role === "SUPER_ADMIN"
      ) {
        return res.status(403).json({
          error: "ORG_ADMIN cannot create SUPER_ADMIN users",
        });
      }

      if (!canAccessOrganization(req, organizationId)) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      const normalizedEmail = String(email)
        .trim()
        .toLowerCase();

      const password = String(passwordHash);

      const hashedPassword = await bcrypt.hash(
        password,
        10,
      );

      const user = await prisma.user.create({
        data: {
          organizationId,
          name: String(name).trim(),
          email: normalizedEmail,
          passwordHash: hashedPassword,
          phone: phone ? String(phone).trim() : null,
          role,
        },
        select: userSelect,
      });

      return res.status(201).json(user);
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

      return res.status(500).json({
        error: "Failed to create user",
      });
    }
  },
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
          id: true,
          organizationId: true,
          role: true,
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
          existingUser.organizationId,
        )
      ) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      // ORG_ADMIN no puede modificar un SUPER_ADMIN.
      if (
        req.user!.role === "ORG_ADMIN" &&
        existingUser.role === "SUPER_ADMIN"
      ) {
        return res.status(403).json({
          error: "ORG_ADMIN cannot modify SUPER_ADMIN users",
        });
      }

      if (role !== undefined && !isValidRole(role)) {
        return res.status(400).json({
          error: "Invalid user role",
          validRoles,
        });
      }

      // ORG_ADMIN no puede asignar SUPER_ADMIN.
      if (
        req.user!.role === "ORG_ADMIN" &&
        role === "SUPER_ADMIN"
      ) {
        return res.status(403).json({
          error: "ORG_ADMIN cannot assign SUPER_ADMIN role",
        });
      }

      // Un ORG_ADMIN no puede convertir otro usuario
      // en SUPER_ADMIN ni modificar uno que ya lo sea.
      if (
        req.user!.role === "ORG_ADMIN" &&
        existingUser.role === "SUPER_ADMIN"
      ) {
        return res.status(403).json({
          error: "ORG_ADMIN cannot modify SUPER_ADMIN users",
        });
      }

      const data: Record<string, unknown> = {};

      if (name !== undefined) {
        data.name = String(name).trim();
      }

      if (email !== undefined) {
        data.email = String(email).trim().toLowerCase();
      }

      if (phone !== undefined) {
        data.phone = phone
          ? String(phone).trim()
          : null;
      }

      if (role !== undefined) {
        data.role = role;
      }

      if (active !== undefined) {
        data.active = Boolean(active);
      }

      if (lastLogin !== undefined) {
        data.lastLogin = new Date(lastLogin);
      }

      // ========================================================
      // CONTRASEÑA
      // El frontend manda la contraseña nueva en passwordHash,
      // pero aquí la convertimos a bcrypt antes de guardarla.
      // ========================================================

      if (
        passwordHash !== undefined &&
        String(passwordHash).trim() !== ""
      ) {
        data.passwordHash = await bcrypt.hash(
          String(passwordHash),
          10,
        );
      }

      const user = await prisma.user.update({
        where: {
          id: userId,
        },
        data,
        select: userSelect,
      });

      return res.json(user);
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

      return res.status(500).json({
        error: "Failed to update user",
      });
    }
  },
);

// ============================================================
// DELETE /users/:id
// Soft delete
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
          id: true,
          organizationId: true,
          role: true,
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
          existingUser.organizationId,
        )
      ) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      // Nunca permitir desactivar el propio usuario.
      if (existingUser.id === req.user!.userId) {
        return res.status(400).json({
          error: "You cannot deactivate your own user",
        });
      }

      // ORG_ADMIN no puede desactivar SUPER_ADMIN.
      if (
        req.user!.role === "ORG_ADMIN" &&
        existingUser.role === "SUPER_ADMIN"
      ) {
        return res.status(403).json({
          error: "ORG_ADMIN cannot deactivate SUPER_ADMIN users",
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

      return res.json(user);
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

      return res.status(500).json({
        error: "Failed to deactivate user",
      });
    }
  },
);

export { usersRouter };