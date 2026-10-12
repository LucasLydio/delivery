import { BadRequestException } from "../shared/exceptions";

const brazilianRegions = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

export function normalizeBrazilianPostalCode(value: string): string {
  const postalCode = value.replace(/\D/g, "");
  if (!/^\d{8}$/.test(postalCode)) throw new BadRequestException("Postal code must be a valid Brazilian CEP");
  return postalCode;
}

export function formatBrazilianPostalCode(value: string): string {
  return /^\d{8}$/.test(value) ? `${value.slice(0, 5)}-${value.slice(5)}` : value;
}

export function normalizeBrazilianRegion(value: string): string {
  const region = value.trim().toUpperCase();
  if (!brazilianRegions.has(region)) throw new BadRequestException("Region must be a valid Brazilian state code");
  return region;
}
