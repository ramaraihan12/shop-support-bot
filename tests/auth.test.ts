import { describe, expect, it } from "vitest";
import { safeEqual } from "@/lib/auth";

describe("safeEqual", () => {
  it("matches equal strings only", () => {
    expect(safeEqual("s3cret-token", "s3cret-token")).toBe(true);
    expect(safeEqual("s3cret-token", "s3cret-tokem")).toBe(false);
    expect(safeEqual("s3cret", "s3cret-token")).toBe(false);
    expect(safeEqual("", "s3cret")).toBe(false);
  });
});
