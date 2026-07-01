/** Długość kodu OTP wysyłanego przy rejestracji. */
export const OTP_LENGTH = 6;

/** Czy podany kod ma poprawny format (dokładnie OTP_LENGTH cyfr). Walidujemy przed wywołaniem verifyOtp. */
export function isValidOtpCode(code: string): boolean {
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code.trim());
}
