import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "../../infra/prisma/client";

export interface LatestState {
  state: unknown;
  createdAt: Date;
}

export interface SystemRepository {
  findLatestState(): Promise<LatestState | null>;
}

export class PrismaSystemRepository implements SystemRepository {
  constructor(private readonly client?: PrismaClient) {}

  private get prisma(): PrismaClient { return this.client ?? getPrisma(); }

  findLatestState(): Promise<LatestState | null> {
    return this.prisma.stateSnapshot.findFirst({
      orderBy: { createdAt: "desc" },
      select: { state: true, createdAt: true },
    });
  }
}
