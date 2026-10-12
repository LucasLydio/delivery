import { randomBytes, randomUUID } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { ServiceUnavailableException, UnauthorizedException } from "../../shared/exceptions";

export interface AccessToken {
  value: string;
  expiresAt: Date;
}

export class CustomerTokenService {
  constructor(
    private readonly secret: string | undefined,
    private readonly issuer: string,
    private readonly audience: string,
    private readonly ttlSeconds: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createAccessToken(customerId: string): Promise<AccessToken> {
    const secret = this.requireSecret();
    const issuedAt = Math.floor(this.now().getTime() / 1000);
    const expiresAt = new Date((issuedAt + this.ttlSeconds) * 1000);
    const value = await new SignJWT({ type: "access" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(customerId)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + this.ttlSeconds)
      .setJti(randomUUID())
      .sign(secret);
    return { value, expiresAt };
  }

  async verifyAccessToken(token: string): Promise<string> {
    const secret = this.requireSecret();
    try {
      const { payload, protectedHeader } = await jwtVerify(token, secret, {
        algorithms: ["HS256"],
        issuer: this.issuer,
        audience: this.audience,
        currentDate: this.now(),
      });
      if (protectedHeader.typ !== "JWT" || payload.type !== "access" || typeof payload.sub !== "string") {
        throw new Error("Invalid claims");
      }
      return payload.sub;
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }
  }

  createRefreshToken(): string {
    return randomBytes(32).toString("base64url");
  }

  private requireSecret(): Uint8Array {
    if (!this.secret || Buffer.byteLength(this.secret, "utf8") < 32) {
      throw new ServiceUnavailableException("Authentication is not configured");
    }
    return new TextEncoder().encode(this.secret);
  }
}
