import assert from "node:assert/strict";
import { test } from "node:test";
import type { CleanupResult, MaintenanceRepository, RetentionCutoffs } from "./maintenance.repository";
import { MaintenanceService } from "./maintenance.service";

class MemoryMaintenanceRepository implements MaintenanceRepository {
  cutoffs?: RetentionCutoffs;
  async cleanup(cutoffs: RetentionCutoffs): Promise<CleanupResult> {
    this.cutoffs = cutoffs;
    return { customerSessions: 2, userSessions: 1, orderEvents: 4, stateSnapshots: 3, orphanPushSubscriptions: 1 };
  }
}

test("maintenance applies bounded retention without adding another scheduled invocation", async () => {
  const repository = new MemoryMaintenanceRepository();
  const service = new MaintenanceService(repository, {
    sessionDays: 7, orderEventDays: 90, snapshotDays: 7, orphanPushSubscriptionDays: 7,
  }, () => new Date("2026-10-23T12:00:00.000Z"));

  const result = await service.cleanup();
  assert.deepEqual(result, { customerSessions: 2, userSessions: 1, orderEvents: 4, stateSnapshots: 3, orphanPushSubscriptions: 1 });
  assert.equal(repository.cutoffs?.sessions.toISOString(), "2026-10-16T12:00:00.000Z");
  assert.equal(repository.cutoffs?.orderEvents.toISOString(), "2026-07-25T12:00:00.000Z");
});
