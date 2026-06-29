import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { createItem } from "@/lib/services/items";

// PRG: po sukcesie redirect na /dashboard, po błędzie na /dashboard?error=...
export const POST: APIRoute = async (context) => {
  const { user } = context.locals;
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/dashboard?error=${encodeURIComponent("Supabase nie jest skonfigurowany")}`);
  }

  const form = await context.request.formData();
  // puste pola opcjonalne → undefined (zamiast "" które przeszłoby walidację jako wartość)
  const opt = (v: FormDataEntryValue | null): string | undefined =>
    typeof v === "string" && v.trim().length > 0 ? v : undefined;
  const raw = {
    nazwa: form.get("nazwa"),
    sklep: opt(form.get("sklep")),
    kwota: form.get("kwota"),
    data_odniesienia: form.get("data_odniesienia"),
    typ_okna: form.get("typ_okna"),
    dlugosc_okna_dni: opt(form.get("dlugosc_okna_dni")),
  };

  const { error } = await createItem(supabase, user.id, raw);
  if (error) {
    return context.redirect(`/dashboard?error=${encodeURIComponent(error)}`);
  }
  return context.redirect("/dashboard");
};
