import { describe, expect, it } from "vitest";
import { checkBasicAuth, safeEqual } from "@/lib/auth";

const header = (credentials: string) => `Basic ${Buffer.from(credentials, "utf8").toString("base64")}`;

describe("safeEqual", () => {
  it("matches equal strings only", () => {
    expect(safeEqual("s3cret-token", "s3cret-token")).toBe(true);
    expect(safeEqual("s3cret-token", "s3cret-tokem")).toBe(false);
    expect(safeEqual("s3cret", "s3cret-token")).toBe(false);
    expect(safeEqual("", "s3cret")).toBe(false);
  });
});

describe("checkBasicAuth", () => {
  it("accepts the right user and password", () => {
    expect(checkBasicAuth(header("admin:kopi-enak"), "admin", "kopi-enak")).toBe(true);
  });

  it("allows a colon inside the password", () => {
    expect(checkBasicAuth(header("admin:a:b"), "admin", "a:b")).toBe(true);
  });

  it("handles non-ascii passwords", () => {
    expect(checkBasicAuth(header("admin:kopi☕"), "admin", "kopi☕")).toBe(true);
  });

  it.each([
    ["wrong password", header("admin:salah")],
    ["wrong user", header("root:kopi-enak")],
    ["no header", null],
    ["bearer token", "Bearer abc"],
    ["garbage base64", "Basic !!!"],
    ["no colon", header("adminkopi-enak")],
  ])("rejects %s", (_label, value) => {
    expect(checkBasicAuth(value, "admin", "kopi-enak")).toBe(false);
  });
});
