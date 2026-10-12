import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../../app";
import type { PushRepository } from "./push.repository";
import type { PushDeletion, PushRegistration } from "./push.schema";
import { PushService } from "./push.service";

class MemoryPushRepository implements PushRepository {
  registration?: PushRegistration;
  deletion?: PushDeletion;
  async upsert(input: PushRegistration) { this.registration = input; }
  async delete(input: PushDeletion) { this.deletion = input; return true; }
}

const registration = {
  installId: "f62f7544-749a-4bd8-b205-5fe4b28d11c0",
  subscription: {
    endpoint: "https://push.example.test/subscription",
    keys: { p256dh: "public_key", auth: "auth_key" },
  },
};

test("push controller validates and delegates registration and removal", async () => {
  const repository = new MemoryPushRepository();
  const api = request(createApp({ pushService: new PushService(repository) }));

  await api.post("/api/push/subscriptions").send(registration).expect(201, { registered: true });
  assert.deepEqual(repository.registration, registration);

  const deletion = { installId: registration.installId, endpoint: registration.subscription.endpoint };
  await api.delete("/api/push/subscriptions").send(deletion).expect(200, { removed: true });
  assert.deepEqual(repository.deletion, deletion);
});

test("push routes reject unsupported media types, malformed JSON, and invalid payloads", async () => {
  const api = request(createApp({ pushService: new PushService(new MemoryPushRepository()) }));
  await api.post("/api/push/subscriptions").set("content-type", "text/plain").send("payload").expect(415);
  await api.post("/api/push/subscriptions").set("content-type", "application/json").send("{").expect(400, { error: "Request body must be valid JSON" });
  await api.post("/api/push/subscriptions").send({ installId: "invalid" }).expect(400);
});
