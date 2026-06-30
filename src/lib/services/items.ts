import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";
import type { Item } from "@/types";
import { isOverFreeLimit } from "@/lib/plan";

type DbClient = SupabaseClient<Database>;

/** Walidacja danych z formularza dodawania pozycji. */
export const itemInputSchema = z.object({
  nazwa: z.string().trim().min(1, "Podaj nazwę"),
  sklep: z.string().trim().min(1).optional(),
  kwota: z.coerce.number().positive("Kwota musi być dodatnia"),
  data_odniesienia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Podaj poprawną datę"),
  typ_okna: z.enum(["zwrot", "rekojmia", "subskrypcja"]),
  dlugosc_okna_dni: z.coerce.number().int().positive().optional(),
});

export type ItemInput = z.infer<typeof itemInputSchema>;

/** Aktywne pozycje użytkownika (RLS ogranicza wynik do zalogowanego). */
export async function listActiveForUser(supabase: DbClient): Promise<Item[]> {
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .eq("status_zalatwione", false)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

/** Waliduje i tworzy nową pozycję dla użytkownika. Zwraca komunikat błędu albo nic. */
export async function createItem(supabase: DbClient, userId: string, raw: unknown): Promise<{ error?: string }> {
  const parsed = itemInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" };
  }
  const input = parsed.data;

  // limit darmowego planu (egzekwowanie miękkie — komunikat, bez płatności)
  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", userId).single();
  const { count } = await supabase
    .from("items")
    .select("*", { count: "exact", head: true })
    .eq("status_zalatwione", false);
  if (isOverFreeLimit(profile?.plan ?? "free", count ?? 0)) {
    return {
      error: "Osiągnięto limit 30 pozycji w planie darmowym. Odblokowanie więcej (9,99 zł) będzie dostępne wkrótce.",
    };
  }

  const { error } = await supabase.from("items").insert({
    user_id: userId,
    nazwa: input.nazwa,
    sklep: input.sklep ?? null,
    kwota: input.kwota,
    data_odniesienia: input.data_odniesienia,
    typ_okna: input.typ_okna,
    dlugosc_okna_dni: input.dlugosc_okna_dni ?? null,
  });
  if (error) return { error: error.message };
  return {};
}
