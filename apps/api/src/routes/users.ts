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
  "OPERATIONS",
  "RECEPTION",
  "TECHNICIAN",
] as const;

type ValidRole = (typeof validRoles)[number];

const siteScopedRoles: ValidRole[] = [
  "RECEPTION",
  "TECHNICIAN",
];

const globalRoles: ValidRole[] = [
  "SUPER_ADMIN",
  "OPERATIONS",
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

  organization: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },

  sites: {
    select: {
      id: true,
      siteId: true,
      createdAt: true,
      site: {
        select: {
          id: true,
          organizationId: true,
          name: true,
          code: true,
          active: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc" as const,
    },
  },
};

function isValidRole(role: unknown): role is ValidRole {
  return (
    typeof role === "string" &&
    validRoles.includes(role as ValidRole)
  );
}

function isSiteScopedRole(role: ValidRole) {
  return siteScopedRoles.includes(role);
}

function isGlobalRole(role: ValidRole) {
  return globalRoles.includes(role);
}

function getSiteIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map((item) => String(item).trim())
        .filter(Boolean),
    ),
  ];
}

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

function canManageTargetRole(
  actorRole: string,
  targetRole: ValidRole,
) {
  if (actorRole === "SUPER_ADMIN") {
    return true;
  }

  if (actorRole === "ORG_ADMIN") {
    return (
      targetRole === "ORG_ADMIN" ||
      targetRole === "RECEPTION" ||
      targetRole === "TECHNICIAN"
    );
  }

  return false;
}

async function validateSitesForOrganization(
  siteIds: string[],
  organizationId: string,
) {
  if (siteIds.length === 0) {
    return {
      valid: true,
      sites: [],
    };
  }

  const sites = await prisma.site.findMany({
    where: {
      id: {
        in: siteIds,
      },
    },
    select: {
      id: true,
      organizationId: true,
      active: true,
    },
  });

  if (sites.length !== siteIds.length) {
    return {
      valid: false,
      error: "One or more sites were not found",
      sites: [],
    };
  }

  const invalidOrganization = sites.some(
    (site) => site.organizationId !== organizationId,
  );

  if (invalidOrganization) {
    return {
      valid: false,
      error: "All assigned sites must belong to the user's organization",
      sites: [],
    };
  }

  return {
    valid: true,
    sites,
  };
}

async function syncUserSites(
  userId: string,
  siteIds: string[],
) {
  await prisma.$transaction(async (tx) => {
    await tx.userSite.deleteMany({
      where: {
        userId,
      },
    });

    if (siteIds.length > 0) {
      await tx.userSite.createMany({
        data: siteIds.map((siteId) => ({
          userId,
          siteId,
        })),
      });
    }
  });
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
        !canAccessOrganization(
          req,
          requestedOrganizationId,
        )
      ) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      if (req.user!.role === "SUPER_ADMIN") {
        const users = await prisma.user.findMany({
          where: requestedOrganizationId
            ? {
                organizationId: requestedOrganizationId,
              }
            : undefined,
          select: userSelect,
          orderBy: {
            name: "asc",
          },
        });

        return res.json(users);
      }

      const organizationId =
        req.user!.organizationId;

      const users = await prisma.user.findMany({
        where: {
          organizationId,
          role: {
            in: [
              "ORG_ADMIN",
              "RECEPTION",
              "TECHNICIAN",
            ],
          },
        },
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
        select: userSelect,
      });

      if (!user) {
        return res.status(404).json({
          error: "User not found",
        });
      }

      if (
        !canAccessOrganization(
          req,
          user.organizationId,
        )
      ) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      if (
        !canManageTargetRole(
          req.user!.role,
          user.role,
        )
      ) {
        return res.status(403).json({
          error: "You cannot access this user",
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
        organizationId: requestedOrganizationId,
        name,
        email,
        passwordHash,
        phone,
        role,
        siteIds: rawSiteIds,
      } = req.body;

      if (
        !name ||
        !email ||
        !passwordHash ||
        !role
      ) {
        return res.status(400).json({
          error:
            "name, email, passwordHash and role are required",
        });
      }

      if (!isValidRole(role)) {
        return res.status(400).json({
          error: "Invalid user role",
          validRoles,
        });
      }

      if (
        !canManageTargetRole(
          req.user!.role,
          role,
        )
      ) {
        return res.status(403).json({
          error:
            "You cannot create users with this role",
        });
      }

      let organizationId: string;

      if (req.user!.role === "SUPER_ADMIN") {
        if (!requestedOrganizationId) {
          return res.status(400).json({
            error:
              "organizationId is required for SUPER_ADMIN",
          });
        }

        organizationId =
          String(requestedOrganizationId);
      } else {
        organizationId =
          req.user!.organizationId;
      }

      if (
        !canAccessOrganization(
          req,
          organizationId,
        )
      ) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      const organization =
        await prisma.organization.findUnique({
          where: {
            id: organizationId,
          },
          select: {
            id: true,
            active: true,
          },
        });

      if (!organization) {
        return res.status(404).json({
          error: "Organization not found",
        });
      }

      const siteIds = getSiteIds(rawSiteIds);

      if (
        isSiteScopedRole(role) &&
        siteIds.length === 0
      ) {
        return res.status(400).json({
          error:
            `${role} must be assigned to at least one site`,
        });
      }

      const siteValidation =
        await validateSitesForOrganization(
          siteIds,
          organizationId,
        );

      if (!siteValidation.valid) {
        return res.status(400).json({
          error: siteValidation.error,
        });
      }

      const normalizedEmail = String(email)
        .trim()
        .toLowerCase();

      const hashedPassword = await bcrypt.hash(
        String(passwordHash),
        10,
      );

      const user = await prisma.$transaction(
        async (tx) => {
          const createdUser =
            await tx.user.create({
              data: {
                organizationId,
                name: String(name).trim(),
                email: normalizedEmail,
                passwordHash: hashedPassword,
                phone: phone
                  ? String(phone).trim()
                  : null,
                role,
              },
              select: {
                id: true,
              },
            });

          if (
            isSiteScopedRole(role) &&
            siteIds.length > 0
          ) {
            await tx.userSite.createMany({
              data: siteIds.map((siteId) => ({
                userId: createdUser.id,
                siteId,
              })),
            });
          }

          return tx.user.findUnique({
            where: {
              id: createdUser.id,
            },
            select: userSelect,
          });
        },
      );

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
          error:
            "A user with this email already exists",
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
            "Organization or site not found",
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
        organizationId: requestedOrganizationId,
        siteIds: rawSiteIds,
      } = req.body;

      const existingUser =
        await prisma.user.findUnique({
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

      if (
        !canManageTargetRole(
          req.user!.role,
          existingUser.role,
        )
      ) {
        return res.status(403).json({
          error: "You cannot modify this user",
        });
      }

      let finalRole: ValidRole =
        existingUser.role;

      if (role !== undefined) {
        if (!isValidRole(role)) {
          return res.status(400).json({
            error: "Invalid user role",
            validRoles,
          });
        }

        if (
          !canManageTargetRole(
            req.user!.role,
            role,
          )
        ) {
          return res.status(403).json({
            error:
              "You cannot assign this role",
          });
        }

        finalRole = role;
      }

      let finalOrganizationId =
        existingUser.organizationId;

      if (
        requestedOrganizationId !== undefined
      ) {
        if (
          req.user!.role !== "SUPER_ADMIN"
        ) {
          return res.status(403).json({
            error:
              "Only SUPER_ADMIN can change organizationId",
          });
        }

        finalOrganizationId = String(
          requestedOrganizationId,
        );

        const organization =
          await prisma.organization.findUnique({
            where: {
              id: finalOrganizationId,
            },
            select: {
              id: true,
            },
          });

        if (!organization) {
          return res.status(404).json({
            error: "Organization not found",
          });
        }
      }

      const siteIds =
        rawSiteIds !== undefined
          ? getSiteIds(rawSiteIds)
          : undefined;

      if (
        isSiteScopedRole(finalRole) &&
        siteIds !== undefined &&
        siteIds.length === 0
      ) {
        return res.status(400).json({
          error:
            `${finalRole} must be assigned to at least one site`,
        });
      }

      if (
        isSiteScopedRole(finalRole) &&
        siteIds !== undefined
      ) {
        const siteValidation =
          await validateSitesForOrganization(
            siteIds,
            finalOrganizationId,
          );

        if (!siteValidation.valid) {
          return res.status(400).json({
            error: siteValidation.error,
          });
        }
      }

      if (
        req.user!.role === "ORG_ADMIN" &&
        finalOrganizationId !==
          req.user!.organizationId
      ) {
        return res.status(403).json({
          error:
            "ORG_ADMIN can only manage users in its organization",
        });
      }

      const data: Record<string, unknown> = {};

      if (name !== undefined) {
        data.name = String(name).trim();
      }

      if (email !== undefined) {
        data.email = String(email)
          .trim()
          .toLowerCase();
      }

      if (phone !== undefined) {
        data.phone = phone
          ? String(phone).trim()
          : null;
      }

      if (role !== undefined) {
        data.role = finalRole;
      }

      if (
        requestedOrganizationId !== undefined
      ) {
        data.organizationId =
          finalOrganizationId;
      }

      if (active !== undefined) {
        data.active = Boolean(active);
      }

      if (
        passwordHash !== undefined &&
        String(passwordHash).trim() !== ""
      ) {
        data.passwordHash =
          await bcrypt.hash(
            String(passwordHash),
            10,
          );
      }

      await prisma.$transaction(
        async (tx) => {
          await tx.user.update({
            where: {
              id: userId,
            },
            data,
          });

          if (!isSiteScopedRole(finalRole)) {
            await tx.userSite.deleteMany({
              where: {
                userId,
              },
            });

            return;
          }

          if (siteIds !== undefined) {
            await tx.userSite.deleteMany({
              where: {
                userId,
              },
            });

            await tx.userSite.createMany({
              data: siteIds.map((siteId) => ({
                userId,
                siteId,
              })),
            });
          }
        },
      );

      const updatedUser =
        await prisma.user.findUnique({
          where: {
            id: userId,
          },
          select: userSelect,
        });

      return res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return res.status(409).json({
          error:
            "A user with this email already exists",
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

      const existingUser =
        await prisma.user.findUnique({
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
        existingUser.id ===
        req.user!.userId
      ) {
        return res.status(400).json({
          error:
            "You cannot deactivate your own user",
        });
      }

      if (
        !canAccessOrganization(
          req,
          existingUser.organizationId,
        )
      ) {
        return res.status(403).json({
          error:
            "Access denied for this organization",
        });
      }

      if (
        !canManageTargetRole(
          req.user!.role,
          existingUser.role,
        )
      ) {
        return res.status(403).json({
          error:
            "You cannot deactivate this user",
        });
      }

      const user =
        await prisma.user.update({
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
      console.error(
        "Error deactivating user:",
        error,
      );

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