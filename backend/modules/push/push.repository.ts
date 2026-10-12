import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "../../infra/prisma/client";
import type { PushDeletion, PushRegistration } from "./push.schema";

export interface PushRepository {
  upsert(input: PushRegistration): Promise<void>;
  delete(input: PushDeletion): Promise<boolean>;
}

export class PrismaPushRepository implements PushRepository {
  constructor(private readonly client?: PrismaClient) {}

  private get prisma(): PrismaClient { return this.client ?? getPrisma(); }

  async upsert(input: PushRegistration): Promise<void> {
    const { installId, subscription } = input;
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        installId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      update: {
        installId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });
  }

  async delete(input: PushDeletion): Promise<boolean> {
    const result = await this.prisma.pushSubscription.deleteMany({
      where: { installId: input.installId, endpoint: input.endpoint },
    });
    return result.count > 0;
  }
}
