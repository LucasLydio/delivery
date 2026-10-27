import type { PrismaClient } from '@prisma/client';
import { getPrisma } from '../../infra/prisma/client';

export interface RetentionCutoffs {
  sessions: Date;
  orderEvents: Date;
  snapshots: Date;
  orphanPushSubscriptions: Date;
}

export interface CleanupResult {
  customerSessions: number;
  userSessions: number;
  orderEvents: number;
  stateSnapshots: number;
  orphanPushSubscriptions: number;
}

export interface MaintenanceRepository {
  cleanup(cutoffs: RetentionCutoffs): Promise<CleanupResult>;
}

export class PrismaMaintenanceRepository implements MaintenanceRepository {
  constructor(private readonly client?: PrismaClient) {}
  private get prisma(): PrismaClient {
    return this.client ?? getPrisma();
  }

  async cleanup(cutoffs: RetentionCutoffs): Promise<CleanupResult> {
    return this.prisma.$transaction(async (transaction) => {
      const [customerSessions, userSessions, orderEvents, stateSnapshots, orphanPushSubscriptions] =
        await Promise.all([
          transaction.customerSession.deleteMany({
            where: {
              OR: [
                { expiresAt: { lt: cutoffs.sessions } },
                { revokedAt: { lt: cutoffs.sessions } },
              ],
            },
          }),
          transaction.userSession.deleteMany({
            where: {
              OR: [
                { expiresAt: { lt: cutoffs.sessions } },
                { revokedAt: { lt: cutoffs.sessions } },
              ],
            },
          }),
          transaction.orderEvent.deleteMany({ where: { createdAt: { lt: cutoffs.orderEvents } } }),
          transaction.stateSnapshot.deleteMany({ where: { createdAt: { lt: cutoffs.snapshots } } }),
          transaction.pushSubscription.deleteMany({
            where: { customerId: null, updatedAt: { lt: cutoffs.orphanPushSubscriptions } },
          }),
        ]);
      return {
        customerSessions: customerSessions.count,
        userSessions: userSessions.count,
        orderEvents: orderEvents.count,
        stateSnapshots: stateSnapshots.count,
        orphanPushSubscriptions: orphanPushSubscriptions.count,
      };
    });
  }
}
