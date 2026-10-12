import { z } from "zod";

export const locationPinSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracyMeters: z.number().finite().min(0).max(100_000).optional(),
}).strict();

const nullableText = (maximum: number) => z.union([z.string().trim().max(maximum), z.null()]);

export const createAddressSchema = z.object({
  label: z.string().trim().min(1).max(40),
  line1: z.string().trim().min(3).max(160),
  line2: nullableText(160).optional(),
  city: z.string().trim().min(2).max(80),
  region: z.string().trim().length(2),
  postalCode: z.string().trim().min(8).max(10),
  deliveryInstructions: nullableText(500).optional(),
  locationPin: z.union([locationPinSchema, z.null()]).optional(),
  isDefault: z.boolean().optional(),
}).strict();

export const updateAddressSchema = z.object({
  label: z.string().trim().min(1).max(40).optional(),
  line1: z.string().trim().min(3).max(160).optional(),
  line2: nullableText(160).optional(),
  city: z.string().trim().min(2).max(80).optional(),
  region: z.string().trim().length(2).optional(),
  postalCode: z.string().trim().min(8).max(10).optional(),
  deliveryInstructions: nullableText(500).optional(),
  locationPin: z.union([locationPinSchema, z.null()]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");

export type LocationPinInput = z.infer<typeof locationPinSchema>;
export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
