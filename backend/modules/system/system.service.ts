export class SystemService {
  constructor(private readonly vapidPublicKey?: string, private readonly pushEnabled = false) {}

  health() { return { status: "ok" as const }; }

  pushConfig() {
    return this.vapidPublicKey && this.pushEnabled
      ? { enabled: true, publicKey: this.vapidPublicKey }
      : { enabled: false, publicKey: null };
  }
}
