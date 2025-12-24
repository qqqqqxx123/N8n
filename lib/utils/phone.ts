/**
 * Normalize phone number to E.164 format
 * Supports various input formats and attempts to convert to E.164
 * @param phone - Phone number to normalize
 * @param defaultCountryCode - Default country code to use if not provided (default: '852' for Hong Kong)
 */
export function normalizePhoneToE164(phone: string, defaultCountryCode: string = '852'): string | null {
  if (!phone) return null;

  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // If it already starts with +, validate it
  if (cleaned.startsWith('+')) {
    // E.164 format: +[country code][number], total length 1-15 digits after +
    if (cleaned.length >= 8 && cleaned.length <= 16) {
      return cleaned;
    }
  }

  // If it starts with 00 (international format), replace with +
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2);
    if (cleaned.length >= 8 && cleaned.length <= 16) {
      return cleaned;
    }
  }

  // For Hong Kong numbers (8 digits), use default country code 852
  // For other shorter numbers (7-9 digits), use default country code
  if (cleaned.length >= 7 && cleaned.length <= 9) {
    return `+${defaultCountryCode}${cleaned}`;
  }

  // If it's a US number (10 digits or 11 starting with 1)
  if (cleaned.length === 10) {
    // Only assume US if default is not 852 (to avoid conflicts)
    if (defaultCountryCode === '852') {
      // For 10-digit numbers with HK default, still use HK code
      return `+${defaultCountryCode}${cleaned}`;
    }
    return `+1${cleaned}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }

  // For 10+ digit numbers without country code, use default
  if (cleaned.length >= 10 && cleaned.length <= 15) {
    return `+${defaultCountryCode}${cleaned}`;
  }

  // If we can't normalize it, return null
  return null;
}


