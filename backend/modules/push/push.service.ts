import type { PushRepository } from "./push.repository";
import type { PushDeletion, PushRegistration } from "./push.schema";

export class PushService {
  constructor(private readonly repository: PushRepository) {}

  async register(input: PushRegistration): Promise<void> {
    await this.repository.upsert(input);
  }

  unregister(input: PushDeletion): Promise<boolean> {
    return this.repository.delete(input);
  }
}
