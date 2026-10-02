import sqlite3
import json
from pathlib import Path
from datetime import datetime

SOURCE = Path("dev.pre-postgresql-migration.db")
OUTPUT = Path("sqlite-migration-export.json")

TABLES = [
    "Organization",
    "User",
    "Site",
    "UserSite",
    "Area",
    "Room",
    "Guest",
    "GuestStay",
    "GuestWifiAccess",
    "Brand",
    "DeviceModel",
    "Device",
    "Ticket",
    "TicketComment",
    "DiagnosticRun",
    "DiagnosticResult",
    "AuditLog",
    "DeviceTelemetry",
]

if not SOURCE.exists():
    raise SystemExit(f"No existe {SOURCE}")

con = sqlite3.connect(
    f"file:{SOURCE.as_posix()}?mode=ro",
    uri=True
)

con.row_factory = sqlite3.Row

export = {
    "source": SOURCE.name,
    "exportedAt": datetime.now().astimezone().isoformat(),
    "tables": {},
    "counts": {},
}

total = 0

for table in TABLES:
    rows = con.execute(
        f'SELECT * FROM "{table}"'
    ).fetchall()

    data = [dict(row) for row in rows]

    export["tables"][table] = data
    export["counts"][table] = len(data)

    total += len(data)

    print(f"{table:<30} {len(data):>8}")

export["total"] = total

con.close()

with OUTPUT.open("w", encoding="utf-8") as f:
    json.dump(
        export,
        f,
        ensure_ascii=False,
        indent=2
    )

print("=" * 40)
print(f"TOTAL: {total}")
print(f"Exportado a: {OUTPUT}")