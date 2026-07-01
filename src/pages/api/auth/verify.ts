import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { isValidOtpCode } from "@/lib/otp";

export const prerender = false;

// Potwierdzenie rejestracji 6-cyfrowym kodem (OTP). Po sukcesie wylogowujemy i kierujemy na logowanie.
export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = (form.get("email") as string | null)?.trim() ?? "";
  // Kod wklejany z maila bywa ze spacjami/myślnikami — normalizujemy do samych cyfr.
  const token = ((form.get("token") as string | null) ?? "").replace(/\D/g, "");

  const back = (msg: string): Response =>
    context.redirect(`/auth/verify?email=${encodeURIComponent(email)}&error=${encodeURIComponent(msg)}`);

  if (!email) {
    return context.redirect("/auth/signup");
  }
  if (!isValidOtpCode(token)) {
    return back("Kod musi mieć 6 cyfr.");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return back("Supabase nie jest skonfigurowany");
  }

  const { error } = await supabase.auth.verifyOtp({ email, token, type: "signup" });
  if (error) {
    return back("Kod nieprawidłowy lub wygasł. Spróbuj ponownie.");
  }

  // verifyOtp tworzy sesję — świadomie ją kończymy, by user zalogował się hasłem (decyzja UX).
  await supabase.auth.signOut();
  return context.redirect("/auth/signin?confirmed=1");
};
