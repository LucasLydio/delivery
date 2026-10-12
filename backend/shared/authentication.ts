export interface CustomerAuthenticator {
  authenticate(accessToken: string): Promise<string>;
}
