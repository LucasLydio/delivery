export interface CustomerAuthenticator {
  authenticate(accessToken: string): Promise<string>;
}

export interface StaffPrincipal {
  id: string;
  profile: 'ADMIN' | 'MANAGER';
}

export interface StaffAuthenticator {
  authenticate(
    accessToken: string,
    profiles?: readonly StaffPrincipal['profile'][],
  ): Promise<StaffPrincipal>;
}
