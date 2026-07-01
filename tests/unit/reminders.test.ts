import { describe, expect, it } from "vitest";
import { warsawWallTimeToUTC, formatReminderWarsaw, isReminderDue, buildReminderEmail } from "@/lib/reminders";

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

describe("isReminderDue — czy wysłać", () => {
  const NOW = new Date("2026-07-15T10:00:00Z");
  it("przyszłość → false", () => {
    expect(isReminderDue("2026-07-15T11:00:00Z", false, NOW)).toBe(false);
  });
  it("przeszłość/teraz + aktywna → true", () => {
    expect(isReminderDue("2026-07-15T09:00:00Z", false, NOW)).toBe(true);
    expect(isReminderDue("2026-07-15T10:00:00Z", false, NOW)).toBe(true);
  });
  it("przeszłość ale załatwiona → false", () => {
    expect(isReminderDue("2026-07-15T09:00:00Z", true, NOW)).toBe(false);
  });
  it("brak przypomnienia (null) → false", () => {
    expect(isReminderDue(null, false, NOW)).toBe(false);
  });
});

describe("buildReminderEmail — treść maila", () => {
  const item = { nazwa: "Słuchawki Sony", kwota: 599, sklep: "Media Expert" };
  it("zawiera nazwę, termin, dni, kwotę i link", () => {
    const { subject, html } = buildReminderEmail(item, "2026-07-20", 5, "https://x/dashboard");
    expect(subject).toContain("Słuchawki Sony");
    expect(html).toContain("Słuchawki Sony");
    expect(html).toContain("2026-07-20");
    expect(html).toContain("5 dni");
    expect(html).toContain("599");
    expect(html).toContain("https://x/dashboard");
  });
  it("po terminie: komunikat o minięciu", () => {
    const { html } = buildReminderEmail(item, "2026-07-10", -3, "https://x/dashboard");
    expect(html).toContain("minął");
  });
});
