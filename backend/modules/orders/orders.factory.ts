import { getRuntimeConfig } from "../../config/env";
import { getCheckoutLock } from "../../infra/redis/checkout-lock";
import { HttpMercadoPagoGateway } from "./orders.mercado-pago";
import { parseMoneyToMinor } from "./orders.pricing";
import { PrismaOrdersRepository } from "./orders.repository";
import { OrdersService } from "./orders.service";

export function createDefaultOrdersService(): OrdersService {
  const config = getRuntimeConfig();
  return new OrdersService(
    new PrismaOrdersRepository(), getCheckoutLock(),
    new HttpMercadoPagoGateway(config.MERCADO_PAGO_ACCESS_TOKEN, config.MERCADO_PAGO_API_URL),
    {
      currency: config.CATALOG_CURRENCY,
      fallbackDeliveryPricing: { limitKm: Number(config.LIMIT_KM), feePerKmMinor: parseMoneyToMinor(config.FEE_PER_KM) },
      mercadoPagoFeePercent: Number(config.MERCADO_PAGO_FEE_PERCENT),
      shopLocation: config.SHOP_LATITUDE === undefined || config.SHOP_LONGITUDE === undefined
        ? null : { latitude: config.SHOP_LATITUDE, longitude: config.SHOP_LONGITUDE },
      quoteTtlSeconds: config.CART_QUOTE_TTL_SECONDS,
      lockTtlMs: config.CHECKOUT_LOCK_TTL_MS,
      unpaidTimeoutMinutes: config.UNPAID_ORDER_TIMEOUT_MINUTES,
    },
  );
}

