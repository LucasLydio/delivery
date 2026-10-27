import {
  AddressLimitError,
  type AddressPatch,
  type AddressRecord,
  type AddressesRepository,
  type AddressWrite,
} from './addresses.repository';

export class MemoryAddressesRepository implements AddressesRepository {
  readonly rows: AddressRecord[] = [];
  private sequence = 0;

  async list(customerId: string): Promise<AddressRecord[]> {
    return this.rows
      .filter((row) => row.customerId === customerId)
      .sort(
        (left, right) =>
          Number(right.isDefault) - Number(left.isDefault) ||
          left.createdAt.getTime() - right.createdAt.getTime(),
      );
  }

  async create(
    customerId: string,
    input: AddressWrite,
    makeDefault: boolean,
    maximum = 10,
  ): Promise<AddressRecord> {
    const customerRows = this.rows.filter((row) => row.customerId === customerId);
    if (customerRows.length >= maximum) throw new AddressLimitError();
    const isDefault = makeDefault || customerRows.length === 0;
    if (isDefault)
      customerRows.forEach((row) => {
        row.isDefault = false;
      });
    const now = new Date(Date.UTC(2026, 9, 12, 12, this.sequence));
    const row: AddressRecord = {
      id: `address-${++this.sequence}`,
      customerId,
      label: input.label,
      line1: input.line1,
      line2: input.line2 ?? null,
      city: input.city,
      region: input.region,
      postalCode: input.postalCode,
      countryCode: input.countryCode,
      deliveryInstructions: input.deliveryInstructions ?? null,
      locationPin: input.locationPin ?? null,
      isDefault,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.push(row);
    return row;
  }

  async update(
    customerId: string,
    addressId: string,
    input: AddressPatch,
  ): Promise<AddressRecord | null> {
    const row = this.rows.find((item) => item.id === addressId && item.customerId === customerId);
    if (!row) return null;
    Object.assign(row, input, { updatedAt: new Date() });
    return row;
  }

  async setDefault(customerId: string, addressId: string): Promise<AddressRecord | null> {
    const row = this.rows.find((item) => item.id === addressId && item.customerId === customerId);
    if (!row) return null;
    this.rows
      .filter((item) => item.customerId === customerId)
      .forEach((item) => {
        item.isDefault = item.id === addressId;
      });
    return row;
  }

  async delete(customerId: string, addressId: string): Promise<boolean> {
    const index = this.rows.findIndex(
      (item) => item.id === addressId && item.customerId === customerId,
    );
    if (index < 0) return false;
    const [deleted] = this.rows.splice(index, 1);
    if (deleted.isDefault) {
      const replacement = this.rows.find((item) => item.customerId === customerId);
      if (replacement) replacement.isDefault = true;
    }
    return true;
  }
}
