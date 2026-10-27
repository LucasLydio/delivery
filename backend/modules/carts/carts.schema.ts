import { z } from 'zod';

const cartItemSchema = z
  .object({
    id: z.uuid(),
    productId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
    quantity: z.number().int().min(1).max(99),
    selectedOptionIds: z
      .array(z.string().regex(/^[A-Za-z0-9_-]{1,128}$/))
      .max(50)
      .refine((values) => new Set(values).size === values.length, 'Option IDs must be unique'),
  })
  .strict();

export const synchronizeCartSchema = z
  .object({
    revision: z.union([z.string().regex(/^[1-9]\d{0,9}$/), z.null()]),
    items: z
      .array(cartItemSchema)
      .max(100)
      .refine(
        (items) => new Set(items.map((item) => item.id)).size === items.length,
        'Cart item IDs must be unique',
      ),
  })
  .strict();

export type SynchronizeCartInput = z.infer<typeof synchronizeCartSchema>;
