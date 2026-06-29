import { describe, expect, it } from "vitest";
import type { Item } from "@/types";
import { buildUrgencyView, computeCloseDate, statusForDays } from "@/lib/urgency";

// Silnik pilności — ryzyko R1 (zły status/kolejność/suma = utrata pieniędzy).
// `today` wstrzykiwane dla determinizmu.

const TODAY = new Date("2026-06-15T12:00:00Z");

function makeItem(o: Partial<Item> = {}): Item {
  return {
    id: o.id ?? Math.random().toString(36).slice(2),
    user_id: o.user_id ?? "u",
    nazwa: o.nazwa ?? "X",
    sklep: o.sklep ?? null,
    kwota: o.kwota ?? 100,
    data_odniesienia: o.data_odniesienia ?? "2026-06-01",
    typ_okna: o.typ_okna ?? "zwrot",
    dlugosc_okna_dni: o.dlugosc_okna_dni ?? null,
    status_zalatwione: o.status_zalatwione ?? false,
    created_at: o.created_at ?? "2026-06-01T00:00:00Z",
  };
}

describe("statusForDays — progi statusu", () => {
  it("dni < 0 → minelo", () => {
    expect(statusForDays(-1)).toBe("minelo");
  });
  it("0 dni → pilne", () => {
    expect(statusForDays(0)).toBe("pilne");
  });
  it("3 dni → pilne (górna granica)", () => {
    expect(statusForDays(3)).toBe("pilne");
  });
  it("4 dni → wkrotce (dolna granica)", () => {
    expect(statusForDays(4)).toBe("wkrotce");
  });
  it("14 dni → wkrotce (górna granica)", () => {
    expect(statusForDays(14)).toBe("wkrotce");
  });
  it("15 dni → spokojnie", () => {
    expect(statusForDays(15)).toBe("spokojnie");
  });
});

describe("computeCloseDate — data zamknięcia wg typu okna", () => {
  it("zwrot: data + 14 dni (domyślnie)", () => {
    expect(computeCloseDate(makeItem({ typ_okna: "zwrot", data_odniesienia: "2026-06-01" }))).toBe("2026-06-15");
  });
  it("zwrot: respektuje override dlugosc_okna_dni", () => {
    expect(
      computeCloseDate(makeItem({ typ_okna: "zwrot", data_odniesienia: "2026-06-01", dlugosc_okna_dni: 30 })),
    ).toBe("2026-07-01");
  });
  it("rekojmia: data + 730 dni (2 lata)", () => {
    expect(computeCloseDate(makeItem({ typ_okna: "rekojmia", data_odniesienia: "2025-06-15" }))).toBe("2027-06-15");
  });
  it("subskrypcja: data odnowienia jest datą zamknięcia", () => {
    expect(computeCloseDate(makeItem({ typ_okna: "subskrypcja", data_odniesienia: "2026-07-01" }))).toBe("2026-07-01");
  });
});

describe("buildUrgencyView — kubełki, sort, suma", () => {
  const items = [
    makeItem({ nazwa: "A", typ_okna: "subskrypcja", data_odniesienia: "2026-06-16", kwota: 50 }), // pilne (1d)
    makeItem({ nazwa: "B", typ_okna: "subskrypcja", data_odniesienia: "2026-06-17", kwota: 300 }), // pilne (2d)
    makeItem({ nazwa: "C", typ_okna: "subskrypcja", data_odniesienia: "2026-06-25", kwota: 100 }), // wkrotce (10d)
    makeItem({ nazwa: "D", typ_okna: "subskrypcja", data_odniesienia: "2026-08-01", kwota: 500 }), // spokojnie (47d)
    makeItem({
      nazwa: "Z",
      typ_okna: "subskrypcja",
      data_odniesienia: "2026-06-16",
      kwota: 999,
      status_zalatwione: true,
    }),
  ];

  it("sortuje w kubełku wg kwoty malejąco", () => {
    const view = buildUrgencyView(items, TODAY);
    expect(view.buckets.pilne.map((i) => i.nazwa)).toEqual(["B", "A"]);
  });

  it("suma Zagrożone = pilne + wkrótce (bez spokojnie/minęło)", () => {
    const view = buildUrgencyView(items, TODAY);
    expect(view.sumaZagrozona).toBe(450); // 300 + 50 + 100
  });

  it("pomija pozycje status_zalatwione", () => {
    const view = buildUrgencyView(items, TODAY);
    const all = [...view.buckets.pilne, ...view.buckets.wkrotce, ...view.buckets.spokojnie, ...view.buckets.minelo];
    expect(all.some((i) => i.nazwa === "Z")).toBe(false);
  });

  it("przypisuje policzony status i dni do widoku", () => {
    const view = buildUrgencyView(items, TODAY);
    const b = view.buckets.pilne.find((i) => i.nazwa === "B");
    expect(b?.status).toBe("pilne");
    expect(b?.dniDoZamkniecia).toBe(2);
  });
});
