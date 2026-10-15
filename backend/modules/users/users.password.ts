import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
const keyLength = 64;
const cost = 16_384;
const blockSize = 8;
const parallelization = 1;
const maxmem = 64 * 1024 * 1024;

function derive(password: string, salt: Buffer, length: number, parameters: { N: number; r: number; p: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, length, { ...parameters, maxmem }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, encodedHash: string): Promise<boolean>;
}

export class ScryptPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derived = await derive(password, salt, keyLength, { N: cost, r: blockSize, p: parallelization });
    return `scrypt$${cost}$${blockSize}$${parallelization}$${salt.toString("base64url")}$${derived.toString("base64url")}`;
  }

  async verify(password: string, encodedHash: string): Promise<boolean> {
    const [algorithm, n, r, p, encodedSalt, encodedValue] = encodedHash.split("$");
    if (algorithm !== "scrypt" || !n || !r || !p || !encodedSalt || !encodedValue) return false;
    const parameters = [n, r, p].map(Number);
    if (parameters.some((value) => !Number.isSafeInteger(value) || value <= 0)) return false;
    try {
      const expected = Buffer.from(encodedValue, "base64url");
      const derived = await derive(password, Buffer.from(encodedSalt, "base64url"), expected.length, {
        N: parameters[0], r: parameters[1], p: parameters[2],
      });
      return derived.length === expected.length && timingSafeEqual(derived, expected);
    } catch {
      return false;
    }
  }
}
