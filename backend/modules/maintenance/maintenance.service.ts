import type { CleanupResult, MaintenanceRepository } from './maintenance.repository';

const DAY_MS = 86_400_000;

export interface RetentionPolicy {
  sessionDays: number;
  orderEventDays: number;
  snapshotDays: number;
  orphanPushSubscriptionDays: number;
}

export const defaultRetentionPolicy: RetentionPolicy = {
  sessionDays: 7,
  orderEventDays: 90,
  snapshotDays: 7,
  orphanPushSubscriptionDays: 7,
};

export class MaintenanceService {
  constructor(
    private readonly repository: MaintenanceRepository,
    private readonly policy: RetentionPolicy = defaultRetentionPolicy,
    private readonly now: () => Date = () => new Date(),
  ) {}

  cleanup(): Promise<CleanupResult> {
    const current = this.now().getTime();
    return this.repository.cleanup({
      sessions: new Date(current - this.policy.sessionDays * DAY_MS),
      orderEvents: new Date(current - this.policy.orderEventDays * DAY_MS),
      snapshots: new Date(current - this.policy.snapshotDays * DAY_MS),
      orphanPushSubscriptions: new Date(current - this.policy.orphanPushSubscriptionDays * DAY_MS),
    });
  }
}
