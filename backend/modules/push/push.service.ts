import { getPrisma } from "../../infra/prisma/client";
import type { z } from "zod";
import { deletePushSchema, registerPushSchema } from "./push.schema";

type Registration = z.infer<typeof registerPushSchema>;
type Deletion = z.infer<typeof deletePushSchema>;

export async function registerSubscription(input: Registration) {
  const prisma = getPrisma();
  const { installId, subscription } = input;
  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      installId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    update: {
      installId,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  });
}

export async function unregisterSubscription(input: Deletion): Promise<boolean> {
  const result = await getPrisma().pushSubscription.deleteMany({
    where: { installId: input.installId, endpoint: input.endpoint },
  });
  return result.count > 0;
}
