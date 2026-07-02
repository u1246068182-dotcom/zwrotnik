import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY, CRON_SECRET } from "astro:env/server";
import type { Database } from "@/db/database.types";
import { computeCloseDate, daysUntil } from "@/lib/urgency";
import { buildReminderEmail } from "@/lib/reminders";

export const prerender = false;

// Harmonogram (GitHub Actions co godzinę) woła ten endpoint z nagłówkiem Authorization: Bearer <CRON_SECRET>.
// Klient service-role (omija RLS) znajduje należne aktywne przypomnienia, wysyła Resend, zeruje reminder_at.
export const POST: APIRoute = async (context) => {
  const auth = context.request.headers.get("Authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "Brak konfiguracji" }), { status: 500 });
  }

  const admin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: due, error } = await admin
    .from("items")
    .select("*")
    .lte("reminder_at", new Date().toISOString())
    .not("reminder_at", "is", null)
    .eq("status_zalatwione", false);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const dashboardUrl = `${new URL(context.request.url).origin}/dashboard`;
  const today = new Date();
  let sent = 0;
  let failed = 0;

  for (const item of due) {
    try {
      const { data: userRes } = await admin.auth.admin.getUserById(item.user_id);
      const email = userRes.user?.email;
      if (!email) {
        failed++;
        continue;
      }
      const closeDate = computeCloseDate(item);
      const daysLeft = daysUntil(closeDate, today);
      const { subject, html } = buildReminderEmail(item, closeDate, daysLeft, dashboardUrl);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: "Zwrotnik <noreply@mojzwrotnik.uk>", to: [email], subject, html }),
      });
      if (!res.ok) {
        failed++;
        continue;
      }
      // Model 2-stanowy: po wysłaniu przypomnienie znika.
      await admin.from("items").update({ reminder_at: null }).eq("id", item.id);
      sent++;
    } catch {
      failed++;
    }
  }

  return new Response(JSON.stringify({ sent, failed }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
