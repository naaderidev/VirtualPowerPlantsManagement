import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { getSeededUsers } from "./seed-users";

const prisma = new PrismaClient();

function requirePassword(name: "ADMIN_SEED_PASSWORD" | "SEED_PASSWORD", minimumLength: number): string {
  const value = process.env[name];
  if (!value || value.length < minimumLength) {
    throw new Error(`${name} must contain at least ${minimumLength} characters`);
  }
  return value;
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Database seeding is disabled in production");

  const adminPassword = await hash(requirePassword("ADMIN_SEED_PASSWORD", 8), 12);
  const sharedTestPassword = await hash(requirePassword("SEED_PASSWORD", 12), 12);
  const existingAdmin = await prisma.user.findFirst({
    where: { email: "admin@vpp.local", role: "ADMIN" },
  });
  const adminMobile = process.env.ADMIN_SEED_MOBILE || existingAdmin?.mobile;
  if (!adminMobile) {
    throw new Error("ADMIN_SEED_MOBILE is required for a new database");
  }
  const seededUsers = getSeededUsers(adminMobile);

  for (const user of seededUsers) {
    const password = user.role === "ADMIN" ? adminPassword : sharedTestPassword;
    if (user.role === "ADMIN" && existingAdmin) {
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: { ...user, password, active: true },
      });
      continue;
    }
    await prisma.user.upsert({
      where: { mobile: user.mobile },
      create: { ...user, partyId: null, password, active: true },
      update: { ...user, password, active: true },
    });
  }

  console.log(`Seed completed: ${seededUsers.length} users; no domain entities were created.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Database seed failed");
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
