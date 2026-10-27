import type {
  CustomerRecord,
  CustomersRepository,
  CustomerSessionRecord,
  CustomerUpdate,
  NewCustomerSession,
} from './customers.repository';
import { CustomerIdentityConflictError } from './customers.repository';

interface StoredSession extends NewCustomerSession {
  id: string;
  revokedAt: Date | null;
}

export class MemoryCustomersRepository implements CustomersRepository {
  readonly customers = new Map<string, CustomerRecord>();
  readonly sessions = new Map<string, StoredSession>();
  private customerSequence = 0;
  private sessionSequence = 0;

  async findByPhone(phone: string): Promise<CustomerRecord | null> {
    return [...this.customers.values()].find((customer) => customer.phone === phone) ?? null;
  }

  async findById(id: string): Promise<CustomerRecord | null> {
    return this.customers.get(id) ?? null;
  }

  async create(input: { loginName: string; name: string; phone: string }): Promise<CustomerRecord> {
    if (await this.findByPhone(input.phone)) throw new CustomerIdentityConflictError();
    const customer = { id: `customer-${++this.customerSequence}`, email: null, ...input };
    this.customers.set(customer.id, customer);
    return customer;
  }

  async update(id: string, input: CustomerUpdate): Promise<CustomerRecord> {
    const customer = this.customers.get(id);
    if (!customer) throw new Error('Customer missing');
    if (
      input.phone &&
      [...this.customers.values()].some((item) => item.id !== id && item.phone === input.phone)
    ) {
      throw new CustomerIdentityConflictError();
    }
    const updated = { ...customer, ...input };
    this.customers.set(id, updated);
    return updated;
  }

  async createSession(input: NewCustomerSession): Promise<void> {
    const session = { ...input, id: `session-${++this.sessionSequence}`, revokedAt: null };
    this.sessions.set(session.tokenHash, session);
  }

  async findSessionByTokenHash(tokenHash: string): Promise<CustomerSessionRecord | null> {
    const session = this.sessions.get(tokenHash);
    if (!session) return null;
    const customer = this.customers.get(session.customerId);
    if (!customer) return null;
    return { ...session, customer };
  }

  async rotateSession(
    id: string,
    revokedAt: Date,
    replacement: NewCustomerSession,
  ): Promise<boolean> {
    const current = [...this.sessions.values()].find((session) => session.id === id);
    if (!current || current.revokedAt || current.expiresAt <= revokedAt) return false;
    current.revokedAt = revokedAt;
    await this.createSession(replacement);
    return true;
  }

  async revokeSessionByTokenHash(tokenHash: string, revokedAt: Date): Promise<void> {
    const session = this.sessions.get(tokenHash);
    if (session && !session.revokedAt) session.revokedAt = revokedAt;
  }

  async revokeFamily(familyId: string, revokedAt: Date): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.familyId === familyId && !session.revokedAt) session.revokedAt = revokedAt;
    }
  }
}
