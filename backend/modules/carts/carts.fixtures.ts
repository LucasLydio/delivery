import type { CartItemInput } from '../../../shared/commerce-contract';
import type {
  CartCatalogProduct,
  CartRecord,
  CartsRepository,
  ReplaceCartResult,
} from './carts.repository';

function cloneCart(cart: CartRecord): CartRecord {
  return {
    ...cart,
    items: cart.items.map((item) => ({ ...item, selectedOptionIds: [...item.selectedOptionIds] })),
  };
}

export class MemoryCartsRepository implements CartsRepository {
  readonly carts = new Map<string, CartRecord>();
  productsRows: CartCatalogProduct[] = [
    {
      id: 'product-1',
      name: 'Poke de salmão',
      basePriceMinor: 2500,
      currency: 'BRL',
      available: true,
      optionGroups: [
        {
          id: 'group-1',
          minSelections: 0,
          maxSelections: 1,
          options: [{ id: 'option-1', name: 'Abacate', priceDeltaMinor: 300, available: true }],
        },
      ],
    },
  ];

  async find(customerId: string): Promise<CartRecord | null> {
    const cart = this.carts.get(customerId);
    return cart ? cloneCart(cart) : null;
  }

  async products(productIds: string[]): Promise<CartCatalogProduct[]> {
    return this.productsRows.filter((product) => productIds.includes(product.id));
  }

  async replace(
    customerId: string,
    expectedRevision: number | null,
    currency: string,
    items: CartItemInput[],
  ): Promise<ReplaceCartResult> {
    const current = this.carts.get(customerId);
    if (
      (!current && expectedRevision !== null) ||
      (current && current.revision !== expectedRevision)
    ) {
      return { kind: 'conflict', cart: current ? cloneCart(current) : null };
    }
    const cart: CartRecord = {
      id: current?.id ?? `cart-${customerId}`,
      customerId,
      revision: current ? current.revision + 1 : 1,
      currency,
      items: items.map((item) => ({ ...item, selectedOptionIds: [...item.selectedOptionIds] })),
    };
    this.carts.set(customerId, cart);
    return { kind: 'saved', cart: cloneCart(cart) };
  }

  async delete(customerId: string): Promise<void> {
    this.carts.delete(customerId);
  }
}
