import { randomBytes, randomUUID } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { ServiceUnavailableException, UnauthorizedException } from '../../shared/exceptions';
import type { UserProfile } from './users.schema';

export interface UserPrincipal {
  id: string;
  profile: UserProfile;
}
export interface UserAccessToken {
  value: string;
  expiresAt: Date;
}

export class UserTokenService {
  constructor(
    private readonly secret: string | undefined,
    private readonly issuer: string,
    private readonly audience: string,
    private readonly ttlSeconds: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createAccessToken(principal: UserPrincipal): Promise<UserAccessToken> {
    const issuedAt = Math.floor(this.now().getTime() / 1000);
    const expiresAt = new Date((issuedAt + this.ttlSeconds) * 1000);
    const value = await new SignJWT({ type: 'admin_access', profile: principal.profile })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(principal.id)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + this.ttlSeconds)
      .setJti(randomUUID())
      .sign(this.requireSecret());
    return { value, expiresAt };
  }

  async verifyAccessToken(token: string): Promise<UserPrincipal> {
    try {
      const { payload, protectedHeader } = await jwtVerify(token, this.requireSecret(), {
        algorithms: ['HS256'],
        issuer: this.issuer,
        audience: this.audience,
        currentDate: this.now(),
      });
      if (
        protectedHeader.typ !== 'JWT' ||
        payload.type !== 'admin_access' ||
        typeof payload.sub !== 'string' ||
        (payload.profile !== 'ADMIN' && payload.profile !== 'MANAGER')
      )
        throw new Error('Invalid claims');
      return { id: payload.sub, profile: payload.profile };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new UnauthorizedException('Token de acesso inválido ou expirado');
    }
  }

  createRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private requireSecret(): Uint8Array {
    if (!this.secret || Buffer.byteLength(this.secret, 'utf8') < 32) {
      throw new ServiceUnavailableException('A autenticação administrativa não está configurada');
    }
    return new TextEncoder().encode(this.secret);
  }
}
