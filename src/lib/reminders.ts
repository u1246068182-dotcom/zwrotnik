import type { Item } from "@/types";

const WARSAW_TZ = "Europe/Warsaw";

/** Offset strefy (ms, dodatni gdy strefa wyprzedza UTC) dla danego momentu UTC. */
function tzOffsetMs(utcMs: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const p: Record<string, number> = {};
  for (const part of dtf.formatToParts(new Date(utcMs))) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  // godzina 24 (północ) w Intl → traktuj jak 0
  const hour = p.hour === 24 ? 0 : p.hour;
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, hour, p.minute, p.second);
  return asUTC - utcMs;
}

/** „Naiwna" data (YYYY-MM-DD) + godzina (0–23) czasu polskiego → moment UTC (ISO). DST-aware. */
export function warsawWallTimeToUTC(dateISO: string, hour: number): string {
  const [y, m, d] = dateISO.slice(0, 10).split("-").map(Number);
  const wallAsUTC = Date.UTC(y, m - 1, d, hour, 0, 0);
  // offset liczony przy zgadniętym momencie — poza godziną przejścia DST zawsze poprawny
  const offset = tzOffsetMs(wallAsUTC, WARSAW_TZ);
  return new Date(wallAsUTC - offset).toISOString();
}

/** Moment UTC (ISO) → czytelny czas polski „YYYY-MM-DD HH:00" do wyświetlenia. */
export function formatReminderWarsaw(utcISO: string): string {
  const dtf = new Intl.DateTimeFormat("pl-PL", {
    timeZone: WARSAW_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(new Date(utcISO))) {
    if (part.type !== "literal") p[part.type] = part.value;
  }
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/** Czy przypomnienie jest należne do wysłania: ustawione, w przeszłości/teraz, pozycja aktywna. */
export function isReminderDue(reminderAt: string | null, statusZalatwione: boolean, now: Date): boolean {
  if (!reminderAt || statusZalatwione) return false;
  return new Date(reminderAt).getTime() <= now.getTime();
}

function fmtPln(n: number): string {
  return n.toLocaleString("pl-PL", { style: "currency", currency: "PLN" });
}

/** Treść maila przypomnienia dla pozycji (nazwa, termin, dni, kwota, link do panelu). */
export function buildReminderEmail(
  item: Pick<Item, "nazwa" | "kwota" | "sklep">,
  closeDateISO: string,
  daysLeft: number,
  dashboardUrl: string,
): { subject: string; html: string } {
  const dni =
    daysLeft < 0
      ? `termin minął ${Math.abs(daysLeft)} dni temu`
      : daysLeft === 0
        ? "termin dziś"
        : `zostało ${daysLeft} dni`;
  const subject = `Przypomnienie: ${item.nazwa} — ${dni}`;
  const html =
    `<h2>Przypomnienie ze Zwrotnika</h2>` +
    `<p><strong>${item.nazwa}</strong>${item.sklep ? ` (${item.sklep})` : ""}</p>` +
    `<p>Termin zamknięcia okna: <strong>${closeDateISO}</strong> — ${dni}.</p>` +
    `<p>Kwota: <strong>${fmtPln(item.kwota)}</strong>.</p>` +
    `<p><a href="${dashboardUrl}">Otwórz panel Zwrotnika</a></p>`;
  return { subject, html };
}
