import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";
import { updateItem } from "@/lib/services/items";

// Edycja waliduje wejście tak samo jak dodawanie (reuse itemInputSchema) i — co kluczowe —
// przy błędnym wejściu NIE dotyka bazy. Czyste: stub klienta Supabase liczy wywołania.

const valid = {
  nazwa: "Słuchawki Sony",
  kwota: "599",
  data_odniesienia: "2026-06-17",
  typ_okna: "zwrot",
};

/** Stub klienta: `from()` zlicza wywołania; łańcuch update().eq() zwraca {error:null}. */
function makeStub() {
  const eq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });
  const client = { from } as unknown as SupabaseClient<Database>;
  return { client, from, update, eq };
}

describe("updateItem — walidacja przed dotknięciem bazy", () => {
  it("ujemna kwota → błąd i zero zapytań do bazy", async () => {
    const stub = makeStub();
    const res = await updateItem(stub.client, "item-1", { ...valid, kwota: "-5" });
    expect(res.error).toBeTruthy();
    expect(stub.from).not.toHaveBeenCalled();
  });

  it("zły format daty → błąd i zero zapytań do bazy", async () => {
    const stub = makeStub();
    const res = await updateItem(stub.client, "item-1", { ...valid, data_odniesienia: "17-06-2026" });
    expect(res.error).toBeTruthy();
    expect(stub.from).not.toHaveBeenCalled();
  });

  it("pusta nazwa → błąd i zero zapytań do bazy", async () => {
    const stub = makeStub();
    const res = await updateItem(stub.client, "item-1", { ...valid, nazwa: "" });
    expect(res.error).toBeTruthy();
    expect(stub.from).not.toHaveBeenCalled();
  });

  it("poprawne wejście → wykonuje update na tabeli items po id", async () => {
    const stub = makeStub();
    const res = await updateItem(stub.client, "item-1", valid);
    expect(res.error).toBeUndefined();
    expect(stub.from).toHaveBeenCalledWith("items");
    expect(stub.eq).toHaveBeenCalledWith("id", "item-1");
  });
});
