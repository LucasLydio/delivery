import { z } from 'zod';

export const userProfiles = ['ADMIN', 'MANAGER'] as const;
export type UserProfile = (typeof userProfiles)[number];

const name = z.string().trim().min(2, 'O nome deve ter pelo menos 2 caracteres').max(100);
const email = z
  .email('E-mail inválido')
  .max(254)
  .transform((value) => value.trim().toLowerCase());
const password = z.string().min(8, 'A senha deve ter pelo menos 8 caracteres').max(128);

export const userLoginSchema = z.object({ email, password }).strict();

export const createUserSchema = z
  .object({
    name,
    email,
    profile: z.enum(userProfiles),
    password,
  })
  .strict();

export const updateUserSchema = z
  .object({
    name: name.optional(),
    email: email.optional(),
    profile: z.enum(userProfiles).optional(),
    password: password.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo');

export const listUsersSchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    profile: z.enum(userProfiles).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type UserLoginInput = z.infer<typeof userLoginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersInput = z.infer<typeof listUsersSchema>;
