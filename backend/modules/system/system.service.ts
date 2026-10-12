import type { SystemRepository } from "./system.repository";

export class SystemService {
  constructor(
    private readonly repository: SystemRepository | null,
    private readonly vapidPublicKey?: string,
  ) {}

  health() { return { status: "ok" as const }; }

  pushConfig() {
    return this.vapidPublicKey
      ? { enabled: true, publicKey: this.vapidPublicKey }
      : { enabled: false, publicKey: null };
  }

  async latestState() {
    const latest = await this.repository?.findLatestState();
    return {
      state: latest?.state ?? null,
      updatedAt: latest?.createdAt.toISOString() ?? null,
    };
  }
}
