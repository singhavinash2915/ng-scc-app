/**
 * Normalize an Indian phone number for WhatsApp API.
 * Handles formats: 9876543210, +919876543210, 09876543210, 919876543210
 * Returns 12-digit string (91 + 10 digits) or null if invalid.
 */
export function normalizePhoneForWhatsApp(phone: string): string | null {
  let cleaned = phone.replace(/\D/g, '');

  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }

  if (cleaned.length !== 12 || !cleaned.startsWith('91')) {
    return null;
  }

  return cleaned;
}

/**
 * Generate a WhatsApp URL with pre-filled message.
 * Returns null if phone number is invalid.
 */
export function generateWhatsAppUrl(phone: string, message: string): string | null {
  const normalized = normalizePhoneForWhatsApp(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
