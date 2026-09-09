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
  site: true,
  result: true,
};

function isGlobalRole(req: AuthenticatedRequest) {
  return (
    req.user?.role === "SUPER_ADMIN" ||
    req.user?.role === "OPERATIONS"
  );
}

function requiresSiteAssignment(req: AuthenticatedRequest) {
  return req.user?.role === "TECHNICIAN";
}

async function canAccessSite(
  req: AuthenticatedRequest,
  siteId: string,
) {
  if (!req.user) {
    return false;
  }

  if (isGlobalRole(req)) {
    return true;
  }

  const site = await prisma.site.findUnique({
    where: {
      id: siteId,
    },
    select: {
      id: true,
      organizationId: true,
      active: true,
    },
  });

  if (!site) {
    return false;
  }

  if (site.organizationId !== req.user.organizationId) {
    return false;
  }

  if (req.user.role === "ORG_ADMIN") {
    return true;
  }

  if (requiresSiteAssignment(req)) {
    const assignment = await prisma.userSite.findUnique({
      where: {
        userId_siteId: {
          userId: req.user.userId,
          siteId,
        },
      },
      select: {
        id: true,
      },
    });

    return Boolean(assignment);
  }

  return false;
}

async function getAccessibleSiteIds(
  req: AuthenticatedRequest,
) {
  if (!req.user || !requiresSiteAssignment(req)) {
    return null;
  }

  const assignments = await prisma.userSite.findMany({
    where: {
      userId: req.user.userId,
    },
    select: {
      siteId: true,
    },
  });

  return assignments.map(
    (assignment) => assignment.siteId,
  );
}

async function canAccessDiagnostic(
  req: AuthenticatedRequest,
  diagnostic: {
    organizationId: string;
    siteId: string | null;
  },
) {
  if (!req.user) {
    return false;
  }

  if (isGlobalRole(req)) {
    return true;
  }

  if (
    diagnostic.organizationId !==
    req.user.organizationId
  ) {
    return false;
  }

  /*
   * Compatibilidad con diagnósticos históricos.
   *
   * Los registros anteriores a la incorporación de siteId
   * pueden tener siteId = null.
   *
   * ORG_ADMIN puede consultarlos porque pertenecen a su
   * organización. TECHNICIAN no, porque no podemos demostrar
   * a qué sitio pertenecían.
   */
  if (!diagnostic.siteId) {
    return req.user.role === "ORG_ADMIN";
  }

  return canAccessSite(req, diagnostic.siteId);
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
    "OPERATIONS",
    "ORG_ADMIN",
    "TECHNICIAN",
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const accessibleSiteIds =
        await getAccessibleSiteIds(req);

      const where = isGlobalRole(req)
        ? {}
        : req.user!.role === "ORG_ADMIN"
          ? {
              organizationId:
                req.user!.organizationId,
            }
          : {
              organizationId:
                req.user!.organizationId,
              siteId: {
                in: accessibleSiteIds ?? [],
              },
            };

      const diagnostics =
        await prisma.diagnosticRun.findMany({
          where,
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
    "OPERATIONS",
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
        !(await canAccessDiagnostic(
          req,
          diagnostic,
        ))
      ) {
        return res.status(403).json({
          error: "Access denied for this diagnostic",
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
 * Crea una ejecución de diagnóstico para un sitio.
 *
 * Este endpoint NO ejecuta todavía el diagnóstico.
 * Solamente crea el DiagnosticRun.
 *
 * La ejecución real ocurrirá en el agente Raspberry Pi
 * asociado al sitio.
 */
diagnosticsRouter.post(
  "/",
  authenticateToken,
  requireRole(
    "SUPER_ADMIN",
    "OPERATIONS",
    "ORG_ADMIN",
    "TECHNICIAN",
  ),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { siteId } = req.body;

      if (
        typeof siteId !== "string" ||
        !siteId.trim()
      ) {
        return res.status(400).json({
          error: "siteId is required",
        });
      }

      const site = await prisma.site.findUnique({
        where: {
          id: siteId,
        },
        select: {
          id: true,
          organizationId: true,
          active: true,
          
        },
      });

      if (!site) {
        return res.status(404).json({
          error: "Site not found",
        });
      }

      if (!(await canAccessSite(req, site.id))) {
        return res.status(403).json({
          error: "Access denied for this site",
        });
      }

      if (!site.active) {
        return res.status(409).json({
          error: "Cannot run diagnostics on an inactive site",
        });
      }

      const diagnostic =
        await prisma.diagnosticRun.create({
          data: {
            organizationId: site.organizationId,
            siteId: site.id,
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
    "OPERATIONS",
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
            siteId: true,
          },
        });

      if (!existingDiagnostic) {
        return res.status(404).json({
          error: "Diagnostic not found",
        });
      }

      if (
        !(await canAccessDiagnostic(
          req,
          existingDiagnostic,
        ))
      ) {
        return res.status(403).json({
          error: "Access denied for this diagnostic",
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
            siteId: true,
          },
        });

      if (!existingDiagnostic) {
        return res.status(404).json({
          error: "Diagnostic not found",
        });
      }

      if (
        !(await canAccessDiagnostic(
          req,
          existingDiagnostic,
        ))
      ) {
        return res.status(403).json({
          error: "Access denied for this diagnostic",
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
    "OPERATIONS",
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
            siteId: true,
          },
        });

      if (!diagnostic) {
        return res.status(404).json({
          error: "Diagnostic not found",
        });
      }

      if (
        !(await canAccessDiagnostic(
          req,
          diagnostic,
        ))
      ) {
        return res.status(403).json({
          error: "Access denied for this diagnostic",
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
    "OPERATIONS",
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
            siteId: true,
            status: true,
            
          },
        });

      if (!diagnostic) {
        return res.status(404).json({
          error: "Diagnostic not found",
        });
      }

      if (
        !(await canAccessDiagnostic(
          req,
          diagnostic,
        ))
      ) {
        return res.status(403).json({
          error: "Access denied for this diagnostic",
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
    "OPERATIONS",
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
            siteId: true,
          },
        });

      if (!diagnostic) {
        return res.status(404).json({
          error: "Diagnostic not found",
        });
      }

      if (
        !(await canAccessDiagnostic(
          req,
          diagnostic,
        ))
      ) {
        return res.status(403).json({
          error: "Access denied for this diagnostic",
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
            siteId: true,
          },
        });

      if (!diagnostic) {
        return res.status(404).json({
          error: "Diagnostic not found",
        });
      }

      if (
        !(await canAccessDiagnostic(
          req,
          diagnostic,
        ))
      ) {
        return res.status(403).json({
          error: "Access denied for this diagnostic",
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