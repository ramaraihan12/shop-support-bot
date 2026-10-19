import { describe, expect, it } from "vitest";
import { contactMatches, normalizePhone, orderNumberSchema, toCustomerView } from "@/lib/orders";
import { orderFixtures } from "./helpers/memory-store";

const order = orderFixtures[0]!;

describe("normalizePhone", () => {
  it.each([
    ["0813-0000-2202", "6281300002202"],
    ["+62 813 0000 2202", "6281300002202"],
    ["6281300002202", "6281300002202"],
    ["81300002202", "6281300002202"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });
});

describe("contactMatches", () => {
  it("accepts the right email in any case", () => {
    expect(contactMatches(order.customer, { email: " Bagus.Pratama@Example.com " })).toBe(true);
  });

  it("accepts the right phone in local format", () => {
    expect(contactMatches(order.customer, { phone: "0813 0000 2202" })).toBe(true);
  });

  it("rejects another customer's email", () => {
    expect(contactMatches(order.customer, { email: "maya.kusuma@example.com" })).toBe(false);
  });

  it("rejects when one of two given details is wrong", () => {
    expect(
      contactMatches(order.customer, { email: "bagus.pratama@example.com", phone: "0857 0000 3303" }),
    ).toBe(false);
  });

  it("rejects when nothing is given", () => {
    expect(contactMatches(order.customer, {})).toBe(false);
  });

  it("rejects a phone that is only a suffix of the real one", () => {
    expect(contactMatches(order.customer, { phone: "2202" })).toBe(false);
  });
});

describe("orderNumberSchema", () => {
  it("normalizes case and whitespace", () => {
    expect(orderNumberSchema.parse(" kn-10234 ")).toBe("KN-10234");
  });

  it("rejects anything that isn't KN plus five digits", () => {
    expect(orderNumberSchema.safeParse("KN-1023").success).toBe(false);
    expect(orderNumberSchema.safeParse("KN-10234 OR 1=1").success).toBe(false);
  });
});

describe("toCustomerView", () => {
  it("never includes the customer's email or phone", () => {
    const view = JSON.stringify(toCustomerView(order));
    expect(view).not.toContain("example.com");
    expect(view).not.toContain("2202");
    expect(view).toContain("Bagus");
    expect(view).not.toContain("Pratama");
  });
});
