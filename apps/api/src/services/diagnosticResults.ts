import { prisma } from "../lib/prisma";

export type DiagnosticPayload = {
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

function toPrismaJson(
  value: unknown,
): any {
  return JSON.parse(JSON.stringify(value));
}

function extractDiagnosticStatus(
  payload: DiagnosticPayload,
): "SUCCESS" | "FAILED" {
  if (payload.status === "FAIL") {
    return "FAILED";
  }

  return "SUCCESS";
}

export async function saveDiagnosticResult(
  diagnosticId: string,
  payload: DiagnosticPayload,
) {
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
    throw new Error("DIAGNOSTIC_NOT_FOUND");
  }

  const existingResult =
    await prisma.diagnosticResult.findUnique({
      where: {
        diagnosticRunId: diagnosticId,
      },
    });

  if (existingResult) {
    throw new Error(
      "DIAGNOSTIC_RESULT_ALREADY_EXISTS",
    );
  }

  const finalStatus =
    extractDiagnosticStatus(payload);

  const result =
    await prisma.$transaction(async (tx) => {
      const createdResult =
        await tx.diagnosticResult.create({
          data: {
            diagnosticRunId: diagnosticId,

            pingMs:
              payload.latency?.pingMs ??
              null,

            downloadMbps: null,

            uploadMbps: null,

            packetLoss:
              payload.latency?.packetLoss ??
              null,

            gateway:
              payload.internetRoute?.gateway ??
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

      const updatedDiagnostic =
        await tx.diagnosticRun.update({
          where: {
            id: diagnosticId,
          },
          data: {
            status: finalStatus,
            finishedAt: new Date(),
          },
        });

      return {
        diagnostic: updatedDiagnostic,
        result: createdResult,
      };
    });

  return result;
}