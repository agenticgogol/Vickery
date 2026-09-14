import { PrismaClient } from "@prisma/client";
import { seedAll, seedJubileeDemoResult, DEMO_PASSWORD } from "../src/lib/seed-data";

const prisma = new PrismaClient();

async function main() {
  await seedAll(prisma);
  await seedJubileeDemoResult(prisma);
  console.log(`Seed complete. Demo login password for all seeded users: ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
