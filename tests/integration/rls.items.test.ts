import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";

// Test integracyjny izolacji RLS dla tabeli `items` (ryzyko R2 / IDOR z test-planu).
// Samodzielny: tworzy dwóch userów przez admin API, więc nie wymaga ręcznej rejestracji.
// Wymaga lokalnego Supabase (`npm run db:start && npm run db:reset`).
// Klucze lokalne to stałe, publiczne defaulty Supabase CLI (iss: supabase-demo) — nie sekrety.

const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient<Database>(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "password123";
const stamp = Date.now();

async function makeUser(label: string): Promise<{ id: string; client: SupabaseClient<Database> }> {
  const email = `rls-${label}-${stamp}@zwrotnik.local`;
  const created = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (created.error || !created.data.user) throw created.error ?? new Error("brak usera");
  const client = createClient<Database>(URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signin = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signin.error) throw signin.error;
  return { id: created.data.user.id, client };
}

let userA: { id: string; client: SupabaseClient<Database> };
let userB: { id: string; client: SupabaseClient<Database> };

beforeAll(async () => {
  userA = await makeUser("a");
  userB = await makeUser("b");
});

afterAll(async () => {
  if (userA) await admin.auth.admin.deleteUser(userA.id);
  if (userB) await admin.auth.admin.deleteUser(userB.id);
});

describe("RLS items isolation (R2 / IDOR)", () => {
  let itemId: string;

  it("A może dodać i odczytać własną pozycję", async () => {
    const inserted = await userA.client
      .from("items")
      .insert({ user_id: userA.id, nazwa: "Test A", kwota: 100, data_odniesienia: "2026-06-29", typ_okna: "zwrot" })
      .select()
      .single();
    expect(inserted.error).toBeNull();
    expect(inserted.data).not.toBeNull();
    itemId = inserted.data!.id;

    const own = await userA.client.from("items").select("*");
    expect(own.data).toHaveLength(1);
  });

  it("B nie widzi pozycji A", async () => {
    const seen = await userB.client.from("items").select("*");
    expect(seen.data).toHaveLength(0);
  });

  it("B nie może edytować pozycji A", async () => {
    const updated = await userB.client.from("items").update({ nazwa: "HACK" }).eq("id", itemId).select();
    expect(updated.data).toHaveLength(0);
  });

  it("B nie może usunąć pozycji A", async () => {
    const deleted = await userB.client.from("items").delete().eq("id", itemId).select();
    expect(deleted.data).toHaveLength(0);
  });

  it("B nie może wstawić pozycji z cudzym user_id", async () => {
    const hack = await userB.client
      .from("items")
      .insert({ user_id: userA.id, nazwa: "B-hack", kwota: 1, data_odniesienia: "2026-06-29", typ_okna: "zwrot" });
    expect(hack.error).not.toBeNull();
  });

  it("pozycja A pozostaje nietknięta", async () => {
    const still = await userA.client.from("items").select("nazwa").eq("id", itemId).single();
    expect(still.data?.nazwa).toBe("Test A");
  });
});
