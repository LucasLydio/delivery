import { z } from 'zod';

const name = z.string().trim().min(2).max(80);
const phone = z.string().trim().min(10).max(30);

export const customerLoginSchema = z.object({ name, phone }).strict();

export const updateCustomerSchema = z
  .object({
    name: name.optional(),
    phone: phone.optional(),
    email: z.union([z.email().max(254), z.null()]).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export type CustomerLoginInput = z.infer<typeof customerLoginSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
