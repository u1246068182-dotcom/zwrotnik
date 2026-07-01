import { describe, expect, it } from "vitest";
import { warsawWallTimeToUTC, formatReminderWarsaw } from "@/lib/reminders";

// Konwersja „czas polski → UTC" musi uwzględniać DST (UTC+1 zimą, UTC+2 latem).

describe("warsawWallTimeToUTC — czas polski → UTC (DST)", () => {
  it("zima (styczeń, UTC+1): 09:00 Warszawa → 08:00 UTC", () => {
    expect(warsawWallTimeToUTC("2026-01-15", 9)).toBe("2026-01-15T08:00:00.000Z");
  });

  it("lato (lipiec, UTC+2): 09:00 Warszawa → 07:00 UTC", () => {
    expect(warsawWallTimeToUTC("2026-07-15", 9)).toBe("2026-07-15T07:00:00.000Z");
  });

  it("północ zimą: 00:00 Warszawa → 23:00 UTC dnia poprzedniego", () => {
    expect(warsawWallTimeToUTC("2026-02-01", 0)).toBe("2026-01-31T23:00:00.000Z");
  });
});

describe("formatReminderWarsaw — UTC → czytelny czas polski", () => {
  it("zima: 08:00 UTC → 2026-01-15 09:00", () => {
    expect(formatReminderWarsaw("2026-01-15T08:00:00.000Z")).toBe("2026-01-15 09:00");
  });

  it("lato: 07:00 UTC → 2026-07-15 09:00", () => {
    expect(formatReminderWarsaw("2026-07-15T07:00:00.000Z")).toBe("2026-07-15 09:00");
  });

  it("round-trip: warsawWallTimeToUTC → formatReminderWarsaw zachowuje wpisaną godzinę", () => {
    expect(formatReminderWarsaw(warsawWallTimeToUTC("2026-07-15", 14))).toBe("2026-07-15 14:00");
  });
});
