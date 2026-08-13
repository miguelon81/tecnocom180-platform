import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  authenticateToken,
  requireRole,
  AuthenticatedRequest,
} from "../middleware/auth";

const diagnosticsRouter = Router();

const diagnosticInclude = {
  organization: true,
  result: true,
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

// GET /diagnostics
diagnosticsRouter.get(
  "/",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "TECHNICIAN"
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      let organizationId: string | undefined;

      if (req.user!.role !== "SUPER_ADMIN") {
        organizationId = req.user!.organizationId;
      }

      const diagnostics = await prisma.diagnosticRun.findMany({
        where: {
          ...(organizationId && {
            organizationId,
          }),
        },
        include: diagnosticInclude,
        orderBy: {
          startedAt: "desc",
        },
      });

      res.json(diagnostics);
    } catch (error) {
      console.error(
        "Error fetching diagnostics:",
        error
      );

      res.status(500).json({
        error: "Failed to fetch diagnostics",
      });
    }
  }
);

// GET /diagnostics/:id
diagnosticsRouter.get(
  "/:id",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "TECHNICIAN"
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const diagnostic =
        await prisma.diagnosticRun.findUnique({
          where: {
            id: req.params.id as string,
          },
          include: diagnosticInclude,
        });

      if (!diagnostic) {
        return res.status(404).json({
          error: "Diagnostic not found",
        });
      }

      if (
        !canAccessOrganization(
          req,
          diagnostic.organizationId
        )
      ) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      res.json(diagnostic);
    } catch (error) {
      console.error(
        "Error fetching diagnostic:",
        error
      );

      res.status(500).json({
        error: "Failed to fetch diagnostic",
      });
    }
  }
);

// POST /diagnostics
diagnosticsRouter.post(
  "/",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "TECHNICIAN"
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const {
        organizationId,
      } = req.body;

      if (!organizationId) {
        return res.status(400).json({
          error: "organizationId is required",
        });
      }

      if (
        !canAccessOrganization(
          req,
          organizationId
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
          },
        });

      if (!organization) {
        return res.status(404).json({
          error: "Organization not found",
        });
      }

      const diagnostic =
        await prisma.diagnosticRun.create({
          data: {
            organizationId,
          },
          include: diagnosticInclude,
        });

      res.status(201).json(diagnostic);
    } catch (error) {
      console.error(
        "Error creating diagnostic:",
        error
      );

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2003"
      ) {
        return res.status(400).json({
          error: "Organization not found",
        });
      }

      res.status(500).json({
        error: "Failed to create diagnostic",
      });
    }
  }
);

// PATCH /diagnostics/:id
diagnosticsRouter.patch(
  "/:id",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "TECHNICIAN"
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const diagnosticId =
        req.params.id as string;

      const {
        status,
        finishedAt,
      } = req.body;

      const existingDiagnostic =
        await prisma.diagnosticRun.findUnique({
          where: {
            id: diagnosticId,
          },
          select: {
            id: true,
            organizationId: true,
          },
        });

      if (!existingDiagnostic) {
        return res.status(404).json({
          error: "Diagnostic not found",
        });
      }

      if (
        !canAccessOrganization(
          req,
          existingDiagnostic.organizationId
        )
      ) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      const validStatuses = [
        "RUNNING",
        "SUCCESS",
        "FAILED",
      ];

      if (
        status !== undefined &&
        !validStatuses.includes(status)
      ) {
        return res.status(400).json({
          error: "Invalid diagnostic status",
          validStatuses,
        });
      }

      const diagnostic =
        await prisma.diagnosticRun.update({
          where: {
            id: diagnosticId,
          },
          data: {
  	    ...(status !== undefined && {
    	    status,
  	    }),
  	    ...(status === "SUCCESS" || status === "FAILED"
    	      ? {
        	finishedAt: new Date(),
      		}
   	      : status === "RUNNING"
      		? {
          	    finishedAt: null,
        	  }
      		: finishedAt !== undefined
        	  ? {
            	      finishedAt,
                    }
        	  : {}),
	  },
          include: diagnosticInclude,
        });

      res.json(diagnostic);
    } catch (error) {
      console.error(
        "Error updating diagnostic:",
        error
      );

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2025"
      ) {
        return res.status(404).json({
          error: "Diagnostic not found",
        });
      }

      res.status(500).json({
        error: "Failed to update diagnostic",
      });
    }
  }
);

// DELETE /diagnostics/:id
diagnosticsRouter.delete(
  "/:id",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN"
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const diagnosticId =
        req.params.id as string;

      const existingDiagnostic =
        await prisma.diagnosticRun.findUnique({
          where: {
            id: diagnosticId,
          },
          select: {
            id: true,
            organizationId: true,
          },
        });

      if (!existingDiagnostic) {
        return res.status(404).json({
          error: "Diagnostic not found",
        });
      }

      if (
        !canAccessOrganization(
          req,
          existingDiagnostic.organizationId
        )
      ) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      await prisma.diagnosticRun.delete({
        where: {
          id: diagnosticId,
        },
      });

      res.status(204).send();
    } catch (error) {
      console.error(
        "Error deleting diagnostic:",
        error
      );

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2025"
      ) {
        return res.status(404).json({
          error: "Diagnostic not found",
        });
      }

      res.status(500).json({
        error: "Failed to delete diagnostic",
      });
    }
  }
);

// GET /diagnostics/:id/result
diagnosticsRouter.get(
  "/:id/result",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "TECHNICIAN"
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const diagnosticId = req.params.id as string;

      const diagnostic =
        await prisma.diagnosticRun.findUnique({
          where: {
            id: diagnosticId,
          },
          select: {
            id: true,
            organizationId: true,
          },
        });

      if (!diagnostic) {
        return res.status(404).json({
          error: "Diagnostic not found",
        });
      }

      if (
        !canAccessOrganization(
          req,
          diagnostic.organizationId
        )
      ) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      const result =
        await prisma.diagnosticResult.findUnique({
          where: {
            diagnosticRunId: diagnosticId,
          },
        });

      if (!result) {
        return res.status(404).json({
          error: "Diagnostic result not found",
        });
      }

      res.json(result);
    } catch (error) {
      console.error(
        "Error fetching diagnostic result:",
        error
      );

      res.status(500).json({
        error: "Failed to fetch diagnostic result",
      });
    }
  }
);

// POST /diagnostics/:id/result
diagnosticsRouter.post(
  "/:id/result",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "TECHNICIAN"
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const diagnosticId = req.params.id as string;

      const {
        pingMs,
        downloadMbps,
        uploadMbps,
        packetLoss,
        gateway,
        dns,
        internet,
      } = req.body;

      const diagnostic =
        await prisma.diagnosticRun.findUnique({
          where: {
            id: diagnosticId,
          },
          select: {
            id: true,
            organizationId: true,
          },
        });

      if (!diagnostic) {
        return res.status(404).json({
          error: "Diagnostic not found",
        });
      }

      if (
        !canAccessOrganization(
          req,
          diagnostic.organizationId
        )
      ) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      const existingResult =
        await prisma.diagnosticResult.findUnique({
          where: {
            diagnosticRunId: diagnosticId,
          },
        });

      if (existingResult) {
        return res.status(409).json({
          error: "Diagnostic result already exists",
        });
      }

      const result =
        await prisma.diagnosticResult.create({
          data: {
            diagnosticRunId: diagnosticId,
            pingMs: pingMs ?? null,
            downloadMbps: downloadMbps ?? null,
            uploadMbps: uploadMbps ?? null,
            packetLoss: packetLoss ?? null,
            gateway: gateway ?? null,
            dns: dns ?? null,
            internet: internet ?? null,
          },
        });

      res.status(201).json(result);
    } catch (error) {
      console.error(
        "Error creating diagnostic result:",
        error
      );

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2003"
      ) {
        return res.status(404).json({
          error: "Diagnostic not found",
        });
      }

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return res.status(409).json({
          error: "Diagnostic result already exists",
        });
      }

      res.status(500).json({
        error: "Failed to create diagnostic result",
      });
    }
  }
);

// PATCH /diagnostics/:id/result
diagnosticsRouter.patch(
  "/:id/result",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "TECHNICIAN"
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const diagnosticId = req.params.id as string;

      const {
        pingMs,
        downloadMbps,
        uploadMbps,
        packetLoss,
        gateway,
        dns,
        internet,
      } = req.body;

      const diagnostic =
        await prisma.diagnosticRun.findUnique({
          where: {
            id: diagnosticId,
          },
          select: {
            id: true,
            organizationId: true,
          },
        });

      if (!diagnostic) {
        return res.status(404).json({
          error: "Diagnostic not found",
        });
      }

      if (
        !canAccessOrganization(
          req,
          diagnostic.organizationId
        )
      ) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      const existingResult =
        await prisma.diagnosticResult.findUnique({
          where: {
            diagnosticRunId: diagnosticId,
          },
        });

      if (!existingResult) {
        return res.status(404).json({
          error: "Diagnostic result not found",
        });
      }

      const result =
        await prisma.diagnosticResult.update({
          where: {
            diagnosticRunId: diagnosticId,
          },
          data: {
            ...(pingMs !== undefined && {
              pingMs,
            }),
            ...(downloadMbps !== undefined && {
              downloadMbps,
            }),
            ...(uploadMbps !== undefined && {
              uploadMbps,
            }),
            ...(packetLoss !== undefined && {
              packetLoss,
            }),
            ...(gateway !== undefined && {
              gateway,
            }),
            ...(dns !== undefined && {
              dns,
            }),
            ...(internet !== undefined && {
              internet,
            }),
          },
        });

      res.json(result);
    } catch (error) {
      console.error(
        "Error updating diagnostic result:",
        error
      );

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2025"
      ) {
        return res.status(404).json({
          error: "Diagnostic result not found",
        });
      }

      res.status(500).json({
        error: "Failed to update diagnostic result",
      });
    }
  }
);

// DELETE /diagnostics/:id/result
diagnosticsRouter.delete(
  "/:id/result",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN"
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const diagnosticId = req.params.id as string;

      const diagnostic =
        await prisma.diagnosticRun.findUnique({
          where: {
            id: diagnosticId,
          },
          select: {
            id: true,
            organizationId: true,
          },
        });

      if (!diagnostic) {
        return res.status(404).json({
          error: "Diagnostic not found",
        });
      }

      if (
        !canAccessOrganization(
          req,
          diagnostic.organizationId
        )
      ) {
        return res.status(403).json({
          error: "Access denied for this organization",
        });
      }

      const existingResult =
        await prisma.diagnosticResult.findUnique({
          where: {
            diagnosticRunId: diagnosticId,
          },
        });

      if (!existingResult) {
        return res.status(404).json({
          error: "Diagnostic result not found",
        });
      }

      await prisma.diagnosticResult.delete({
        where: {
          diagnosticRunId: diagnosticId,
        },
      });

      res.status(204).send();
    } catch (error) {
      console.error(
        "Error deleting diagnostic result:",
        error
      );

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2025"
      ) {
        return res.status(404).json({
          error: "Diagnostic result not found",
        });
      }

      res.status(500).json({
        error: "Failed to delete diagnostic result",
      });
    }
  }
);

export { diagnosticsRouter };