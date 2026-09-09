-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DiagnosticRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "siteId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "DiagnosticRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DiagnosticRun_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DiagnosticRun" ("finishedAt", "id", "organizationId", "startedAt", "status") SELECT "finishedAt", "id", "organizationId", "startedAt", "status" FROM "DiagnosticRun";
DROP TABLE "DiagnosticRun";
ALTER TABLE "new_DiagnosticRun" RENAME TO "DiagnosticRun";
CREATE INDEX "DiagnosticRun_organizationId_idx" ON "DiagnosticRun"("organizationId");
CREATE INDEX "DiagnosticRun_siteId_idx" ON "DiagnosticRun"("siteId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
