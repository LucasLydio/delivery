import { Router } from 'express';
import { getRuntimeConfig } from './config/env';
import { getProductStorage } from './config/storage';
import { getCatalogCache } from './infra/redis/catalog-cache';
import { AddressesController } from './modules/addresses/addresses.controller';
import { PrismaAddressesRepository } from './modules/addresses/addresses.repository';
import { createAddressesRoutes } from './modules/addresses/addresses.routes';
import { AddressesService } from './modules/addresses/addresses.service';
import { CartsController } from './modules/carts/carts.controller';
import { PrismaCartsRepository } from './modules/carts/carts.repository';
import { createCartsRoutes } from './modules/carts/carts.routes';
import { CartsService } from './modules/carts/carts.service';
import {
  AdminCategoriesController,
  CategoriesController,
} from './modules/categories/categories.controller';
import { PrismaCategoriesRepository } from './modules/categories/categories.repository';
import {
  createAdminCategoriesRoutes,
  createCategoriesRoutes,
} from './modules/categories/categories.routes';
import { CategoriesService } from './modules/categories/categories.service';
import { CustomersController } from './modules/customers/customers.controller';
import { PrismaCustomersRepository } from './modules/customers/customers.repository';
import { createCustomersRoutes } from './modules/customers/customers.routes';
import { CustomersService } from './modules/customers/customers.service';
import { CustomerTokenService } from './modules/customers/customers.tokens';
import {
  AdminProductsController,
  ProductsController,
} from './modules/products/products.controller';
import { PrismaProductsRepository } from './modules/products/products.repository';
import {
  createAdminProductsRoutes,
  createProductsRoutes,
} from './modules/products/products.routes';
import { ProductsService } from './modules/products/products.service';
import { AdminOrdersController, OrdersController } from './modules/orders/orders.controller';
import { createDefaultOrdersService } from './modules/orders/orders.factory';
import {
  createAdminOrdersRoutes,
  createCheckoutRoutes,
  createOrdersRoutes,
  createOrdersWebhookRoutes,
} from './modules/orders/orders.routes';
import { OrdersService } from './modules/orders/orders.service';
import { MercadoPagoWebhookController } from './modules/orders/orders.webhook';
import { PushController } from './modules/push/push.controller';
import { PrismaPushRepository } from './modules/push/push.repository';
import { createPushRoutes } from './modules/push/push.routes';
import { PushService } from './modules/push/push.service';
import { SystemController } from './modules/system/system.controller';
import { createSystemRoutes } from './modules/system/system.routes';
import { SystemService } from './modules/system/system.service';
import { UsersController } from './modules/users/users.controller';
import { ScryptPasswordHasher } from './modules/users/users.password';
import { PrismaUsersRepository } from './modules/users/users.repository';
import { createUsersRoutes } from './modules/users/users.routes';
import { UsersService } from './modules/users/users.service';
import { UserTokenService } from './modules/users/users.tokens';

export interface RouteDependencies {
  addressesService?: AddressesService;
  cartsService?: CartsService;
  categoriesService?: CategoriesService;
  customersService?: CustomersService;
  productsService?: ProductsService;
  ordersService?: OrdersService;
  pushService?: PushService;
  systemService?: SystemService;
  usersService?: UsersService;
}

export function createApiRoutes(dependencies: RouteDependencies = {}): Router {
  const config = getRuntimeConfig();
  const addressesService =
    dependencies.addressesService ??
    new AddressesService(new PrismaAddressesRepository(), config.MAX_ADDRESSES_PER_CUSTOMER);
  const cartsService =
    dependencies.cartsService ??
    new CartsService(
      new PrismaCartsRepository(),
      config.CATALOG_CURRENCY,
      config.CART_DELIVERY_FEE_MINOR,
      config.CART_QUOTE_TTL_SECONDS,
    );
  const categoriesService =
    dependencies.categoriesService ??
    new CategoriesService(
      new PrismaCategoriesRepository(),
      getCatalogCache(),
      config.CACHE_NAMESPACE,
    );
  const customersService =
    dependencies.customersService ??
    new CustomersService(
      new PrismaCustomersRepository(),
      new CustomerTokenService(
        config.AUTH_TOKEN_SECRET,
        config.AUTH_TOKEN_ISSUER,
        config.AUTH_TOKEN_AUDIENCE,
        config.AUTH_ACCESS_TOKEN_TTL_SECONDS,
      ),
      config.AUTH_REFRESH_TOKEN_TTL_DAYS,
    );
  const productsService =
    dependencies.productsService ??
    new ProductsService(
      new PrismaProductsRepository(),
      getCatalogCache(),
      config.CATALOG_CURRENCY,
      getProductStorage(),
      config.CACHE_NAMESPACE,
    );
  const ordersService = dependencies.ordersService ?? createDefaultOrdersService();
  const pushService =
    dependencies.pushService ??
    new PushService(new PrismaPushRepository(), config.MAX_PUSH_SUBSCRIPTIONS_PER_CUSTOMER);
  const systemService =
    dependencies.systemService ??
    new SystemService(
      config.VAPID_PUBLIC_KEY,
      Boolean(config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY && config.VAPID_SUBJECT),
    );
  const usersService =
    dependencies.usersService ??
    new UsersService(
      new PrismaUsersRepository(),
      new ScryptPasswordHasher(),
      new UserTokenService(
        config.ADMIN_AUTH_TOKEN_SECRET ?? config.AUTH_TOKEN_SECRET,
        config.AUTH_TOKEN_ISSUER,
        config.ADMIN_AUTH_TOKEN_AUDIENCE,
        config.ADMIN_AUTH_ACCESS_TOKEN_TTL_SECONDS,
      ),
      config.ADMIN_AUTH_REFRESH_TOKEN_TTL_DAYS,
    );

  const router = Router();
  router.use(createSystemRoutes(new SystemController(systemService)));
  router.use(
    createCustomersRoutes(
      new CustomersController(
        customersService,
        config.AUTH_REFRESH_COOKIE_NAME,
        config.AUTH_REFRESH_TOKEN_TTL_DAYS,
      ),
    ),
  );
  router.use(
    '/me/addresses',
    createAddressesRoutes(new AddressesController(addressesService, customersService)),
  );
  router.use('/cart', createCartsRoutes(new CartsController(cartsService, customersService)));
  router.use('/categories', createCategoriesRoutes(new CategoriesController(categoriesService)));
  const ordersController = new OrdersController(ordersService, customersService);
  router.use('/checkout', createCheckoutRoutes(ordersController));
  router.use('/orders', createOrdersRoutes(ordersController));
  router.use(
    '/webhooks',
    createOrdersWebhookRoutes(
      new MercadoPagoWebhookController(ordersService, config.MERCADO_PAGO_WEBHOOK_SECRET),
    ),
  );
  router.use('/products', createProductsRoutes(new ProductsController(productsService)));
  router.use('/push', createPushRoutes(new PushController(pushService, customersService)));
  router.use(
    '/admin/orders',
    createAdminOrdersRoutes(new AdminOrdersController(ordersService, usersService)),
  );
  router.use(
    '/admin/categories',
    createAdminCategoriesRoutes(new AdminCategoriesController(categoriesService, usersService)),
  );
  router.use(
    '/admin/products',
    createAdminProductsRoutes(new AdminProductsController(productsService, usersService)),
  );
  router.use(
    '/admin',
    createUsersRoutes(
      new UsersController(
        usersService,
        config.ADMIN_AUTH_REFRESH_COOKIE_NAME,
        config.ADMIN_AUTH_REFRESH_TOKEN_TTL_DAYS,
      ),
    ),
  );
  return router;
}
