import { ValidationError } from "../errors/app-error";

export function normalizeWhatsAppPhone(value: string): string {
  const phone = value.replace(/^whatsapp:/i, "").trim();
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    throw new ValidationError("Invalid E.164 phone number");
  }
  return phone;
}

export function toWhatsAppAddress(phone: string): string {
  return `whatsapp:${normalizeWhatsAppPhone(phone)}`;
}
