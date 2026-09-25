import { z } from 'zod'
import { badRequest } from './game/errors'
import { MAX_WINNING_SCORE, MIN_WINNING_SCORE } from './game/types'

export const loginSchema = z.object({
   username: z.string().min(1).max(50),
   password: z.string().min(1).max(100),
})

export const createGameSchema = z.object({
   winningScore: z.number().int().min(MIN_WINNING_SCORE).max(MAX_WINNING_SCORE).optional(),
})

/** Validates untrusted input, turning a Zod failure into a 400 with a readable message. */
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
   const result = schema.safeParse(input ?? {})
   if (result.success) return result.data
   throw badRequest(result.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '))
}
