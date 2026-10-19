import { z } from "zod";

export const ORDER_NUMBER_PATTERN = /^KN-\d{5}$/;

export const orderNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(ORDER_NUMBER_PATTERN, "Order numbers look like KN-10234");

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type OrderRecord = {
  number: string;
  status: OrderStatus;
  shippingCity: string;
  courier: string | null;
  trackingNumber: string | null;
  totalIdr: number;
  placedAt: Date;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  customer: { name: string; email: string; phone: string };
  items: { name: string; quantity: number }[];
};

export type ContactProof = { email?: string; phone?: string };

/**
 * Indonesian numbers show up as 0812..., +62 812-..., 62812... or 812....
 * Everything is reduced to the 62 prefix so they compare equal.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Every contact detail the customer gave has to match the order's customer,
 * and at least one has to be given. A right phone with a wrong email fails.
 */
export function contactMatches(customer: OrderRecord["customer"], proof: ContactProof): boolean {
  const checks: boolean[] = [];
  if (proof.email !== undefined) {
    checks.push(normalizeEmail(proof.email) === normalizeEmail(customer.email));
  }
  if (proof.phone !== undefined) {
    const given = normalizePhone(proof.phone);
    checks.push(given.length >= 10 && given === normalizePhone(customer.phone));
  }
  return checks.length > 0 && checks.every(Boolean);
}

/** What the customer is allowed to see once they proved the order is theirs. */
export function toCustomerView(order: OrderRecord) {
  return {
    orderNumber: order.number,
    status: order.status,
    firstName: order.customer.name.split(" ")[0],
    shippingCity: order.shippingCity,
    items: order.items.map((item) => `${item.quantity}x ${item.name}`),
    totalIdr: order.totalIdr,
    courier: order.courier,
    trackingNumber: order.trackingNumber,
    placedAt: formatDate(order.placedAt),
    shippedAt: order.shippedAt ? formatDate(order.shippedAt) : null,
    deliveredAt: order.deliveredAt ? formatDate(order.deliveredAt) : null,
  };
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
