/** Limit aktywnych pozycji w darmowym planie.
 *  Wysoki do czasu wdrożenia płatności (wersja 2) — mechanizm zostaje, ale nikt realnie nie uderza w limit.
 *  Wróć do ~30, gdy odblokowanie premium będzie działać. */
export const FREE_ITEM_LIMIT = 1000;

/** Czy użytkownik przekroczył limit darmowego planu (egzekwowane przed dodaniem pozycji). */
export function isOverFreeLimit(plan: string, activeCount: number): boolean {
  return plan === "free" && activeCount >= FREE_ITEM_LIMIT;
}
