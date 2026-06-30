import { describe, expect, it } from "vitest";
import { FREE_ITEM_LIMIT, isOverFreeLimit } from "@/lib/plan";

// Reguła limitu darmowego planu (ryzyko R4 — poprawne egzekwowanie limitu).

describe("isOverFreeLimit — limit planu free", () => {
  it("free poniżej limitu → false", () => {
    expect(isOverFreeLimit("free", FREE_ITEM_LIMIT - 1)).toBe(false);
  });
  it("free dokładnie na limicie → true", () => {
    expect(isOverFreeLimit("free", FREE_ITEM_LIMIT)).toBe(true);
  });
  it("free powyżej limitu → true", () => {
    expect(isOverFreeLimit("free", FREE_ITEM_LIMIT + 5)).toBe(true);
  });
  it("premium nigdy nie przekracza → false", () => {
    expect(isOverFreeLimit("premium", 100)).toBe(false);
  });
});
