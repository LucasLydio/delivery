import { createHash, randomUUID } from "node:crypto";
import type { Customer, CustomerSession } from "../../../shared/commerce-contract";
import { ConflictException, NotFoundException, UnauthorizedException } from "../../shared/exceptions";
import { formatBrazilianPhone, normalizeBrazilianPhone, normalizeCustomerIdentity, normalizeCustomerName } from "../../utils/customer-identity";
import type { CustomerLoginInput, UpdateCustomerInput } from "./customers.schema";
import {
  CustomerIdentityConflictError,
  type CustomerRecord,
  type CustomersRepository,
  type NewCustomerSession,
} from "./customers.repository";
import { CustomerTokenService } from "./customers.tokens";

export interface IssuedCustomerSession extends CustomerSession {
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function toCustomer(row: CustomerRecord): Customer {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ? formatBrazilianPhone(row.phone) : null,
  };
}

export class CustomersService {
  constructor(
    private readonly repository: CustomersRepository,
    private readonly tokens: CustomerTokenService,
    private readonly refreshTtlDays: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async login(input: CustomerLoginInput): Promise<IssuedCustomerSession> {
    const identity = normalizeCustomerIdentity(input.name, input.phone);
    let customer = await this.repository.findByPhone(identity.phone);

    if (customer) {
      const storedLoginName = customer.loginName ?? normalizeCustomerName(customer.name).loginName;
      if (storedLoginName !== identity.loginName) throw new UnauthorizedException("Invalid name or phone");
      if (!customer.loginName || customer.name !== identity.displayName) {
        customer = await this.repository.update(customer.id, {
          loginName: identity.loginName,
          name: identity.displayName,
          phone: identity.phone,
        });
      }
    } else {
      try {
        customer = await this.repository.create({
          loginName: identity.loginName,
          name: identity.displayName,
          phone: identity.phone,
        });
      } catch (error) {
        if (!(error instanceof CustomerIdentityConflictError)) throw error;
        customer = await this.repository.findByPhone(identity.phone);
        if (!customer || customer.loginName !== identity.loginName) {
          throw new UnauthorizedException("Invalid name or phone");
        }
      }
    }

    return this.issueSession(customer, randomUUID());
  }

  async refresh(refreshToken: string | null): Promise<IssuedCustomerSession> {
    if (!refreshToken) throw new UnauthorizedException("Refresh token required");
    const tokenHash = hashRefreshToken(refreshToken);
    const session = await this.repository.findSessionByTokenHash(tokenHash);
    if (!session) throw new UnauthorizedException("Invalid refresh token");

    const currentTime = this.now();
    if (session.revokedAt) {
      await this.repository.revokeFamily(session.familyId, currentTime);
      throw new UnauthorizedException("Refresh token reuse detected");
    }
    if (session.expiresAt <= currentTime) {
      await this.repository.revokeSessionByTokenHash(tokenHash, currentTime);
      throw new UnauthorizedException("Refresh token expired");
    }

    const replacement = this.prepareRefreshSession(session.customerId, session.familyId);
    const rotated = await this.repository.rotateSession(session.id, currentTime, replacement.record);
    if (!rotated) {
      await this.repository.revokeFamily(session.familyId, currentTime);
      throw new UnauthorizedException("Refresh token reuse detected");
    }
    return this.withAccessToken(session.customer, replacement.rawToken, replacement.record.expiresAt);
  }

  async logout(refreshToken: string | null): Promise<void> {
    if (!refreshToken) return;
    await this.repository.revokeSessionByTokenHash(hashRefreshToken(refreshToken), this.now());
  }

  async me(accessToken: string): Promise<Customer> {
    const customerId = await this.authenticate(accessToken);
    const customer = await this.repository.findById(customerId);
    if (!customer) throw new UnauthorizedException("Customer no longer exists");
    return toCustomer(customer);
  }

  async updateMe(accessToken: string, input: UpdateCustomerInput): Promise<Customer> {
    const customerId = await this.authenticate(accessToken);
    const current = await this.repository.findById(customerId);
    if (!current) throw new NotFoundException("Customer not found");

    const update: { loginName?: string; name?: string; email?: string | null; phone?: string } = {};
    if (input.name !== undefined) {
      const normalized = normalizeCustomerName(input.name);
      update.name = normalized.displayName;
      update.loginName = normalized.loginName;
    }
    if (input.phone !== undefined) update.phone = normalizeBrazilianPhone(input.phone);
    if (input.email !== undefined) update.email = input.email?.toLowerCase() ?? null;

    try { return toCustomer(await this.repository.update(customerId, update)); }
    catch (error) {
      if (error instanceof CustomerIdentityConflictError) {
        throw new ConflictException("Phone is already registered");
      }
      throw error;
    }
  }

  authenticate(accessToken: string): Promise<string> {
    return this.tokens.verifyAccessToken(accessToken);
  }

  private async issueSession(customer: CustomerRecord, familyId: string): Promise<IssuedCustomerSession> {
    const refresh = this.prepareRefreshSession(customer.id, familyId);
    await this.repository.createSession(refresh.record);
    return this.withAccessToken(customer, refresh.rawToken, refresh.record.expiresAt);
  }

  private prepareRefreshSession(customerId: string, familyId: string): { rawToken: string; record: NewCustomerSession } {
    const rawToken = this.tokens.createRefreshToken();
    const expiresAt = new Date(this.now().getTime() + this.refreshTtlDays * 86_400_000);
    return {
      rawToken,
      record: { customerId, familyId, tokenHash: hashRefreshToken(rawToken), expiresAt },
    };
  }

  private async withAccessToken(customer: CustomerRecord, refreshToken: string, refreshTokenExpiresAt: Date): Promise<IssuedCustomerSession> {
    const access = await this.tokens.createAccessToken(customer.id);
    return {
      customer: toCustomer(customer),
      accessToken: access.value,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      refreshToken,
      refreshTokenExpiresAt,
    };
  }
}
