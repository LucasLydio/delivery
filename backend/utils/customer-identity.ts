import { BadRequestException } from "../shared/exceptions";

const displayNamePattern = /^[\p{L}\s]+$/u;

export interface CustomerIdentity {
  displayName: string;
  loginName: string;
  phone: string;
}

export function normalizeCustomerName(value: string): Pick<CustomerIdentity, "displayName" | "loginName"> {
  const displayName = value.trim().replace(/\s+/g, " ");
  if (displayName.length < 2 || displayName.length > 80 || !displayNamePattern.test(displayName)) {
    throw new BadRequestException("Name must contain only letters and spaces");
  }

  const loginName = displayName
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s/g, "")
    .toLowerCase();
  if (!/^[a-z]{2,80}$/.test(loginName)) {
    throw new BadRequestException("Name cannot contain special characters");
  }
  return { displayName, loginName };
}

export function normalizeBrazilianPhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length === 13) digits = digits.slice(2);
  if (!/^[1-9]{2}9\d{8}$/.test(digits)) {
    throw new BadRequestException("Phone must use the format (XX) X XXXX-XXXX");
  }
  return `+55${digits}`;
}

export function formatBrazilianPhone(value: string): string {
  const digits = value.replace(/\D/g, "").replace(/^55(?=\d{11}$)/, "");
  if (!/^\d{11}$/.test(digits)) return value;
  return `(${digits.slice(0, 2)}) ${digits[2]} ${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function normalizeCustomerIdentity(name: string, phone: string): CustomerIdentity {
  return { ...normalizeCustomerName(name), phone: normalizeBrazilianPhone(phone) };
}
