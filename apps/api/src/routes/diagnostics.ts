import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  authenticateToken,
  requireRole,
  AuthenticatedRequest,
} from "../middleware/auth";

const diagnosticsRouter = Router();

/**
 * JSON recibido desde la Raspberry Pi.
 *
 * El script diagnostico_red_v8.1.sh genera:
 *
 * {
 *   status,
 *   summary,
 *   internetRoute,
 *   latency,
 *   dns,
 *   internet,
 *   wifi
 * }
 */
type DiagnosticPayload = {
  status?: string;
  summary?: {
    pass?: number;
    warning?: number;
    fail?: number;
    skip?: number;
  };
  internetRoute?: {
    interface?: string;
    sourceIp?: string;
    gateway?: string;
  };
  latency?: {
    pingMs?: number | null;
    packetLoss?: number | null;
  };
  dns?: {
    servers?: string[];
    operational?: boolean;
  };
  internet?: boolean;
  wifi?: {
    ssid?: string;
    bssid?: string;
    frequencyMHz?: number | null;
    signalDbm?: number | null;
    rxBitrateMbps?: number | null;
    txBitrateMbps?: number | null;
  };
  [key: string]: unknown;
};

const diagnosticInclude = {
  organization: true,
  result: true,
};

function canAccessOrganization(
  req: AuthenticatedRequest,
  organizationId: string,
): boolean {
  if (!req.user) {
    return false;
  }

  if (req.user.role === "SUPER_ADMIN") {
    return true;
  }

  return req.user.organizationId === organizationId;
}

/**
 * Convierte el body recibido en un objeto JSON compatible
 * con Prisma.
 *
 * JSON.stringify/parse elimina tipos no serializables y
 * garantiza que Prisma reciba un JSON válido.
 */
function toPrismaJson(
  value: unknown,
): any {
  return JSON.parse(JSON.stringify(value));
}
/**
 * Obtiene el estado de diagnóstico que corresponde
 * al resultado generado por la Raspberry.
 *
 * PASS     -> SUCCESS
 * WARNING  -> SUCCESS
 * FAIL     -> FAILED
 */
function extractDiagnosticStatus(
  payload: DiagnosticPayload,
): "SUCCESS" | "FAILED" {
  if (payload.status === "FAIL") {
    return "FAILED";
  }

  return "SUCCESS";
}

/**
 * GET /diagnostics
 */
diagnosticsRouter.get(
  "/",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "TECHNICIAN",
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      let organizationId: string | undefined;

      if (req.user!.role !== "SUPER_ADMIN") {
        organizationId = req.user!.organizationId;
      }

      const diagnostics =
        await prisma.diagnosticRun.findMany({
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
        error,
      );

      res.status(500).json({
        error: "Failed to fetch diagnostics",
      });
    }
  },
);

/**
 * GET /diagnostics/:id
 */
diagnosticsRouter.get(
  "/:id",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "TECHNICIAN",
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
          diagnostic.organizationId,
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
        error,
      );

      res.status(500).json({
        error: "Failed to fetch diagnostic",
      });
    }
  },
);

/**
 * POST /diagnostics
 *
 * Crea una ejecución de diagnóstico.
 *
 * Este endpoint NO ejecuta el diagnóstico.
 * Solamente crea el DiagnosticRun.
 *
 * La ejecución real ocurre en la Raspberry Pi.
 */
diagnosticsRouter.post(
  "/",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "TECHNICIAN",
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { organizationId } = req.body;

      if (!organizationId) {
        return res.status(400).json({
          error: "organizationId is required",
        });
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
            status: "RUNNING",
          },
          include: diagnosticInclude,
        });

      res.status(201).json(diagnostic);
    } catch (error) {
      console.error(
        "Error creating diagnostic:",
        error,
      );

      res.status(500).json({
        error: "Failed to create diagnostic",
      });
    }
  },
);

/**
 * PATCH /diagnostics/:id
 */
diagnosticsRouter.patch(
  "/:id",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "TECHNICIAN",
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
          existingDiagnostic.organizationId,
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

            ...(status === "SUCCESS" ||
            status === "FAILED"
              ? {
                  finishedAt: new Date(),
                }
              : status === "RUNNING"
                ? {
                    finishedAt: null,
                  }
                : finishedAt !== undefined
                  ? {
                      finishedAt:
                        finishedAt
                          ? new Date(finishedAt)
                          : null,
                    }
                  : {}),
          },
          include: diagnosticInclude,
        });

      res.json(diagnostic);
    } catch (error) {
      console.error(
        "Error updating diagnostic:",
        error,
      );

      res.status(500).json({
        error: "Failed to update diagnostic",
      });
    }
  },
);

/**
 * DELETE /diagnostics/:id
 */
diagnosticsRouter.delete(
  "/:id",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
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
          existingDiagnostic.organizationId,
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
        error,
      );

      res.status(500).json({
        error: "Failed to delete diagnostic",
      });
    }
  },
);

/**
 * GET /diagnostics/:id/result
 */
diagnosticsRouter.get(
  "/:id/result",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "TECHNICIAN",
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const diagnosticId =
        req.params.id as string;

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
          diagnostic.organizationId,
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
        error,
      );

      res.status(500).json({
        error: "Failed to fetch diagnostic result",
      });
    }
  },
);

/**
 * POST /diagnostics/:id/result
 *
 * Endpoint principal para la Raspberry Pi.
 *
 * La Raspberry ejecuta:
 *
 *   diagnostico_red_v8.sh --json
 *
 * y manda ese JSON aquí.
 */
diagnosticsRouter.post(
  "/:id/result",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "TECHNICIAN",
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const diagnosticId =
        req.params.id as string;

      const payload =
        req.body as DiagnosticPayload;

      const diagnostic =
        await prisma.diagnosticRun.findUnique({
          where: {
            id: diagnosticId,
          },
          select: {
            id: true,
            organizationId: true,
            status: true,
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
          diagnostic.organizationId,
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
            diagnosticRunId:
              diagnosticId,

            pingMs:
              payload.latency?.pingMs ??
              null,

            downloadMbps:
              null,

            uploadMbps:
              null,

            packetLoss:
              payload.latency?.packetLoss ??
              null,

            gateway:
              payload.internetRoute
                ?.gateway ??
              null,

            dns:
              payload.dns?.servers
                ? payload.dns.servers.join(",")
                : null,

            internet:
              payload.internet ??
              null,

            rawResult:
              toPrismaJson(payload),
          },
        });

      const finalStatus =
        extractDiagnosticStatus(
          payload,
        );

      const updatedDiagnostic =
        await prisma.diagnosticRun.update({
          where: {
            id: diagnosticId,
          },
          data: {
            status: finalStatus,
            finishedAt: new Date(),
          },
          include: diagnosticInclude,
        });

      res.status(201).json({
        diagnostic: updatedDiagnostic,
        result,
      });
    } catch (error) {
      console.error(
        "Error creating diagnostic result:",
        error,
      );

      res.status(500).json({
        error:
          "Failed to create diagnostic result",
      });
    }
  },
);

/**
 * PATCH /diagnostics/:id/result
 */
diagnosticsRouter.patch(
  "/:id/result",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "TECHNICIAN",
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const diagnosticId =
        req.params.id as string;

      const payload =
        req.body as DiagnosticPayload;

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
          diagnostic.organizationId,
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
            diagnosticRunId:
              diagnosticId,
          },
          data: {
            ...(payload.latency?.pingMs !==
              undefined && {
              pingMs:
                payload.latency.pingMs,
            }),

            ...(payload.latency?.packetLoss !==
              undefined && {
              packetLoss:
                payload.latency.packetLoss,
            }),

            ...(payload.internetRoute
              ?.gateway !== undefined && {
              gateway:
                payload.internetRoute.gateway,
            }),

            ...(payload.dns?.servers !==
              undefined && {
              dns:
                payload.dns.servers.join(","),
            }),

            ...(payload.internet !==
              undefined && {
              internet:
                payload.internet,
            }),

            rawResult:
              toPrismaJson(payload),
          },
        });

      const finalStatus =
        extractDiagnosticStatus(
          payload,
        );

      await prisma.diagnosticRun.update({
        where: {
          id: diagnosticId,
        },
        data: {
          status: finalStatus,
          finishedAt: new Date(),
        },
      });

      res.json(result);
    } catch (error) {
      console.error(
        "Error updating diagnostic result:",
        error,
      );

      res.status(500).json({
        error:
          "Failed to update diagnostic result",
      });
    }
  },
);

/**
 * DELETE /diagnostics/:id/result
 */
diagnosticsRouter.delete(
  "/:id/result",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "ORG_ADMIN",
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const diagnosticId =
        req.params.id as string;

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
          diagnostic.organizationId,
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
        error,
      );

      res.status(500).json({
        error:
          "Failed to delete diagnostic result",
      });
    }
  },
);

export { diagnosticsRouter };