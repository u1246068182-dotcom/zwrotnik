import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent("Supabase is not configured")}`);
  }
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent(error.message)}`);
  }

  // Ochrona przed enumeracją: dla JUŻ POTWIERDZONEGO konta Supabase zwraca „obfuscated" usera
  // z pustą tablicą `identities` (bez błędu, bez maila). Wtedy kierujemy na logowanie z komunikatem.
  if (data.user && data.user.identities?.length === 0) {
    return context.redirect("/auth/signin?exists=1");
  }

  // Konto powstaje nieaktywne — Supabase wysyła 6-cyfrowy kod. Kierujemy na stronę wpisania kodu.
  // (Dla istniejącego, niepotwierdzonego maila Supabase ponawia kod — user kontynuuje tutaj.)
  return context.redirect(`/auth/verify?email=${encodeURIComponent(email)}`);
};
