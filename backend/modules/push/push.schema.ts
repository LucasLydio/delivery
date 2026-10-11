import { z } from "zod";

const base64Url = z.string().min(1).max(256).regex(/^[A-Za-z0-9_-]+$/);

export const registerPushSchema = z.object({
  installId: z.string().uuid(),
  subscription: z.object({
    endpoint: z.string().url().refine((value) => value.startsWith("https://"), "Endpoint must use HTTPS").max(2048),
    keys: z.object({
      p256dh: base64Url,
      auth: base64Url,
    }).strict(),
  }).strict(),
}).strict();

export const deletePushSchema = z.object({
  installId: z.string().uuid(),
  endpoint: z.string().url().refine((value) => value.startsWith("https://"), "Endpoint must use HTTPS").max(2048),
}).strict();
