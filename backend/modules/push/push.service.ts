import type { PushRepository } from "./push.repository";
import type { PushDeletion, PushRegistration } from "./push.schema";

export class PushService {
  constructor(private readonly repository: PushRepository, private readonly maximumSubscriptions = 5) {}

  async register(customerId: string, input: PushRegistration): Promise<void> {
    await this.repository.upsert(customerId, input, this.maximumSubscriptions);
  }

  unregister(customerId: string, input: PushDeletion): Promise<boolean> {
    return this.repository.delete(customerId, input);
  }
}
