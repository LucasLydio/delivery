import type { Address } from "../../../shared/commerce-contract";
import { ConflictException, NotFoundException } from "../../shared/exceptions";
import { formatBrazilianPostalCode, normalizeBrazilianPostalCode, normalizeBrazilianRegion } from "../../utils/address";
import { AddressLimitError, type AddressPatch, type AddressRecord, type AddressesRepository, type AddressWrite } from "./addresses.repository";
import type { CreateAddressInput, UpdateAddressInput } from "./addresses.schema";

function optionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) return value;
  const trimmed = value.trim();
  return trimmed || null;
}

function toAddress(row: AddressRecord): Address {
  return {
    id: row.id,
    customerId: row.customerId,
    label: row.label,
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    region: row.region,
    postalCode: formatBrazilianPostalCode(row.postalCode),
    countryCode: row.countryCode,
    deliveryInstructions: row.deliveryInstructions,
    locationPin: row.locationPin,
    isDefault: row.isDefault,
  };
}

export class AddressesService {
  constructor(private readonly repository: AddressesRepository, private readonly maximumAddresses = 10) {}

  async list(customerId: string): Promise<Address[]> {
    return (await this.repository.list(customerId)).map(toAddress);
  }

  async create(customerId: string, input: CreateAddressInput): Promise<Address> {
    const write: AddressWrite = {
      label: input.label.trim(),
      line1: input.line1.trim(),
      line2: optionalText(input.line2),
      city: input.city.trim(),
      region: normalizeBrazilianRegion(input.region),
      postalCode: normalizeBrazilianPostalCode(input.postalCode),
      countryCode: "BR",
      deliveryInstructions: optionalText(input.deliveryInstructions),
      locationPin: input.locationPin,
    };
    try {
      return toAddress(await this.repository.create(customerId, write, input.isDefault ?? false, this.maximumAddresses));
    } catch (error) {
      if (error instanceof AddressLimitError) throw new ConflictException("Address limit reached");
      throw error;
    }
  }

  async update(customerId: string, addressId: string, input: UpdateAddressInput): Promise<Address> {
    const patch: AddressPatch = {};
    if (input.label !== undefined) patch.label = input.label.trim();
    if (input.line1 !== undefined) patch.line1 = input.line1.trim();
    if (input.line2 !== undefined) patch.line2 = optionalText(input.line2);
    if (input.city !== undefined) patch.city = input.city.trim();
    if (input.region !== undefined) patch.region = normalizeBrazilianRegion(input.region);
    if (input.postalCode !== undefined) patch.postalCode = normalizeBrazilianPostalCode(input.postalCode);
    if (input.deliveryInstructions !== undefined) patch.deliveryInstructions = optionalText(input.deliveryInstructions);
    if (input.locationPin !== undefined) patch.locationPin = input.locationPin;
    const address = await this.repository.update(customerId, addressId, patch);
    if (!address) throw new NotFoundException("Address not found");
    return toAddress(address);
  }

  async setDefault(customerId: string, addressId: string): Promise<Address> {
    const address = await this.repository.setDefault(customerId, addressId);
    if (!address) throw new NotFoundException("Address not found");
    return toAddress(address);
  }

  async delete(customerId: string, addressId: string): Promise<void> {
    if (!await this.repository.delete(customerId, addressId)) throw new NotFoundException("Address not found");
  }
}
