import type { Database } from "@/db/database.types";

/** Wiersz pozycji z bazy (źródło prawdy: wygenerowane typy Supabase). */
export type Item = Database["public"]["Tables"]["items"]["Row"];

/** Typ okna czasowego pozycji. */
export type WindowType = "zwrot" | "rekojmia" | "subskrypcja" | "wlasny";

/** Status pilności wyliczony przez silnik. */
export type UrgencyStatus = "pilne" | "wkrotce" | "spokojnie" | "minelo";

/** Pozycja wzbogacona o wyliczenia silnika pilności. */
export interface ItemView extends Item {
  dataZamkniecia: string;
  dniDoZamkniecia: number;
  status: UrgencyStatus;
}

/** Widok listy: pozycje pogrupowane w kubełki + suma kwot zagrożonych. */
export interface UrgencyView {
  buckets: Record<UrgencyStatus, ItemView[]>;
  sumaZagrozona: number;
}
