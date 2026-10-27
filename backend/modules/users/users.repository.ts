import { Prisma, type PrismaClient, type UserProfile as PrismaUserProfile } from '@prisma/client';
import { getPrisma } from '../../infra/prisma/client';
import type { ListUsersInput, UserProfile } from './users.schema';

const userSelect = {
  id: true,
  name: true,
  email: true,
  profile: true,
  passwordHash: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.UserSelect;

export type UserRecord = Prisma.UserGetPayload<{ select: typeof userSelect }>;

export interface UserSessionRecord {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  user: UserRecord;
}

export interface NewUserSession {
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface UserWrite {
  name: string;
  email: string;
  profile: UserProfile;
  passwordHash: string;
}
export type UserUpdate = Partial<UserWrite>;
export class UserEmailConflictError extends Error {}

export interface UsersRepository {
  findById(id: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  list(input: ListUsersInput): Promise<{ users: UserRecord[]; total: number }>;
  create(input: UserWrite): Promise<UserRecord>;
  update(id: string, input: UserUpdate): Promise<UserRecord>;
  delete(id: string): Promise<void>;
  countByProfile(profile: UserProfile): Promise<number>;
  createSession(input: NewUserSession): Promise<void>;
  findSessionByTokenHash(tokenHash: string): Promise<UserSessionRecord | null>;
  rotateSession(id: string, revokedAt: Date, replacement: NewUserSession): Promise<boolean>;
  revokeSessionByTokenHash(tokenHash: string, revokedAt: Date): Promise<void>;
  revokeFamily(familyId: string, revokedAt: Date): Promise<void>;
  revokeUserSessions(userId: string, revokedAt: Date): Promise<void>;
}

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly client?: PrismaClient) {}
  private get prisma(): PrismaClient {
    return this.client ?? getPrisma();
  }

  findById(id: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { id }, select: userSelect });
  }

  findByEmail(email: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { email }, select: userSelect });
  }

  async list(input: ListUsersInput): Promise<{ users: UserRecord[]; total: number }> {
    const where: Prisma.UserWhereInput = {
      ...(input.profile ? { profile: input.profile as PrismaUserProfile } : {}),
      ...(input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: 'insensitive' } },
              { email: { contains: input.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { users, total };
  }

  async create(input: UserWrite): Promise<UserRecord> {
    try {
      return await this.prisma.user.create({ data: input, select: userSelect });
    } catch (error) {
      if (isUniqueConflict(error)) throw new UserEmailConflictError();
      throw error;
    }
  }

  async update(id: string, input: UserUpdate): Promise<UserRecord> {
    try {
      return await this.prisma.user.update({ where: { id }, data: input, select: userSelect });
    } catch (error) {
      if (isUniqueConflict(error)) throw new UserEmailConflictError();
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }
  countByProfile(profile: UserProfile): Promise<number> {
    return this.prisma.user.count({ where: { profile: profile as PrismaUserProfile } });
  }
  async createSession(input: NewUserSession): Promise<void> {
    await this.prisma.userSession.create({ data: input });
  }
  findSessionByTokenHash(tokenHash: string): Promise<UserSessionRecord | null> {
    return this.prisma.userSession.findUnique({
      where: { tokenHash },
      include: { user: { select: userSelect } },
    });
  }
  async rotateSession(id: string, revokedAt: Date, replacement: NewUserSession): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const result = await transaction.userSession.updateMany({
        where: { id, revokedAt: null, expiresAt: { gt: revokedAt } },
        data: { revokedAt },
      });
      if (result.count !== 1) return false;
      await transaction.userSession.create({ data: replacement });
      return true;
    });
  }
  async revokeSessionByTokenHash(tokenHash: string, revokedAt: Date): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt },
    });
  }
  async revokeFamily(familyId: string, revokedAt: Date): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt },
    });
  }
  async revokeUserSessions(userId: string, revokedAt: Date): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt },
    });
  }
}
