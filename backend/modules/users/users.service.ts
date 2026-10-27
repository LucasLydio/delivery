import { createHash, randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '../../shared/exceptions';
import type { StaffAuthenticator } from '../../shared/authentication';
import type { PasswordHasher } from './users.password';
import {
  UserEmailConflictError,
  type NewUserSession,
  type UserRecord,
  type UsersRepository,
} from './users.repository';
import type {
  CreateUserInput,
  ListUsersInput,
  UpdateUserInput,
  UserLoginInput,
  UserProfile,
} from './users.schema';
import { UserTokenService, type UserPrincipal } from './users.tokens';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  profile: UserProfile;
  createdAt: string;
  updatedAt: string;
}

export interface IssuedUserSession {
  user: PublicUser;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');
const toPublicUser = (user: UserRecord): PublicUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  profile: user.profile,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
});

export class UsersService implements StaffAuthenticator {
  constructor(
    private readonly repository: UsersRepository,
    private readonly passwords: PasswordHasher,
    private readonly tokens: UserTokenService,
    private readonly refreshTtlDays: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async login(input: UserLoginInput): Promise<IssuedUserSession> {
    const user = await this.repository.findByEmail(input.email);
    if (!user || !(await this.passwords.verify(input.password, user.passwordHash))) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }
    return this.issueSession(user, randomUUID());
  }

  async refresh(rawToken: string | null): Promise<IssuedUserSession> {
    if (!rawToken) throw new UnauthorizedException('Sessão administrativa não encontrada');
    const session = await this.repository.findSessionByTokenHash(hashToken(rawToken));
    if (!session) throw new UnauthorizedException('Sessão administrativa inválida');
    if (session.revokedAt) {
      await this.repository.revokeFamily(session.familyId, this.now());
      throw new UnauthorizedException('Reutilização de refresh token detectada');
    }
    if (session.expiresAt <= this.now()) {
      await this.repository.revokeSessionByTokenHash(session.tokenHash, this.now());
      throw new UnauthorizedException('Sessão administrativa expirada');
    }
    const replacement = this.prepareRefreshSession(session.userId, session.familyId);
    if (!(await this.repository.rotateSession(session.id, this.now(), replacement.record))) {
      await this.repository.revokeFamily(session.familyId, this.now());
      throw new UnauthorizedException('Reutilização de refresh token detectada');
    }
    return this.withAccessToken(session.user, replacement.rawToken, replacement.record.expiresAt);
  }

  async logout(rawToken: string | null): Promise<void> {
    if (rawToken) await this.repository.revokeSessionByTokenHash(hashToken(rawToken), this.now());
  }

  async me(accessToken: string): Promise<PublicUser> {
    return toPublicUser(await this.authenticate(accessToken));
  }

  async list(accessToken: string, input: ListUsersInput) {
    await this.authenticate(accessToken, ['ADMIN']);
    const result = await this.repository.list(input);
    return {
      users: result.users.map(toPublicUser),
      pagination: { page: input.page, pageSize: input.pageSize, total: result.total },
    };
  }

  async findById(accessToken: string, id: string): Promise<PublicUser> {
    await this.authenticate(accessToken, ['ADMIN']);
    const user = await this.repository.findById(id);
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return toPublicUser(user);
  }

  async create(accessToken: string, input: CreateUserInput): Promise<PublicUser> {
    await this.authenticate(accessToken, ['ADMIN']);
    try {
      return toPublicUser(
        await this.repository.create({
          name: input.name,
          email: input.email,
          profile: input.profile,
          passwordHash: await this.passwords.hash(input.password),
        }),
      );
    } catch (error) {
      if (error instanceof UserEmailConflictError)
        throw new ConflictException('Este e-mail já está em uso');
      throw error;
    }
  }

  async update(accessToken: string, id: string, input: UpdateUserInput): Promise<PublicUser> {
    const actor = await this.authenticate(accessToken, ['ADMIN']);
    const target = await this.repository.findById(id);
    if (!target) throw new NotFoundException('Usuário não encontrado');
    if (target.profile === 'ADMIN' && input.profile === 'MANAGER') await this.requireAnotherAdmin();
    const update = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.profile !== undefined ? { profile: input.profile } : {}),
      ...(input.password !== undefined
        ? { passwordHash: await this.passwords.hash(input.password) }
        : {}),
    };
    try {
      const user = await this.repository.update(id, update);
      if (input.password !== undefined || (id === actor.id && input.profile !== undefined)) {
        await this.repository.revokeUserSessions(id, this.now());
      }
      return toPublicUser(user);
    } catch (error) {
      if (error instanceof UserEmailConflictError)
        throw new ConflictException('Este e-mail já está em uso');
      throw error;
    }
  }

  async delete(accessToken: string, id: string): Promise<void> {
    const actor = await this.authenticate(accessToken, ['ADMIN']);
    if (actor.id === id) throw new ConflictException('Você não pode excluir o próprio usuário');
    const target = await this.repository.findById(id);
    if (!target) throw new NotFoundException('Usuário não encontrado');
    if (target.profile === 'ADMIN') await this.requireAnotherAdmin();
    await this.repository.delete(id);
  }

  async authenticate(accessToken: string, profiles?: readonly UserProfile[]): Promise<UserRecord> {
    const principal: UserPrincipal = await this.tokens.verifyAccessToken(accessToken);
    const user = await this.repository.findById(principal.id);
    if (!user) throw new UnauthorizedException('Usuário da sessão não existe mais');
    if (profiles && !profiles.includes(user.profile)) {
      throw new ForbiddenException('Seu perfil não tem permissão para esta ação');
    }
    return user;
  }

  private async requireAnotherAdmin(): Promise<void> {
    if ((await this.repository.countByProfile('ADMIN')) <= 1) {
      throw new ConflictException('É necessário manter ao menos um administrador');
    }
  }

  private async issueSession(user: UserRecord, familyId: string): Promise<IssuedUserSession> {
    const refresh = this.prepareRefreshSession(user.id, familyId);
    await this.repository.createSession(refresh.record);
    return this.withAccessToken(user, refresh.rawToken, refresh.record.expiresAt);
  }

  private prepareRefreshSession(
    userId: string,
    familyId: string,
  ): { rawToken: string; record: NewUserSession } {
    const rawToken = this.tokens.createRefreshToken();
    return {
      rawToken,
      record: {
        userId,
        familyId,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(this.now().getTime() + this.refreshTtlDays * 86_400_000),
      },
    };
  }

  private async withAccessToken(
    user: UserRecord,
    refreshToken: string,
    refreshTokenExpiresAt: Date,
  ): Promise<IssuedUserSession> {
    const access = await this.tokens.createAccessToken({ id: user.id, profile: user.profile });
    return {
      user: toPublicUser(user),
      accessToken: access.value,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      refreshToken,
      refreshTokenExpiresAt,
    };
  }
}
