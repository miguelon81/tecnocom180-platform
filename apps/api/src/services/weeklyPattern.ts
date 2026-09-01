import { prisma } from "../lib/prisma";

const HISTORY_DAYS = 28;

type PatternBucket = {
  dayOfWeek: number;
  hour: number;
  samples: number;
  averageConsumption: number;
  standardDeviation: number;
  minConsumption: number;
  maxConsumption: number;
};

type WeeklyPattern = {
  deviceId: string;
  from: Date;
  to: Date;
  buckets: PatternBucket[];
};

function calculateStandardDeviation(
  values: number[],
  average: number,
): number {
  if (values.length <= 1) {
    return 0;
  }

  const variance =
    values.reduce(
      (sum, value) => sum + Math.pow(value - average, 2),
      0,
    ) / values.length;

  return Math.sqrt(variance);
}

async function getWeeklyPattern(
  deviceId: string,
): Promise<WeeklyPattern> {
  const to = new Date();

  const from = new Date(
    to.getTime() -
      HISTORY_DAYS * 24 * 60 * 60 * 1000,
  );

  const telemetry =
    await prisma.deviceTelemetry.findMany({
      where: {
        deviceId,
        createdAt: {
          gte: from,
          lte: to,
        },
        consumo: {
          not: null,
        },
      },
      select: {
        createdAt: true,
        consumo: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

  const grouped = new Map<
    string,
    number[]
  >();

  for (const row of telemetry) {
    if (row.consumo === null) {
      continue;
    }

    const dayOfWeek =
      row.createdAt.getDay();

    const hour =
      row.createdAt.getHours();

    const key =
      `${dayOfWeek}-${hour}`;

    const values =
      grouped.get(key) ?? [];

    values.push(row.consumo);

    grouped.set(key, values);
  }

  const buckets: PatternBucket[] = [];

  for (const [
    key,
    values,
  ] of grouped.entries()) {
    const [
      dayOfWeek,
      hour,
    ] = key
      .split("-")
      .map(Number);

    const average =
      values.reduce(
        (sum, value) =>
          sum + value,
        0,
      ) / values.length;

    const standardDeviation =
      calculateStandardDeviation(
        values,
        average,
      );

    buckets.push({
      dayOfWeek,
      hour,
      samples: values.length,
      averageConsumption:
        average,
      standardDeviation,
      minConsumption:
        Math.min(...values),
      maxConsumption:
        Math.max(...values),
    });
  }

  buckets.sort(
    (a, b) =>
      a.dayOfWeek - b.dayOfWeek ||
      a.hour - b.hour,
  );

  return {
    deviceId,
    from,
    to,
    buckets,
  };
}

export {
  getWeeklyPattern,
};