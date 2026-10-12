import type { CartDraft, CartItemInput, CartPreviewLine, CartQuote } from "../../../shared/commerce-contract";
import { BadRequestException, ConflictException } from "../../shared/exceptions";
import type { CartCatalogProduct, CartRecord, CartsRepository } from "./carts.repository";
import type { SynchronizeCartInput } from "./carts.schema";

export interface PricedCart {
  lines: CartPreviewLine[];
  subtotalMinor: number;
}

function toDraft(cart: CartRecord | null): CartDraft {
  return cart ? {
    id: cart.id,
    revision: String(cart.revision),
    items: cart.items,
  } : { id: null, revision: null, items: [] };
}

function invalid(itemId: string, message: string): never {
  throw new BadRequestException("Cart contains invalid items", [{ itemId, message }]);
}

export function priceCart(items: CartItemInput[], products: CartCatalogProduct[], currency: string): PricedCart {
  const catalog = new Map(products.map((product) => [product.id, product]));
  const lines: CartPreviewLine[] = [];
  let subtotalMinor = 0;

  for (const item of items) {
    const product = catalog.get(item.productId);
    if (!product) invalid(item.id, "Product not found");
    if (!product.available) invalid(item.id, "Product is unavailable");
    if (product.currency !== currency) invalid(item.id, "Product currency does not match the cart");

    const remaining = new Set(item.selectedOptionIds);
    const selectedOptions: CartPreviewLine["selectedOptions"] = [];
    let optionTotalMinor = 0;
    for (const group of product.optionGroups) {
      const chosen = group.options.filter((option) => remaining.has(option.id));
      if (chosen.length < group.minSelections || chosen.length > group.maxSelections) {
        invalid(item.id, "Option selection does not satisfy its group limits");
      }
      if (chosen.some((option) => !option.available)) invalid(item.id, "Selected option is unavailable");
      for (const option of chosen) {
        remaining.delete(option.id);
        optionTotalMinor += option.priceDeltaMinor;
        selectedOptions.push({ id: option.id, name: option.name, priceDeltaMinor: option.priceDeltaMinor });
      }
    }
    if (remaining.size > 0) invalid(item.id, "Selected option does not belong to the product");

    const unitPriceMinor = product.basePriceMinor + optionTotalMinor;
    const lineTotalMinor = unitPriceMinor * item.quantity;
    if (!Number.isSafeInteger(unitPriceMinor) || unitPriceMinor < 0 ||
        !Number.isSafeInteger(lineTotalMinor) || !Number.isSafeInteger(subtotalMinor + lineTotalMinor)) {
      invalid(item.id, "Calculated amount is outside the supported range");
    }
    lines.push({
      itemId: item.id,
      productId: product.id,
      name: product.name,
      quantity: item.quantity,
      selectedOptions,
      unitPriceMinor,
      lineTotalMinor,
    });
    subtotalMinor += lineTotalMinor;
  }
  return { lines, subtotalMinor };
}

export class CartsService {
  constructor(
    private readonly repository: CartsRepository,
    private readonly currency: string,
    private readonly deliveryFeeMinor: number,
    private readonly quoteTtlSeconds: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async get(customerId: string): Promise<CartDraft> {
    return toDraft(await this.repository.find(customerId));
  }

  async synchronize(customerId: string, input: SynchronizeCartInput): Promise<CartDraft> {
    const expectedRevision = input.revision === null ? null : Number(input.revision);
    if (expectedRevision !== null && (!Number.isSafeInteger(expectedRevision) || expectedRevision > 2_147_483_647)) {
      throw new BadRequestException("Invalid cart revision");
    }
    const productIds = [...new Set(input.items.map((item) => item.productId))];
    const products = await this.repository.products(productIds);
    priceCart(input.items, products, this.currency);

    const result = await this.repository.replace(customerId, expectedRevision, this.currency, input.items);
    if (result.kind === "conflict") {
      throw new ConflictException("Cart revision conflict", { currentCart: toDraft(result.cart) });
    }
    return toDraft(result.cart);
  }

  async clear(customerId: string): Promise<void> {
    await this.repository.delete(customerId);
  }

  async quote(customerId: string): Promise<CartQuote> {
    const cart = await this.repository.find(customerId);
    if (!cart || cart.items.length === 0) throw new BadRequestException("Cart is empty");
    if (cart.currency !== this.currency) throw new BadRequestException("Cart currency is invalid");
    const productIds = [...new Set(cart.items.map((item) => item.productId))];
    const priced = priceCart(cart.items, await this.repository.products(productIds), this.currency);
    const taxMinor = 0;
    const totalMinor = priced.subtotalMinor + this.deliveryFeeMinor;
    if (!Number.isSafeInteger(totalMinor)) throw new BadRequestException("Calculated total is outside the supported range");
    return {
      kind: "confirmed",
      cartRevision: String(cart.revision),
      currency: this.currency,
      lines: priced.lines,
      subtotalMinor: priced.subtotalMinor,
      deliveryFeeMinor: this.deliveryFeeMinor,
      taxMinor,
      totalMinor,
      expiresAt: new Date(this.now().getTime() + this.quoteTtlSeconds * 1000).toISOString(),
    };
  }
}
