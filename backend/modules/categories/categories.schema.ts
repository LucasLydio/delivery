import { z } from 'zod';

const categoryName = z.string().trim().min(2, 'O nome deve ter pelo menos 2 caracteres').max(80);
const sortOrder = z.number().int().min(0).max(100_000);

export const createCategorySchema = z
  .object({
    name: categoryName,
    sortOrder: sortOrder.default(0),
  })
  .strict();

export const updateCategorySchema = z
  .object({
    name: categoryName.optional(),
    sortOrder: sortOrder.optional(),
    available: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo');

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
