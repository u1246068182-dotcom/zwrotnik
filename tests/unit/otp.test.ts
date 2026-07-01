import { describe, expect, it } from "vitest";
import { OTP_MIN_LENGTH, OTP_MAX_LENGTH, isValidOtpCode } from "@/lib/otp";

// Walidacja formatu kodu OTP przed verifyOtp. Akceptujemy 6–8 cyfr (Supabase wysyła 6 lub 8).

describe("isValidOtpCode — format kodu", () => {
  it("6 i 8 cyfr → true (granice zakresu)", () => {
    expect(isValidOtpCode("123456")).toBe(true);
    expect(isValidOtpCode("12345678")).toBe(true);
    expect(OTP_MIN_LENGTH).toBe(6);
    expect(OTP_MAX_LENGTH).toBe(8);
  });

  it("7 cyfr (wewnątrz zakresu) → true", () => {
    expect(isValidOtpCode("1234567")).toBe(true);
  });

  it("przycina białe znaki", () => {
    expect(isValidOtpCode("  87654321 ")).toBe(true);
  });

  it("za krótki (<6) / za długi (>8) → false", () => {
    expect(isValidOtpCode("12345")).toBe(false);
    expect(isValidOtpCode("123456789")).toBe(false);
  });

  it("nie-cyfry → false", () => {
    expect(isValidOtpCode("12a456")).toBe(false);
    expect(isValidOtpCode("abcdef")).toBe(false);
    expect(isValidOtpCode("12 456")).toBe(false);
  });

  it("puste → false", () => {
    expect(isValidOtpCode("")).toBe(false);
    expect(isValidOtpCode("   ")).toBe(false);
  });
});
