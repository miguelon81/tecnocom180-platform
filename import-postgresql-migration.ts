import fs from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured");
}

if (!connectionString.includes("tecnocom180_test")) {
  throw new Error(
    "SAFETY STOP: DATABASE_URL must point to tecnocom180_test",
  );
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

const EXPORT_FILE = "sqlite-migration-export.json";

type ExportData = {
  source: string;
  exportedAt: string;
  counts: Record<string, number>;
  total: number;
  tables: Record<string, any[]>;
};

function date(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const result = new Date(String(value));

  if (Number.isNaN(result.getTime())) {
    throw new Error(`Invalid date: ${String(value)}`);
  }

  return result;
}

function requiredDate(value: unknown): Date {
  const result = date(value);

  if (!result) {
    throw new Error(`Required date missing: ${String(value)}`);
  }

  return result;
}

function bool(value: unknown): boolean {
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    value === "true"
  );
}

function jsonValue(value: unknown): any {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    throw new Error(
      `Invalid JSON in rawResult: ${value.slice(0, 200)}`,
    );
  }
}

async function assertDestinationEmpty() {
  const checks = [
    ["Organization", await prisma.organization.count()],
    ["User", await prisma.user.count()],
    ["Site", await prisma.site.count()],
    ["Device", await prisma.device.count()],
    ["Guest", await prisma.guest.count()],
    ["Ticket", await prisma.ticket.count()],
    ["DiagnosticRun", await prisma.diagnosticRun.count()],
    ["DeviceTelemetry", await prisma.deviceTelemetry.count()],
  ] as const;

  const nonEmpty = checks.filter(([, count]) => count !== 0);

  if (nonEmpty.length > 0) {
    throw new Error(
      "SAFETY STOP: destination is not empty: " +
        nonEmpty
          .map(([table, count]) => `${table}=${count}`)
          .join(", "),
    );
  }
}

async function main() {
  const raw = fs.readFileSync(EXPORT_FILE, "utf8");
  const data = JSON.parse(raw) as ExportData;
  const t = data.tables;

  console.log(`Source: ${data.source}`);
  console.log(`Expected records: ${data.total}`);
  console.log("Checking empty destination...");

  await assertDestinationEmpty();

  console.log("Destination empty. Starting import.");

  for (const r of t.Organization) {
    await prisma.organization.create({
      data: {
        id: r.id,
        name: r.name,
        slug: r.slug,
        phone: r.phone,
        email: r.email,
        timezone: r.timezone,
        active: bool(r.active),
        createdAt: requiredDate(r.createdAt),
        updatedAt: requiredDate(r.updatedAt),
      },
    });
  }
  console.log(`Organization: ${t.Organization.length}`);

  for (const r of t.User) {
    await prisma.user.create({
      data: {
        id: r.id,
        organizationId: r.organizationId,
        name: r.name,
        email: r.email,
        passwordHash: r.passwordHash,
        phone: r.phone,
        role: r.role,
        active: bool(r.active),
        lastLogin: date(r.lastLogin),
        createdAt: requiredDate(r.createdAt),
        updatedAt: requiredDate(r.updatedAt),
      },
    });
  }
  console.log(`User: ${t.User.length}`);

  for (const r of t.Site) {
    await prisma.site.create({
      data: {
        id: r.id,
        organizationId: r.organizationId,
        name: r.name,
        code: r.code,
        address: r.address,
        city: r.city,
        state: r.state,
        country: r.country,
        active: bool(r.active),
        createdAt: requiredDate(r.createdAt),
        updatedAt: requiredDate(r.updatedAt),
      },
    });
  }
  console.log(`Site: ${t.Site.length}`);

  for (const r of t.UserSite) {
    await prisma.userSite.create({
      data: {
        id: r.id,
        userId: r.userId,
        siteId: r.siteId,
        createdAt: requiredDate(r.createdAt),
      },
    });
  }
  console.log(`UserSite: ${t.UserSite.length}`);

  for (const r of t.Area) {
    await prisma.area.create({
      data: {
        id: r.id,
        siteId: r.siteId,
        name: r.name,
        type: r.type,
        createdAt: requiredDate(r.createdAt),
        updatedAt: requiredDate(r.updatedAt),
      },
    });
  }
  console.log(`Area: ${t.Area.length}`);

  for (const r of t.Room) {
    await prisma.room.create({
      data: {
        id: r.id,
        siteId: r.siteId,
        areaId: r.areaId,
        number: r.number,
        floor: r.floor,
        status: r.status,
        createdAt: requiredDate(r.createdAt),
        updatedAt: requiredDate(r.updatedAt),
      },
    });
  }
  console.log(`Room: ${t.Room.length}`);

  for (const r of t.Guest) {
    await prisma.guest.create({
      data: {
        id: r.id,
        siteId: r.siteId,
        name: r.name,
        email: r.email,
        phone: r.phone,
        createdAt: requiredDate(r.createdAt),
        updatedAt: requiredDate(r.updatedAt),
      },
    });
  }
  console.log(`Guest: ${t.Guest.length}`);

  for (const r of t.GuestStay) {
    await prisma.guestStay.create({
      data: {
        id: r.id,
        guestId: r.guestId,
        roomId: r.roomId,
        checkIn: requiredDate(r.checkIn),
        checkOut: requiredDate(r.checkOut),
        actualCheckIn: date(r.actualCheckIn),
        actualCheckOut: date(r.actualCheckOut),
        status: r.status,
        notes: r.notes,
        wifiMaxDevices: r.wifiMaxDevices,
        createdAt: requiredDate(r.createdAt),
        updatedAt: requiredDate(r.updatedAt),
      },
    });
  }
  console.log(`GuestStay: ${t.GuestStay.length}`);

  for (const r of t.GuestWifiAccess) {
    await prisma.guestWifiAccess.create({
      data: {
        id: r.id,
        stayId: r.stayId,
        username: r.username,
        password: r.password,
        accessUrl: r.accessUrl,
        token: r.token,
        status: r.status,
        maxDevices: r.maxDevices,
        activatedAt: date(r.activatedAt),
        expiresAt: requiredDate(r.expiresAt),
        deactivatedAt: date(r.deactivatedAt),
        createdAt: requiredDate(r.createdAt),
        updatedAt: requiredDate(r.updatedAt),
      },
    });
  }
  console.log(`GuestWifiAccess: ${t.GuestWifiAccess.length}`);

  for (const r of t.Brand) {
    await prisma.brand.create({
      data: {
        id: r.id,
        name: r.name,
        createdAt: requiredDate(r.createdAt),
      },
    });
  }
  console.log(`Brand: ${t.Brand.length}`);

  for (const r of t.DeviceModel) {
    await prisma.deviceModel.create({
      data: {
        id: r.id,
        brandId: r.brandId,
        name: r.name,
        type: r.type,
        codePrefix: r.codePrefix,
        createdAt: requiredDate(r.createdAt),
      },
    });
  }
  console.log(`DeviceModel: ${t.DeviceModel.length}`);

  for (const r of t.Device) {
    await prisma.device.create({
      data: {
        id: r.id,
        deviceCode: r.deviceCode,
        siteId: r.siteId,
        areaId: r.areaId,
        modelId: r.modelId,
        name: r.name,
        hostname: r.hostname,
        serial: r.serial,
        ip: r.ip,
        mac: r.mac,
        firmware: r.firmware,
        online: bool(r.online),
        lastSeenAt: date(r.lastSeenAt),
        installedAt: date(r.installedAt),
        notes: r.notes,
        createdAt: requiredDate(r.createdAt),
        updatedAt: requiredDate(r.updatedAt),
      },
    });
  }
  console.log(`Device: ${t.Device.length}`);

  for (const r of t.Ticket) {
    await prisma.ticket.create({
      data: {
        id: r.id,
        organizationId: r.organizationId,
        siteId: r.siteId,
        areaId: r.areaId,
        deviceId: r.deviceId,
        roomId: r.roomId,
        assignedToId: r.assignedToId,
        type: r.type,
        source: r.source,
        status: r.status,
        title: r.title,
        description: r.description,
        createdAt: requiredDate(r.createdAt),
        updatedAt: requiredDate(r.updatedAt),
      },
    });
  }
  console.log(`Ticket: ${t.Ticket.length}`);

  for (const r of t.TicketComment) {
    await prisma.ticketComment.create({
      data: {
        id: r.id,
        ticketId: r.ticketId,
        userId: r.userId,
        comment: r.comment,
        createdAt: requiredDate(r.createdAt),
      },
    });
  }
  console.log(`TicketComment: ${t.TicketComment.length}`);

  for (const r of t.DiagnosticRun) {
    await prisma.diagnosticRun.create({
      data: {
        id: r.id,
        organizationId: r.organizationId,
        siteId: r.siteId,
        status: r.status,
        startedAt: requiredDate(r.startedAt),
        finishedAt: date(r.finishedAt),
      },
    });
  }
  console.log(`DiagnosticRun: ${t.DiagnosticRun.length}`);

  for (const r of t.DiagnosticResult) {
    await prisma.diagnosticResult.create({
      data: {
        id: r.id,
        diagnosticRunId: r.diagnosticRunId,
        pingMs: r.pingMs,
        downloadMbps: r.downloadMbps,
        uploadMbps: r.uploadMbps,
        packetLoss: r.packetLoss,
        gateway: r.gateway,
        dns: r.dns,
        internet:
          r.internet === null || r.internet === undefined
            ? null
            : bool(r.internet),
        rawResult: jsonValue(r.rawResult),
      },
    });
  }
  console.log(`DiagnosticResult: ${t.DiagnosticResult.length}`);

  for (const r of t.AuditLog) {
    await prisma.auditLog.create({
      data: {
        id: r.id,
        organizationId: r.organizationId,
        userId: r.userId,
        action: r.action,
        entity: r.entity,
        entityId: r.entityId,
        data: r.data,
        createdAt: requiredDate(r.createdAt),
      },
    });
  }
  console.log(`AuditLog: ${t.AuditLog.length}`);

  // Bulk import is appropriate for the 6680 telemetry rows.
  const telemetryBatchSize = 500;

  for (
    let i = 0;
    i < t.DeviceTelemetry.length;
    i += telemetryBatchSize
  ) {
    const batch = t.DeviceTelemetry
      .slice(i, i + telemetryBatchSize)
      .map((r: any) => ({
        id: r.id,
        deviceId: r.deviceId,
        nivel: r.nivel,
        bateria: r.bateria,
        senal: r.senal,
        recarga: r.recarga,
        consumo: r.consumo,
        relay1: r.relay1,
        createdAt: requiredDate(r.createdAt),
      }));

    await prisma.deviceTelemetry.createMany({
      data: batch,
    });

    console.log(
      `DeviceTelemetry: ${Math.min(
        i + telemetryBatchSize,
        t.DeviceTelemetry.length,
      )}/${t.DeviceTelemetry.length}`,
    );
  }

  const counts: Record<string, number> = {
    Organization: await prisma.organization.count(),
    User: await prisma.user.count(),
    Site: await prisma.site.count(),
    UserSite: await prisma.userSite.count(),
    Area: await prisma.area.count(),
    Room: await prisma.room.count(),
    Guest: await prisma.guest.count(),
    GuestStay: await prisma.guestStay.count(),
    GuestWifiAccess: await prisma.guestWifiAccess.count(),
    Brand: await prisma.brand.count(),
    DeviceModel: await prisma.deviceModel.count(),
    Device: await prisma.device.count(),
    Ticket: await prisma.ticket.count(),
    TicketComment: await prisma.ticketComment.count(),
    DiagnosticRun: await prisma.diagnosticRun.count(),
    DiagnosticResult: await prisma.diagnosticResult.count(),
    AuditLog: await prisma.auditLog.count(),
    DeviceTelemetry: await prisma.deviceTelemetry.count(),
  };

  let destinationTotal = 0;
  let mismatch = false;

  console.log("\nVERIFY");
  console.log("=".repeat(55));

  for (const [table, actual] of Object.entries(counts)) {
    const expected = data.counts[table];

    destinationTotal += actual;

    const ok = actual === expected;

    if (!ok) {
      mismatch = true;
    }

    console.log(
      `${table.padEnd(25)} expected=${String(expected).padStart(
        5,
      )} actual=${String(actual).padStart(5)} ${
        ok ? "OK" : "MISMATCH"
      }`,
    );
  }

  console.log("=".repeat(55));
  console.log(`Expected total:    ${data.total}`);
  console.log(`Destination total: ${destinationTotal}`);

  if (mismatch || destinationTotal !== data.total) {
    throw new Error("IMPORT VERIFICATION FAILED");
  }

  console.log("\nIMPORT VERIFIED SUCCESSFULLY");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });