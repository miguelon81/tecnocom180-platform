import { PrismaClient } from "../../../../generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({
  url: "file:../../dev.db",
});

const prisma = new PrismaClient({
  adapter,
});

export { prisma };