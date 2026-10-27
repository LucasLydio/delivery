import type { PrismaClient } from '@prisma/client';
import { getPrisma } from '../../infra/prisma/client';
import type { PushDeletion, PushRegistration } from './push.schema';

export interface StoredPushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushRepository {
  upsert(customerId: string, input: PushRegistration, maximum: number): Promise<void>;
  delete(customerId: string, input: PushDeletion): Promise<boolean>;
  listForOrder(orderId: string): Promise<StoredPushSubscription[]>;
  deleteByEndpoint(endpoint: string): Promise<void>;
}

export class PrismaPushRepository implements PushRepository {
  constructor(private readonly client?: PrismaClient) {}

  private get prisma(): PrismaClient {
    return this.client ?? getPrisma();
  }

  async upsert(customerId: string, input: PushRegistration, maximum: number): Promise<void> {
    const { installId, subscription } = input;
    await this.prisma.$transaction(async (transaction) => {
      await transaction.pushSubscription.upsert({
        where: { endpoint: subscription.endpoint },
        create: {
          customerId,
          installId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
        update: {
          customerId,
          installId,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      });
      const excess = await transaction.pushSubscription.findMany({
        where: { customerId },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: maximum,
        select: { id: true },
      });
      if (excess.length)
        await transaction.pushSubscription.deleteMany({
          where: { id: { in: excess.map(({ id }) => id) } },
        });
    });
  }

  async delete(customerId: string, input: PushDeletion): Promise<boolean> {
    const result = await this.prisma.pushSubscription.deleteMany({
      where: { customerId, installId: input.installId, endpoint: input.endpoint },
    });
    return result.count > 0;
  }

  listForOrder(orderId: string): Promise<StoredPushSubscription[]> {
    return this.prisma.pushSubscription.findMany({
      where: { customer: { orders: { some: { id: orderId } } } },
      select: { endpoint: true, p256dh: true, auth: true },
    });
  }

  async deleteByEndpoint(endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
  }
}
