import { z } from 'zod';

const name = z.string().trim().min(2).max(120);
const description = z.string().trim().min(3).max(1_000);
const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const moneyMinor = z.number().int().min(0).max(100_000_000);
const sortOrder = z.number().int().min(0).max(100_000);

export const createProductSchema = z
  .object({
    name,
    description,
    categoryId: id,
    basePriceMinor: moneyMinor,
    sortOrder: sortOrder.default(0),
  })
  .strict();

export const updateProductSchema = z
  .object({
    name: name.optional(),
    description: description.optional(),
    categoryId: id.optional(),
    basePriceMinor: moneyMinor.optional(),
    sortOrder: sortOrder.optional(),
    available: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo');

const optionGroupFields = {
  name,
  minSelections: z.number().int().min(0).max(20).default(0),
  maxSelections: z.number().int().min(1).max(20).default(1),
  sortOrder: sortOrder.default(0),
};

export const createOptionGroupSchema = z
  .object(optionGroupFields)
  .strict()
  .refine((value) => value.maxSelections >= value.minSelections, {
    message: 'O máximo de escolhas deve ser maior ou igual ao mínimo',
    path: ['maxSelections'],
  });

export const updateOptionGroupSchema = z
  .object({
    name: name.optional(),
    minSelections: z.number().int().min(0).max(20).optional(),
    maxSelections: z.number().int().min(1).max(20).optional(),
    sortOrder: sortOrder.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo')
  .superRefine((value, context) => {
    if (
      value.minSelections !== undefined &&
      value.maxSelections !== undefined &&
      value.maxSelections < value.minSelections
    ) {
      context.addIssue({
        code: 'custom',
        path: ['maxSelections'],
        message: 'O máximo de escolhas deve ser maior ou igual ao mínimo',
      });
    }
  });

export const createProductOptionSchema = z
  .object({
    name,
    priceDeltaMinor: moneyMinor.default(0),
    sortOrder: sortOrder.default(0),
  })
  .strict();

export const updateProductOptionSchema = z
  .object({
    name: name.optional(),
    priceDeltaMinor: moneyMinor.optional(),
    sortOrder: sortOrder.optional(),
    available: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo');

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateOptionGroupInput = z.infer<typeof createOptionGroupSchema>;
export type UpdateOptionGroupInput = z.infer<typeof updateOptionGroupSchema>;
export type CreateProductOptionInput = z.infer<typeof createProductOptionSchema>;
export type UpdateProductOptionInput = z.infer<typeof updateProductOptionSchema>;
