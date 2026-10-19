import { sql } from "drizzle-orm";
import { normalizePhone } from "@/lib/orders";
import type { Database } from "./index";
import * as schema from "./schema";
import { customers, orders, products } from "./seed-data";

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

/**
 * Replaces the catalog, customers and orders with the fictional shop data.
 * Conversations, tickets and policy chunks are left alone.
 */
export async function seedShop(db: Database) {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`TRUNCATE ${schema.orderItems}, ${schema.orders}, ${schema.customers}, ${schema.products} RESTART IDENTITY CASCADE`,
    );

    const insertedProducts = await tx.insert(schema.products).values(products).returning();
    const productBySku = new Map(insertedProducts.map((p) => [p.sku, p]));

    const insertedCustomers = await tx
      .insert(schema.customers)
      .values(customers.map((c) => ({ ...c, phone: normalizePhone(c.phone) })))
      .returning();
    const customerByEmail = new Map(insertedCustomers.map((c) => [c.email, c]));

    for (const order of orders) {
      const customer = customerByEmail.get(order.customerEmail);
      if (!customer) throw new Error(`Unknown customer ${order.customerEmail}`);

      const lines = order.items.map((item) => {
        const product = productBySku.get(item.sku);
        if (!product) throw new Error(`Unknown SKU ${item.sku}`);
        return { product, quantity: item.quantity };
      });
      const itemsTotal = lines.reduce((sum, l) => sum + l.product.priceIdr * l.quantity, 0);

      const [inserted] = await tx
        .insert(schema.orders)
        .values({
          number: order.number,
          customerId: customer.id,
          status: order.status,
          shippingCity: order.shippingCity,
          courier: order.courier ?? null,
          trackingNumber: order.trackingNumber ?? null,
          totalIdr: itemsTotal + order.shippingFeeIdr,
          placedAt: daysAgo(order.placedDaysAgo),
          shippedAt: order.shippedDaysAgo === undefined ? null : daysAgo(order.shippedDaysAgo),
          deliveredAt: order.deliveredDaysAgo === undefined ? null : daysAgo(order.deliveredDaysAgo),
        })
        .returning({ id: schema.orders.id });
      if (!inserted) throw new Error(`Insert failed for ${order.number}`);

      await tx.insert(schema.orderItems).values(
        lines.map((l) => ({
          orderId: inserted.id,
          productId: l.product.id,
          quantity: l.quantity,
          unitPriceIdr: l.product.priceIdr,
        })),
      );
    }
  });

  return { products: products.length, customers: customers.length, orders: orders.length };
}
