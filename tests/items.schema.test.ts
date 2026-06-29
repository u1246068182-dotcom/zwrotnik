import { describe, expect, it } from "vitest";
import { itemInputSchema } from "@/lib/services/items";

// Walidacja danych formularza dodawania pozycji (ryzyko R5 — wejście użytkownika).
// Czyste (bez Supabase) — itemInputSchema importuje tylko zod.

const valid = {
  nazwa: "Słuchawki Sony",
  kwota: "599",
  data_odniesienia: "2026-06-17",
  typ_okna: "zwrot",
};

describe("itemInputSchema — poprawne dane", () => {
  it("akceptuje komplet i koercuje kwotę (string → number)", () => {
    const r = itemInputSchema.safeParse(valid);
    expect(r.success).toBe(true);
    expect(r.data?.kwota).toBe(599);
    expect(typeof r.data?.kwota).toBe("number");
  });

  it("sklep jest opcjonalny", () => {
    expect(itemInputSchema.safeParse({ ...valid, sklep: undefined }).success).toBe(true);
  });

  it("dlugosc_okna_dni opcjonalny i koercowany do int", () => {
    const r = itemInputSchema.safeParse({ ...valid, dlugosc_okna_dni: "30" });
    expect(r.success).toBe(true);
    expect(r.data?.dlugosc_okna_dni).toBe(30);
  });

  it("akceptuje wszystkie 3 typy okna", () => {
    for (const typ_okna of ["zwrot", "rekojmia", "subskrypcja"]) {
      expect(itemInputSchema.safeParse({ ...valid, typ_okna }).success).toBe(true);
    }
  });
});

describe("itemInputSchema — odrzuca błędne dane", () => {
  it("pusta nazwa", () => {
    expect(itemInputSchema.safeParse({ ...valid, nazwa: "" }).success).toBe(false);
  });

  it("kwota zero lub ujemna", () => {
    expect(itemInputSchema.safeParse({ ...valid, kwota: "0" }).success).toBe(false);
    expect(itemInputSchema.safeParse({ ...valid, kwota: "-5" }).success).toBe(false);
  });

  it("kwota nieliczbowa", () => {
    expect(itemInputSchema.safeParse({ ...valid, kwota: "abc" }).success).toBe(false);
  });

  it("zły format daty", () => {
    expect(itemInputSchema.safeParse({ ...valid, data_odniesienia: "17-06-2026" }).success).toBe(false);
  });

  it("nieznany typ okna", () => {
    expect(itemInputSchema.safeParse({ ...valid, typ_okna: "inne" }).success).toBe(false);
  });

  it("dlugosc_okna_dni ujemna lub ułamkowa", () => {
    expect(itemInputSchema.safeParse({ ...valid, dlugosc_okna_dni: "-3" }).success).toBe(false);
    expect(itemInputSchema.safeParse({ ...valid, dlugosc_okna_dni: "2.5" }).success).toBe(false);
  });
});
