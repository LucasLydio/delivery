import { getRuntimeConfig } from '../../config/env';
import { PrismaMaintenanceRepository } from './maintenance.repository';
import { MaintenanceService } from './maintenance.service';

export function createDefaultMaintenanceService(): MaintenanceService {
  const config = getRuntimeConfig();
  return new MaintenanceService(new PrismaMaintenanceRepository(), {
    sessionDays: config.AUTH_SESSION_RETENTION_DAYS,
    orderEventDays: config.ORDER_EVENT_RETENTION_DAYS,
    snapshotDays: config.STATE_SNAPSHOT_RETENTION_DAYS,
    orphanPushSubscriptionDays: config.ORPHAN_PUSH_RETENTION_DAYS,
  });
}
