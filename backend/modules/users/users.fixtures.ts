import type { PasswordHasher } from './users.password';
import {
  UserEmailConflictError,
  type NewUserSession,
  type UserRecord,
  type UserSessionRecord,
  type UsersRepository,
  type UserUpdate,
  type UserWrite,
} from './users.repository';
import type { ListUsersInput, UserProfile } from './users.schema';

interface StoredSession extends NewUserSession {
  id: string;
  revokedAt: Date | null;
}

export class FakePasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `test:${password}`;
  }
  async verify(password: string, encodedHash: string): Promise<boolean> {
    return encodedHash === `test:${password}`;
  }
}

export class MemoryUsersRepository implements UsersRepository {
  readonly users = new Map<string, UserRecord>();
  readonly sessions = new Map<string, StoredSession>();
  private userSequence = 0;
  private sessionSequence = 0;

  async findById(id: string): Promise<UserRecord | null> {
    return this.users.get(id) ?? null;
  }
  async findByEmail(email: string): Promise<UserRecord | null> {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }
  async list(input: ListUsersInput): Promise<{ users: UserRecord[]; total: number }> {
    const search = input.search?.toLocaleLowerCase('pt-BR');
    const filtered = [...this.users.values()]
      .filter(
        (user) =>
          (!input.profile || user.profile === input.profile) &&
          (!search ||
            user.name.toLocaleLowerCase('pt-BR').includes(search) ||
            user.email.includes(search)),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    const start = (input.page - 1) * input.pageSize;
    return { users: filtered.slice(start, start + input.pageSize), total: filtered.length };
  }
  async create(input: UserWrite): Promise<UserRecord> {
    if (await this.findByEmail(input.email)) throw new UserEmailConflictError();
    const now = new Date('2026-10-14T12:00:00.000Z');
    const user = {
      id: `user-${++this.userSequence}`,
      ...input,
      createdAt: now,
      updatedAt: now,
    } as UserRecord;
    this.users.set(user.id, user);
    return user;
  }
  async update(id: string, input: UserUpdate): Promise<UserRecord> {
    const current = this.users.get(id);
    if (!current) throw new Error('User missing');
    if (
      input.email &&
      [...this.users.values()].some((user) => user.id !== id && user.email === input.email)
    ) {
      throw new UserEmailConflictError();
    }
    const updated = {
      ...current,
      ...input,
      updatedAt: new Date('2026-10-14T13:00:00.000Z'),
    } as UserRecord;
    this.users.set(id, updated);
    return updated;
  }
  async delete(id: string): Promise<void> {
    this.users.delete(id);
  }
  async countByProfile(profile: UserProfile): Promise<number> {
    return [...this.users.values()].filter((user) => user.profile === profile).length;
  }
  async createSession(input: NewUserSession): Promise<void> {
    const session = { ...input, id: `session-${++this.sessionSequence}`, revokedAt: null };
    this.sessions.set(session.tokenHash, session);
  }
  async findSessionByTokenHash(tokenHash: string): Promise<UserSessionRecord | null> {
    const session = this.sessions.get(tokenHash);
    if (!session) return null;
    const user = this.users.get(session.userId);
    return user ? { ...session, user } : null;
  }
  async rotateSession(id: string, revokedAt: Date, replacement: NewUserSession): Promise<boolean> {
    const session = [...this.sessions.values()].find((item) => item.id === id);
    if (!session || session.revokedAt || session.expiresAt <= revokedAt) return false;
    session.revokedAt = revokedAt;
    await this.createSession(replacement);
    return true;
  }
  async revokeSessionByTokenHash(tokenHash: string, revokedAt: Date): Promise<void> {
    const session = this.sessions.get(tokenHash);
    if (session && !session.revokedAt) session.revokedAt = revokedAt;
  }
  async revokeFamily(familyId: string, revokedAt: Date): Promise<void> {
    for (const session of this.sessions.values())
      if (session.familyId === familyId && !session.revokedAt) session.revokedAt = revokedAt;
  }
  async revokeUserSessions(userId: string, revokedAt: Date): Promise<void> {
    for (const session of this.sessions.values())
      if (session.userId === userId && !session.revokedAt) session.revokedAt = revokedAt;
  }
}
