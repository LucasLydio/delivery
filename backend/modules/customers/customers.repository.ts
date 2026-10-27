import { Prisma, type PrismaClient } from '@prisma/client';
import { getPrisma } from '../../infra/prisma/client';

export interface CustomerRecord {
  id: string;
  loginName: string | null;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface CustomerSessionRecord {
  id: string;
  customerId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  customer: CustomerRecord;
}

export interface NewCustomerSession {
  customerId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface CustomerUpdate {
  loginName?: string;
  name?: string;
  email?: string | null;
  phone?: string;
}

export class CustomerIdentityConflictError extends Error {}

export interface CustomersRepository {
  findByPhone(phone: string): Promise<CustomerRecord | null>;
  findById(id: string): Promise<CustomerRecord | null>;
  create(input: { loginName: string; name: string; phone: string }): Promise<CustomerRecord>;
  update(id: string, input: CustomerUpdate): Promise<CustomerRecord>;
  createSession(input: NewCustomerSession): Promise<void>;
  findSessionByTokenHash(tokenHash: string): Promise<CustomerSessionRecord | null>;
  rotateSession(id: string, revokedAt: Date, replacement: NewCustomerSession): Promise<boolean>;
  revokeSessionByTokenHash(tokenHash: string, revokedAt: Date): Promise<void>;
  revokeFamily(familyId: string, revokedAt: Date): Promise<void>;
}

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export class PrismaCustomersRepository implements CustomersRepository {
  constructor(private readonly client?: PrismaClient) {}

  private get prisma(): PrismaClient {
    return this.client ?? getPrisma();
  }

  findByPhone(phone: string): Promise<CustomerRecord | null> {
    return this.prisma.customer.findUnique({ where: { phone } });
  }

  findById(id: string): Promise<CustomerRecord | null> {
    return this.prisma.customer.findUnique({ where: { id } });
  }

  async create(input: { loginName: string; name: string; phone: string }): Promise<CustomerRecord> {
    try {
      return await this.prisma.customer.create({ data: input });
    } catch (error) {
      if (isUniqueConflict(error)) throw new CustomerIdentityConflictError();
      throw error;
    }
  }

  async update(id: string, input: CustomerUpdate): Promise<CustomerRecord> {
    try {
      return await this.prisma.customer.update({ where: { id }, data: input });
    } catch (error) {
      if (isUniqueConflict(error)) throw new CustomerIdentityConflictError();
      throw error;
    }
  }

  async createSession(input: NewCustomerSession): Promise<void> {
    await this.prisma.customerSession.create({ data: input });
  }

  findSessionByTokenHash(tokenHash: string): Promise<CustomerSessionRecord | null> {
    return this.prisma.customerSession.findUnique({
      where: { tokenHash },
      include: { customer: true },
    });
  }

  async rotateSession(
    id: string,
    revokedAt: Date,
    replacement: NewCustomerSession,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const result = await transaction.customerSession.updateMany({
        where: { id, revokedAt: null, expiresAt: { gt: revokedAt } },
        data: { revokedAt },
      });
      if (result.count !== 1) return false;
      await transaction.customerSession.create({ data: replacement });
      return true;
    });
  }

  async revokeSessionByTokenHash(tokenHash: string, revokedAt: Date): Promise<void> {
    await this.prisma.customerSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt },
    });
  }

  async revokeFamily(familyId: string, revokedAt: Date): Promise<void> {
    await this.prisma.customerSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt },
    });
  }
}
