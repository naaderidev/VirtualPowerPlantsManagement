import nextEnvironment from "@next/env";
import { PrismaClient } from "@prisma/client";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const DateObject = require("react-date-object").default;
const persian = require("react-date-object/calendars/persian");
const persianEn = require("react-date-object/locales/persian_en");

const { loadEnvConfig } = nextEnvironment;
loadEnvConfig(process.cwd());

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

function gregorianMonthToPersianMonth(period) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period);
  if (!match) throw new Error(`Unsupported market-index period: ${period}`);
  if (Number(match[1]) < 1700) return period;
  const firstDay = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return new DateObject(firstDay).convert(persian, persianEn).format("YYYY-MM");
}

function gregorianYearToPersianYear(year) {
  if (year < 1700) return year;
  const middleOfYear = new Date(Date.UTC(year, 6, 1));
  return Number(new DateObject(middleOfYear).convert(persian, persianEn).format("YYYY"));
}

async function main() {
  const [observations, profiles, versions] = await Promise.all([
    prisma.marketIndexObservation.findMany({ select: { id: true, pricingPlanId: true, period: true } }),
    prisma.generationProfile.findMany({ select: { id: true, year: true } }),
    prisma.generationProfileVersion.findMany({ select: { id: true, year: true } }),
  ]);

  const marketUpdates = observations
    .map((row) => ({ ...row, nextPeriod: gregorianMonthToPersianMonth(row.period) }))
    .filter((row) => row.period !== row.nextPeriod);
  const profileUpdates = profiles
    .map((row) => ({ ...row, nextYear: gregorianYearToPersianYear(row.year) }))
    .filter((row) => row.year !== row.nextYear);
  const versionUpdates = versions
    .map((row) => ({ ...row, nextYear: gregorianYearToPersianYear(row.year) }))
    .filter((row) => row.year !== row.nextYear);

  const uniqueKeys = new Set();
  for (const row of observations) {
    const nextPeriod = gregorianMonthToPersianMonth(row.period);
    const key = `${row.pricingPlanId}:${nextPeriod}`;
    if (uniqueKeys.has(key)) throw new Error(`Market-index migration would create duplicate key ${key}`);
    uniqueKeys.add(key);
  }

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    marketPeriods: marketUpdates.map(({ id, period, nextPeriod }) => ({ id, from: period, to: nextPeriod })),
    generationProfiles: profileUpdates.map(({ id, year, nextYear }) => ({ id, from: year, to: nextYear })),
    generationProfileVersions: versionUpdates.map(({ id, year, nextYear }) => ({ id, from: year, to: nextYear })),
    dateTimeColumns: "unchanged (UTC instants)",
  }, null, 2));

  if (!apply) return;
  await prisma.$transaction([
    ...marketUpdates.map((row) => prisma.marketIndexObservation.update({ where: { id: row.id }, data: { period: row.nextPeriod } })),
    ...profileUpdates.map((row) => prisma.generationProfile.update({ where: { id: row.id }, data: { year: row.nextYear } })),
    ...versionUpdates.map((row) => prisma.generationProfileVersion.update({ where: { id: row.id }, data: { year: row.nextYear } })),
  ]);
  console.log("Jalali calendar-key migration completed.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
