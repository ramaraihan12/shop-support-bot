import { createDb } from "@/lib/db";
import { seedShop } from "@/lib/db/seed";
import { getEnv } from "@/lib/env";

async function main() {
  const { db, client } = createDb(getEnv().DATABASE_URL);
  const counts = await seedShop(db);
  await client.end();
  console.log(`Seeded ${counts.products} products, ${counts.customers} customers, ${counts.orders} orders.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
