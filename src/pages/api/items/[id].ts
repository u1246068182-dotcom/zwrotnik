import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { updateItem, deleteItem, setDone } from "@/lib/services/items";

export const prerender = false;

// PRG: wszystkie mutacje jednej pozycji przez POST z polem `_action`.
export const POST: APIRoute = async (context) => {
  const { user } = context.locals;
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const id = context.params.id;
  if (!id) {
    return context.redirect(`/dashboard?error=${encodeURIComponent("Brak identyfikatora pozycji")}`);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/dashboard?error=${encodeURIComponent("Supabase nie jest skonfigurowany")}`);
  }

  const form = await context.request.formData();
  const action = form.get("_action");

  // puste pola opcjonalne → undefined (jak w api/items/index.ts)
  const opt = (v: FormDataEntryValue | null): string | undefined =>
    typeof v === "string" && v.trim().length > 0 ? v : undefined;

  let result: { error?: string };
  switch (action) {
    case "update":
      result = await updateItem(supabase, id, {
        nazwa: form.get("nazwa"),
        sklep: opt(form.get("sklep")),
        kwota: form.get("kwota"),
        data_odniesienia: form.get("data_odniesienia"),
        typ_okna: form.get("typ_okna"),
        dlugosc_okna_dni: opt(form.get("dlugosc_okna_dni")),
      });
      // przy błędzie edycji wróć na stronę edycji z komunikatem
      if (result.error) {
        return context.redirect(`/items/${id}/edit?error=${encodeURIComponent(result.error)}`);
      }
      break;
    case "delete":
      result = await deleteItem(supabase, id);
      break;
    case "done":
      result = await setDone(supabase, id, true);
      break;
    case "undone":
      result = await setDone(supabase, id, false);
      break;
    default:
      result = { error: "Nieznana operacja" };
  }

  if (result.error) {
    return context.redirect(`/dashboard?error=${encodeURIComponent(result.error)}`);
  }
  return context.redirect("/dashboard");
};
