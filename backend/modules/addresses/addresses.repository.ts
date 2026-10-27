import { Prisma, type Address as PrismaAddress, type PrismaClient } from "@prisma/client";
import { getPrisma } from "../../infra/prisma/client";
import type { LocationPinInput } from "./addresses.schema";

export interface AddressRecord {
  id: string;
  customerId: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string;
  countryCode: string;
  deliveryInstructions: string | null;
  locationPin: LocationPinInput | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddressWrite {
  label: string;
  line1: string;
  line2?: string | null;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  deliveryInstructions?: string | null;
  locationPin?: LocationPinInput | null;
}

export type AddressPatch = Partial<AddressWrite>;
export class AddressLimitError extends Error {}

export interface AddressesRepository {
  list(customerId: string): Promise<AddressRecord[]>;
  create(customerId: string, input: AddressWrite, makeDefault: boolean, maximum: number): Promise<AddressRecord>;
  update(customerId: string, addressId: string, input: AddressPatch): Promise<AddressRecord | null>;
  setDefault(customerId: string, addressId: string): Promise<AddressRecord | null>;
  delete(customerId: string, addressId: string): Promise<boolean>;
}

function locationPin(value: Prisma.JsonValue | null): LocationPinInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const pin = value as Record<string, Prisma.JsonValue>;
  if (typeof pin["latitude"] !== "number" || typeof pin["longitude"] !== "number") return null;
  return {
    latitude: pin["latitude"],
    longitude: pin["longitude"],
    ...(typeof pin["accuracyMeters"] === "number" ? { accuracyMeters: pin["accuracyMeters"] } : {}),
  };
}

function toRecord(row: PrismaAddress): AddressRecord {
  return { ...row, locationPin: locationPin(row.locationPin) };
}

function jsonValue(value: LocationPinInput | null | undefined): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  return { ...value };
}

export class PrismaAddressesRepository implements AddressesRepository {
  constructor(private readonly client?: PrismaClient) {}

  private get prisma(): PrismaClient { return this.client ?? getPrisma(); }

  async list(customerId: string): Promise<AddressRecord[]> {
    const rows = await this.prisma.address.findMany({
      where: { customerId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map(toRecord);
  }

  create(customerId: string, input: AddressWrite, makeDefault: boolean, maximum = 10): Promise<AddressRecord> {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockCustomer(transaction, customerId);
      const addressCount = await transaction.address.count({ where: { customerId } });
      if (addressCount >= maximum) throw new AddressLimitError();
      const firstAddress = addressCount === 0;
      const isDefault = makeDefault || firstAddress;
      if (isDefault) await transaction.address.updateMany({ where: { customerId, isDefault: true }, data: { isDefault: false } });
      const row = await transaction.address.create({
        data: { ...input, customerId, locationPin: jsonValue(input.locationPin), isDefault },
      });
      return toRecord(row);
    });
  }

  update(customerId: string, addressId: string, input: AddressPatch): Promise<AddressRecord | null> {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockCustomer(transaction, customerId);
      const existing = await transaction.address.findFirst({ where: { id: addressId, customerId }, select: { id: true } });
      if (!existing) return null;
      const row = await transaction.address.update({
        where: { id: addressId },
        data: { ...input, locationPin: jsonValue(input.locationPin) },
      });
      return toRecord(row);
    });
  }

  setDefault(customerId: string, addressId: string): Promise<AddressRecord | null> {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockCustomer(transaction, customerId);
      const existing = await transaction.address.findFirst({ where: { id: addressId, customerId }, select: { id: true } });
      if (!existing) return null;
      await transaction.address.updateMany({ where: { customerId, isDefault: true, id: { not: addressId } }, data: { isDefault: false } });
      return toRecord(await transaction.address.update({ where: { id: addressId }, data: { isDefault: true } }));
    });
  }

  delete(customerId: string, addressId: string): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockCustomer(transaction, customerId);
      const existing = await transaction.address.findFirst({ where: { id: addressId, customerId }, select: { id: true, isDefault: true } });
      if (!existing) return false;
      await transaction.address.delete({ where: { id: addressId } });
      if (existing.isDefault) {
        const replacement = await transaction.address.findFirst({ where: { customerId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true } });
        if (replacement) await transaction.address.update({ where: { id: replacement.id }, data: { isDefault: true } });
      }
      return true;
    });
  }

  private async lockCustomer(transaction: Prisma.TransactionClient, customerId: string): Promise<void> {
    await transaction.$queryRaw`SELECT "id" FROM "customers" WHERE "id" = ${customerId} FOR UPDATE`;
  }
}
