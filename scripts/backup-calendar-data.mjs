import nextEnvironment from "@next/env";
import { PrismaClient } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const { loadEnvConfig } = nextEnvironment;
loadEnvConfig(process.cwd());
const prisma = new PrismaClient();

async function main() {
  const [marketIndexObservations, generationProfiles, generationProfileVersions] = await Promise.all([
    prisma.marketIndexObservation.findMany({ select: { id: true, pricingPlanId: true, period: true } }),
    prisma.generationProfile.findMany({ select: { id: true, year: true } }),
    prisma.generationProfileVersion.findMany({ select: { id: true, year: true } }),
  ]);
  const directory = resolve("backups");
  await mkdir(directory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const output = resolve(directory, `calendar-data-${stamp}.json`);
  await writeFile(output, `${JSON.stringify({ marketIndexObservations, generationProfiles, generationProfileVersions }, null, 2)}\n`, { flag: "wx" });
  console.log(`Calendar data backup created: ${output}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
