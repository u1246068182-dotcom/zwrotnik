import { describe, expect, it } from "vitest";
import { OTP_LENGTH, isValidOtpCode } from "@/lib/otp";

// Walidacja formatu kodu OTP przed wywołaniem verifyOtp (odrzucamy oczywiste śmieci bez trafiania do Supabase).

describe("isValidOtpCode — format kodu", () => {
  it("dokładnie 6 cyfr → true", () => {
    expect(isValidOtpCode("123456")).toBe(true);
    expect(OTP_LENGTH).toBe(6);
  });

  it("przycina białe znaki i akceptuje 6 cyfr", () => {
    expect(isValidOtpCode("  654321 ")).toBe(true);
  });

  it("za krótki / za długi → false", () => {
    expect(isValidOtpCode("12345")).toBe(false);
    expect(isValidOtpCode("1234567")).toBe(false);
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
