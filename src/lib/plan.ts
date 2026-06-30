/** Limit aktywnych pozycji w darmowym planie. */
export const FREE_ITEM_LIMIT = 30;

/** Czy użytkownik przekroczył limit darmowego planu (egzekwowane przed dodaniem pozycji). */
export function isOverFreeLimit(plan: string, activeCount: number): boolean {
  return plan === "free" && activeCount >= FREE_ITEM_LIMIT;
}
