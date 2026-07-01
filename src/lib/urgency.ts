import type { Item, ItemView, UrgencyStatus, UrgencyView } from "@/types";

const DEFAULT_RETURN_DAYS = 14; // ustawowe okno zwrotu
const REKOJMIA_DAYS = 730; // rękojmia: 2 lata
const DAY_MS = 86_400_000;

/** Parsuje część datową (YYYY-MM-DD) jako UTC, ignorując czas/strefę. */
function parseUTCDate(iso: string): Date {
  const parts = iso.slice(0, 10).split("-");
  return new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  return toISODate(new Date(parseUTCDate(iso).getTime() + days * DAY_MS));
}

/** Data zamknięcia okna pozycji, zależna od typu okna. */
export function computeCloseDate(item: Pick<Item, "typ_okna" | "data_odniesienia" | "dlugosc_okna_dni">): string {
  switch (item.typ_okna) {
    case "zwrot":
      return addDays(item.data_odniesienia, item.dlugosc_okna_dni ?? DEFAULT_RETURN_DAYS);
    case "rekojmia":
      return addDays(item.data_odniesienia, REKOJMIA_DAYS);
    default: // subskrypcja / wlasny: wpisana data jest datą zamknięcia
      return item.data_odniesienia.slice(0, 10);
  }
}

/** Liczba całych dni do zamknięcia (ujemna = po terminie). `today` wstrzykiwane. */
export function daysUntil(closeISO: string, today: Date): number {
  const close = parseUTCDate(closeISO).getTime();
  const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((close - todayUTC) / DAY_MS);
}

/** Status pilności wg progów dni: <0 minęło · 0–3 pilne · 4–14 wkrótce · >14 spokojnie. */
export function statusForDays(days: number): UrgencyStatus {
  if (days < 0) return "minelo";
  if (days <= 3) return "pilne";
  if (days <= 14) return "wkrotce";
  return "spokojnie";
}

const ZAGROZONE: UrgencyStatus[] = ["pilne", "wkrotce"];

/**
 * Buduje widok listy: pomija pozycje załatwione, liczy status/dni dla każdej,
 * grupuje w kubełki (sort wg kwoty malejąco) i sumuje kwoty zagrożone (pilne + wkrótce).
 */
export function buildUrgencyView(items: Item[], today: Date): UrgencyView {
  const buckets: Record<UrgencyStatus, ItemView[]> = { pilne: [], wkrotce: [], spokojnie: [], minelo: [] };
  let sumaZagrozona = 0;

  for (const item of items) {
    if (item.status_zalatwione) continue;
    const dataZamkniecia = computeCloseDate(item);
    const dniDoZamkniecia = daysUntil(dataZamkniecia, today);
    const status = statusForDays(dniDoZamkniecia);
    buckets[status].push({ ...item, dataZamkniecia, dniDoZamkniecia, status });
    if (ZAGROZONE.includes(status)) sumaZagrozona += item.kwota;
  }

  for (const status of Object.keys(buckets) as UrgencyStatus[]) {
    buckets[status].sort((a, b) => b.kwota - a.kwota);
  }

  return { buckets, sumaZagrozona };
}
