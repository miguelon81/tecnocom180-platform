import { PrismaClient } from "../../../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured");
}

const adapter = new PrismaPg({
  connectionString,

  // Tiempo máximo para establecer conexión.
  connectionTimeoutMillis: 5_000,

  // Tiempo máximo de ejecución de consultas SQL.
  statement_timeout: 10_000,

  // Tiempo máximo de espera por bloqueos PostgreSQL.
  lock_timeout: 5_000,
});

const prisma = new PrismaClient({
  adapter,
});

export { prisma };