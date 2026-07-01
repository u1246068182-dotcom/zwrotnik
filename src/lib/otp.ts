/** Dozwolony zakres długości kodu OTP z e-maila.
 *  Supabase potrafi wysyłać 6 lub 8 cyfr zależnie od konfiguracji — akceptujemy zakres,
 *  żeby zmiana `mailer_otp_length` po stronie Supabase nie psuła weryfikacji. */
export const OTP_MIN_LENGTH = 6;
export const OTP_MAX_LENGTH = 8;

/** Czy kod ma poprawny format (6–8 cyfr). Walidujemy przed wywołaniem verifyOtp. */
export function isValidOtpCode(code: string): boolean {
  return new RegExp(`^\\d{${OTP_MIN_LENGTH},${OTP_MAX_LENGTH}}$`).test(code.trim());
}
